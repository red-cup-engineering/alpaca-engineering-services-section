import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createAlpacaApp, validateAlpacaAppConfiguration } from "../src/alpaca-app.mjs";
import { createAlpacaAppFileState } from "../src/file-state.mjs";

const NOW = "2030-01-07T15:00:00.000Z"; // Monday, 15:00 UTC
const contract = Object.freeze({ id: "contract:esther-live", type: "PrincipalBrokerageServiceContract", principal: "urn:principal:esther-davis", accountReference: "account:esther", venue: "alpaca-trading-live",
  scopes: ["account:read", "positions:read", "orders:read", "orders:live", "activities:read", "orders:intent"], validUntil: "2031-01-01T00:00:00.000Z", capital: { amount: 150, currency: "USD" }, risk: { maximumOrderNotional: 20, maximumLossAmount: 10, concentrationLimit: 0.2 } });
const authorityGrant = Object.freeze({ id: "grant:esther-live", type: "RevocableBrokerageAuthorityGrant", principal: contract.principal, accountReference: contract.accountReference, venue: contract.venue, adapter: contract.venue,
  principalContract: contract.id, scopes: contract.scopes, validUntil: contract.validUntil, revoked: false });
const configuration = Object.freeze({ principal: contract.principal, accountReference: contract.accountReference, mode: "bounded-live", liveArmingReference: "arming:esther:150-usd", armed: true, contract, authorityGrant,
  envelope: { capital: 150, maximumOrderNotional: 20, maximumGrossExposure: 120, maximumDailyLossFraction: 0.03, maximumDrawdownFraction: 0.10, symbols: ["BLK", "SPY"], tradingWindows: [{ days: [1, 2, 3, 4, 5], startMinuteUtc: 14 * 60, endMinuteUtc: 21 * 60 }] } });
const strategy = async () => ({ disposition: "order", strategy: "test-blk", symbol: "BLK", side: "buy", notional: 10, maximumLoss: 3,
  thesis: "BLK allocation remains below the bounded target", falsifier: "the allocation reaches its target", liquidityPremise: "fractional market notional is available", executionPremise: "the venue accepts market notional orders",
  scenarios: [{ name: "loss", pnl: -3 }, { name: "gain", pnl: 4 }] });

function fakeAdapter({ finalStatus = "filled" } = {}) {
  const orders = new Map(), calls = [];
  return { calls,
    async readAccount() { return { id: "account-read", status: 200, payload: { id: contract.accountReference, equity: "150", last_equity: "150", cash: "100" } }; },
    async listPositions() { return { id: "positions-read", status: 200, payload: [{ symbol: "BLK", market_value: "50" }] }; },
    async listActivities() { return { id: "activities-read", status: 200, payload: [] }; },
    async getOrderByClientOrderId({ clientOrderId }) { const order = orders.get(clientOrderId); return order ? { id: `order-read:${clientOrderId}`, status: 200, payload: order } : { status: 404, payload: null }; },
    async placeOrder({ order }) { calls.push(order); orders.set(order.client_order_id, { ...order, id: "venue-order:1", status: finalStatus, filled_avg_price: finalStatus === "filled" ? "70" : null }); return { id: "placement:1", status: 200, payload: orders.get(order.client_order_id) }; },
    async cancelOrderByClientOrderId({ clientOrderId }) { const order = orders.get(clientOrderId); if (!order) return { id: "cancel:not-found", status: 404 }; orders.set(clientOrderId, { ...order, status: "canceled" }); return { id: "cancel:1", status: 200 }; },
  };
}

