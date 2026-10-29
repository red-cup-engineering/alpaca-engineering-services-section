import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAlpacaApp } from "../src/alpaca-app.mjs";
import { createAdapter } from "../src/alpaca-production-adapter.mjs";
import { createStrategy } from "../src/blk-strategy.mjs";
import { createAlpacaAppFileState } from "../src/file-state.mjs";

const NOW = "2030-01-07T15:00:00.000Z";
const contract = { id: "contract:production-live", type: "PrincipalBrokerageServiceContract", principal: "urn:principal:esther-davis", accountReference: "account:esther", venue: "alpaca-trading-live",
  scopes: ["account:read", "positions:read", "orders:read", "orders:live", "activities:read", "orders:intent"], validUntil: "2031-01-01T00:00:00.000Z", capital: { amount: 150, currency: "USD" }, risk: { maximumOrderNotional: 20, maximumLossAmount: 10, concentrationLimit: 0.2 } };
const grant = { id: "grant:production-live", type: "RevocableBrokerageAuthorityGrant", principal: contract.principal, accountReference: contract.accountReference, venue: contract.venue, adapter: contract.venue,
  principalContract: contract.id, credentialReference: "credential:esther-live", scopes: contract.scopes, validUntil: contract.validUntil, revoked: false };
const configuration = { principal: contract.principal, accountReference: contract.accountReference, mode: "bounded-live", liveArmingReference: "arming:esther:150-usd", armed: true, contract, authorityGrant: grant,
  credentials: { reference: grant.credentialReference, keyEnvironmentVariable: "TEST_ALPACA_KEY", secretEnvironmentVariable: "TEST_ALPACA_SECRET" }, books: { nodeId: "test-node", dataRoot: "/not-used" },
  envelope: { capital: 150, maximumOrderNotional: 20, maximumGrossExposure: 120, maximumDailyLossFraction: 0.03, maximumDrawdownFraction: 0.10, symbols: ["BLK", "SPY"], tradingWindows: [{ days: [1], startMinuteUtc: 0, endMinuteUtc: 1440 }] } };
const decision = async () => ({ disposition: "order", symbol: "BLK", side: "buy", notional: 10, maximumLoss: 3, thesis: "bounded BLK order", falsifier: "venue refusal",
  liquidityPremise: "fractional notional liquidity", executionPremise: "client-order-id reconciliation", scenarios: [{ name: "loss", pnl: -3 }, { name: "gain", pnl: 3 }] });

test("production adapter composes custody and venue operations through one bounded-live lifecycle without network", async () => {
  const calls = [], orders = new Map();
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), method: options.method, body: options.body ?? null, credentialHeadersPresent: Boolean(options.headers["APCA-API-KEY-ID"] && options.headers["APCA-API-SECRET-KEY"]) });
    const parsed = new URL(url), clientOrderId = parsed.searchParams.get("client_order_id");
    let status = 200, payload;
    if (options.method === "GET" && parsed.pathname === "/v2/account") payload = { id: contract.accountReference, equity: "150", last_equity: "150", cash: "100" };
    else if (options.method === "GET" && parsed.pathname === "/v2/positions") payload = [{ symbol: "BLK", market_value: "50" }];
    else if (options.method === "GET" && parsed.pathname === "/v2/orders:by_client_order_id") { if (orders.has(clientOrderId)) payload = orders.get(clientOrderId); else { status = 404; payload = { code: 40410000 }; } }
    else if (options.method === "POST" && parsed.pathname === "/v2/orders") { const order = JSON.parse(options.body); payload = { ...order, id: "venue-order:1", status: "filled", filled_avg_price: "70" }; orders.set(order.client_order_id, payload); }
    else if (options.method === "DELETE" && parsed.pathname === "/v2/orders/venue-order%3A1") { const [id, order] = [...orders.entries()][0]; orders.set(id, { ...order, status: "canceled" }); status = 204; payload = null; }
    else if (options.method === "GET" && parsed.pathname === "/v2/account/activities") payload = [];
    else throw new Error(`unexpected-request:${options.method}:${parsed.pathname}`);
    return new Response(status === 204 ? null : JSON.stringify(payload), { status, headers: { "content-type": "application/json", "x-request-id": `request-${calls.length}` } });
  };
  const adapter = await createAdapter(configuration, { environment: { TEST_ALPACA_KEY: "test-key", TEST_ALPACA_SECRET: "test-secret" }, fetchImpl, clock: () => NOW, recordOutcome: async () => ({ id: "recorded" }) });
  const root = mkdtempSync(join(tmpdir(), "alpaca-production-adapter-"));
  try {
    const app = createAlpacaApp({ configuration, adapter, strategy: decision, state: createAlpacaAppFileState(join(root, "state.json")), recordOutcome: adapter.recordOutcome, clock: () => NOW }), outcome = await app.run();
    assert.equal(outcome.lifecycle, "filled"); assert.equal(calls.filter(({ method }) => method === "POST").length, 1); assert.ok(calls.every(({ url }) => new URL(url).hostname === "api.alpaca.markets")); assert.ok(calls.every(({ credentialHeadersPresent }) => credentialHeadersPresent));
    const cancellation = await app.cancel(outcome.receipt.clientOrderId); assert.equal(cancellation.observed.payload.status, "canceled"); assert.equal(calls.filter(({ method }) => method === "DELETE").length, 1);
    assert.equal(JSON.stringify(outcome).includes("test-secret"), false); assert.equal(JSON.stringify(outcome).includes("test-key"), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("real BLK strategy wraps market-data and strategy services through injected HTTP and record seams", async () => {
  const bars = (symbol) => Array.from({ length: 140 }, (_, index) => { const at = new Date(Date.parse(NOW) - (139 - index) * 86_400_000).toISOString(), close = symbol === "BLK" ? 50 * (1.003 ** index) : 100 * (1.0002 ** index); return { t: at, o: close * 0.999, h: close * 1.002, l: close * 0.998, c: close, v: 100000, n: 1000, vw: close }; });
  const requests = [], strategy = await createStrategy({ ...configuration, strategy: { kind: "obsmetrologia-blk-accumulation", keyEnvironmentVariable: "TEST_DATA_KEY", secretEnvironmentVariable: "TEST_DATA_SECRET", lookbackDays: 400, feed: "iex", maximumOrderFraction: 0.1, maximumLossFraction: 0.1 } }, {
    environment: { TEST_DATA_KEY: "test-data-key", TEST_DATA_SECRET: "test-data-secret" }, clock: () => NOW, recordObservation: async () => ({ id: "book:market-data" }),
    fetchImpl: async (url, options) => { requests.push({ url: String(url), headers: options.headers }); return new Response(JSON.stringify({ bars: { BLK: bars("BLK"), SPY: bars("SPY") } }), { status: 200, headers: { "content-type": "application/json" } }); },
  });
  const result = await strategy({ principal: configuration.principal, accountReference: configuration.accountReference, venue: configuration.contract.venue, observedAt: NOW,
    account: { id: configuration.accountReference, cash: "100" }, positions: [{ symbol: "BLK", market_value: "50" }], envelope: configuration.envelope });
  assert.equal(result.reading.type, "ObsmetrologiaBlkAccumulationStrategyReading"); assert.equal(requests.length, 1); assert.equal(new URL(requests[0].url).hostname, "data.alpaca.markets");
  assert.equal(JSON.stringify(result).includes("test-data-secret"), false); assert.ok(["order", "hold", "no-order"].includes(result.disposition));
});