test("bounded-live lifecycle binds the account, submits once, reconciles a fill, and replays idempotently", async () => {
  const root = mkdtempSync(join(tmpdir(), "alpaca-app-"));
  try {
    const adapter = fakeAdapter(), outcomes = [], app = createAlpacaApp({ configuration, adapter, strategy, state: createAlpacaAppFileState(join(root, "state.json")), recordOutcome: async (outcome) => outcomes.push(outcome), clock: () => NOW });
    const first = await app.run();
    assert.equal(first.mode, "bounded-live"); assert.equal(first.lifecycle, "filled"); assert.equal(first.receipt.orderObservationDisposition, "terminal-order-observed"); assert.equal(adapter.calls.length, 1);
    const replay = await app.run();
    assert.equal(replay.receipt.idempotent, true); assert.equal(adapter.calls.length, 1); assert.equal(outcomes.length, 2);
    const status = await app.status(); assert.equal(status.account.id, contract.accountReference); assert.equal(status.account.equity, "150"); assert.equal(status.positions[0].symbol, "BLK"); assert.deepEqual(status.pnl, { equity: 150, lastEquity: 150, daily: 0, dailyFraction: 0, unrealized: 0, grossExposure: 50 });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("paper mode uses the same app and reconciliation path without a live venue effect", async () => {
  const root = mkdtempSync(join(tmpdir(), "alpaca-app-paper-"));
  try {
    const paperContract = { ...contract, id: "contract:esther-paper", venue: "alpaca-trading-paper", scopes: contract.scopes.map((scope) => scope === "orders:live" ? "orders:paper" : scope) };
    const paperGrant = { ...authorityGrant, id: "grant:esther-paper", venue: paperContract.venue, adapter: paperContract.venue, principalContract: paperContract.id, scopes: paperContract.scopes };
    const paperConfiguration = { ...configuration, mode: "paper", liveArmingReference: undefined, contract: paperContract, authorityGrant: paperGrant };
    const outcome = await createAlpacaApp({ configuration: paperConfiguration, adapter: fakeAdapter(), strategy, state: createAlpacaAppFileState(join(root, "state.json")), clock: () => NOW }).run();
    assert.equal(outcome.mode, "paper"); assert.equal(outcome.receipt.liveVenueEffect, false); assert.equal(outcome.lifecycle, "filled");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("one strategy cycle can execute a bounded multi-asset portfolio rebalance", async () => {
  const root = mkdtempSync(join(tmpdir(), "alpaca-app-portfolio-"));
  try {
    const adapter = fakeAdapter();
    const portfolioStrategy = async () => ({ disposition: "portfolio", target: { weights: { BLK: 0.3, SPY: 0.2 } }, orders: [
      { ...(await strategy()), symbol: "BLK", notional: 5 },
      { ...(await strategy()), symbol: "SPY", notional: 10, thesis: "SPY has the strongest admitted portfolio score" },
    ] });
    const outcome = await createAlpacaApp({ configuration, adapter, strategy: portfolioStrategy, state: createAlpacaAppFileState(join(root, "state.json")), clock: () => NOW }).run();
    assert.equal(outcome.type, "AlpacaAppPortfolioOutcome");
    assert.equal(outcome.outcomes.length, 2);
    assert.deepEqual(adapter.calls.map(({ symbol }) => symbol), ["BLK", "SPY"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("daily loss and drawdown limits pause before strategy or order execution", async () => {
  const root = mkdtempSync(join(tmpdir(), "alpaca-app-risk-"));
  try {
    let strategyCalls = 0; const adapter = fakeAdapter(); adapter.readAccount = async () => ({ status: 200, payload: { id: contract.accountReference, equity: "140", last_equity: "150", cash: "90" } });
    const state = createAlpacaAppFileState(join(root, "state.json")); state.save({ highWaterMark: 150 });
    const app = createAlpacaApp({ configuration, adapter, strategy: async (input) => { strategyCalls += 1; return strategy(input); }, state, clock: () => NOW });
    const result = await app.run(); assert.equal(result.disposition, "risk-paused"); assert.equal(strategyCalls, 0); assert.equal(adapter.calls.length, 0); assert.equal(state.load().paused, true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("rejected and canceled venue states are visible and pause/revoke are hard gates", async () => {
  const root = mkdtempSync(join(tmpdir(), "alpaca-app-"));
  try {
    const rejected = fakeAdapter({ finalStatus: "rejected" }), state = createAlpacaAppFileState(join(root, "state.json"));
    const app = createAlpacaApp({ configuration, adapter: rejected, strategy, state, clock: () => NOW });
    const outcome = await app.run(); assert.equal(outcome.lifecycle, "rejected");
    app.pause("operator-check"); await assert.rejects(app.run(), /paused/u); app.resume();
    const canceled = await app.cancel(outcome.receipt.clientOrderId); assert.equal(canceled.observed.payload.status, "canceled");
    app.revoke("customer-stop"); await assert.rejects(app.run(), /revoked/u); assert.throws(() => app.resume(), /revoked/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("configuration and runtime refuse ambient/default live, identity drift, symbol drift, and gross exposure overflow", async () => {
  assert.throws(() => validateAlpacaAppConfiguration({ ...configuration, mode: undefined }), /explicit-paper-or-bounded-live/u);
  assert.throws(() => validateAlpacaAppConfiguration({ ...configuration, armed: false }), /not-armed/u);
  const root = mkdtempSync(join(tmpdir(), "alpaca-app-"));
  try {
    const wrongAccount = fakeAdapter(); wrongAccount.readAccount = async () => ({ status: 200, payload: { id: "wrong", equity: "150", last_equity: "150" } });
    await assert.rejects(createAlpacaApp({ configuration, adapter: wrongAccount, strategy, state: createAlpacaAppFileState(join(root, "wrong.json")), clock: () => NOW }).run(), /identity-mismatch/u);
    const oversizedStrategy = async () => ({ ...(await strategy()), notional: 80 });
    await assert.rejects(createAlpacaApp({ configuration, adapter: fakeAdapter(), strategy: oversizedStrategy, state: createAlpacaAppFileState(join(root, "big.json")), clock: () => NOW }).run(), /per-order-cap/u);
    const badSymbol = async () => ({ ...(await strategy()), symbol: "TSLA" });
    await assert.rejects(createAlpacaApp({ configuration, adapter: fakeAdapter(), strategy: badSymbol, state: createAlpacaAppFileState(join(root, "symbol.json")), clock: () => NOW }).run(), /symbol-not-allowed/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the family-owned alpaca-app CLI runs locally with injected transport and strategy modules", () => {
  const root = mkdtempSync(join(tmpdir(), "alpaca-app-cli-"));
  try {
    const here = dirname(fileURLToPath(import.meta.url)), configPath = join(root, "config.json");
    const cliConfiguration = { ...configuration, statePath: join(root, "state.json"), envelope: { ...configuration.envelope, tradingWindows: [{ days: [0, 1, 2, 3, 4, 5, 6], startMinuteUtc: 0, endMinuteUtc: 1440 }] } };
    writeFileSync(configPath, JSON.stringify(cliConfiguration));
    const output = execFileSync(process.execPath, [join(here, "../apps/alpaca-app/cli.mjs"), "run", "--config", configPath, "--adapter", join(here, "fixtures/fake-adapter.mjs"), "--strategy", join(here, "fixtures/fake-strategy.mjs")], { encoding: "utf8" });
    const result = JSON.parse(output); assert.equal(result.type, "AlpacaAppOrderOutcome"); assert.equal(result.lifecycle, "filled"); assert.equal(result.mode, "bounded-live");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
