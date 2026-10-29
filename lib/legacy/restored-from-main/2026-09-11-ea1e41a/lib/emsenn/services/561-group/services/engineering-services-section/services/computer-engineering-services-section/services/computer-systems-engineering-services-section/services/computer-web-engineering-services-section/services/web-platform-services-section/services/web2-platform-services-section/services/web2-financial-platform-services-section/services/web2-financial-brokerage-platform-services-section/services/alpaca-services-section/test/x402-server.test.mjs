import assert from "node:assert/strict";
import test from "node:test";
import { BAZAAR_DISCOVERY_REQUESTS, CATALOG_ROUTE, createBrokerageX402Server, PRICES, ROUTES } from "../services/coinbase-x402-bazaar-border/src/server.mjs";
import { createBrokerageProductProviders } from "../src/market-runtime.mjs";

// createBrokerageX402Server moved from an Express `{app}` (started with app.listen) to a
// fetch-handler `{engine, fetch, ...}` (see the package's own test/server.test.mjs), and its
// product catalog was reorganized from a 7-product (issuer/alpha/blkStrategy/alpacaRead/...)
// table to the current 8-product one (issuer/alpha/paperIntent/reconcile/divinationReading/
// reportGraphic/occupationEntropy/strategySynthesis). These cases were updated to that current
// contract and call `server.fetch(new Request(...))` directly rather than binding a real port.
const NETWORK = "eip155:84532", PAY_TO = "0x0000000000000000000000000000000000000001";
const ORIGIN = "https://border.test";
const facilitator = { async getSupported() { return { kinds: [{ x402Version: 2, scheme: "exact", network: NETWORK }], extensions: [], signers: {} }; }, async verify() { throw new Error("unpaid test must not verify"); }, async settle() { throw new Error("unpaid test must not settle"); } };
const challenge = (response) => JSON.parse(Buffer.from(response.headers.get("payment-required"), "base64").toString("utf8"));
const provider = (key) => Object.assign(async () => ({ id: `result:${key}`, type: "TestResult" }), {
  preflight: async () => true, originatingActor: `urn:ame:test-${key}-provider`, externalEvidence: () => [{ uri: `urn:test:evidence:${key}`, digest: `sha256:${key}` }],
});

test("runnable x402 seller advertises eight Bazaar products and validates before payment", async () => {
  const providers = Object.fromEntries(Object.keys(ROUTES).map((key) => [key, provider(key)]));
  const server = createBrokerageX402Server({ X402_NETWORK: NETWORK, X402_FACILITATOR: "https://facilitator.invalid", X402_PAY_TO: PAY_TO }, { facilitatorClient: facilitator, afterSettle: async () => {}, recordDelivery: async () => ({ witness: { id: "witness:test" } }), providers });
  const unpaid = await server.fetch(new Request(`${ORIGIN}${ROUTES.issuer}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-proto": "https" }, body: JSON.stringify({ request: { ticker: "NVDA" } }) }));
  assert.equal(unpaid.status, 402); const required = challenge(unpaid); assert.equal(required.x402Version, 2); assert.equal(required.accepts[0].amount, "250000"); assert.equal(required.accepts[0].network, NETWORK); assert.equal(required.extensions.bazaar.info.input.method, "POST"); assert.equal(required.extensions.bazaar.info.input.bodyType, "json"); assert.match(required.resource.url, /\/v1\/issuer-evidence$/u);
  const secret = await server.fetch(new Request(`${ORIGIN}${ROUTES.issuer}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request: { apiKey: "refused" } }) })); assert.equal(secret.status, 422);
  const missing = await server.fetch(new Request(`${ORIGIN}${ROUTES.reconcile}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })); assert.equal(missing.status, 422);
  const health = await server.fetch(new Request(`${ORIGIN}/healthz`)); assert.equal(health.status, 200); assert.deepEqual(await health.json(), { status: "ok", service: "coinbase-x402-bazaar-border", network: NETWORK, offers: 8, availableOffers: 8 }); assert.equal(PRICES.occupationEntropy, "$0.01"); assert.equal(PRICES.reportGraphic, "$0.12");
  const catalog = await server.fetch(new Request(`${ORIGIN}${CATALOG_ROUTE}`)); assert.equal(catalog.status, 200); const products = (await catalog.json()).products;
  assert.equal(products.length, 8); assert.deepEqual(products.find(({ key }) => key === "alpha"), { key: "alpha", method: "POST", path: ROUTES.alpha, price: "$1.00", asset: "USDC", available: true });
  assert.deepEqual(products.find(({ key }) => key === "strategySynthesis"), { key: "strategySynthesis", method: "POST", path: ROUTES.strategySynthesis, price: "$15.00", asset: "USDC", available: true });
});

test("every declared Bazaar discovery request receives a payment challenge without provider execution", async () => {
  const calls = [], providers = Object.fromEntries(Object.keys(ROUTES).map((key) => [key, Object.assign(async () => { calls.push(`execute:${key}`); return { id: `result:${key}`, type: "TestResult" }; }, {
    preflight: async () => { calls.push(`preflight:${key}`); }, originatingActor: `urn:ame:test-${key}-provider`, externalEvidence: () => [{ uri: `urn:test:evidence:${key}`, digest: `sha256:${key}` }],
  })]));
  const server = createBrokerageX402Server({ X402_NETWORK: NETWORK, X402_FACILITATOR: "https://facilitator.invalid", X402_PAY_TO: PAY_TO }, { facilitatorClient: facilitator, afterSettle: async () => {}, recordDelivery: async () => ({ witness: { id: "witness:test" } }), providers });
  for (const [key, path] of Object.entries(ROUTES)) {
    const response = await server.fetch(new Request(`${ORIGIN}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-proto": "https" }, body: JSON.stringify({ request: BAZAAR_DISCOVERY_REQUESTS[key] }) }));
    assert.equal(response.status, 402, `${key} discovery request must be payable`);
    assert.ok(response.headers.get("payment-required"), `${key} discovery request must carry payment requirements`);
  }
  assert.deepEqual(calls, []);
});

test("an unavailable product provider refuses before an x402 challenge", async () => {
  const server = createBrokerageX402Server({ X402_NETWORK: NETWORK, X402_FACILITATOR: "https://facilitator.invalid", X402_PAY_TO: PAY_TO }, { facilitatorClient: facilitator, afterSettle: async () => {}, recordDelivery: async () => ({}), providers: { alpha: provider("alpha") } });
  const response = await server.fetch(new Request(`${ORIGIN}${ROUTES.issuer}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request: { ticker: "NVDA" } }) }));
  assert.equal(response.status, 503); assert.equal(response.headers.get("payment-required"), null);
  assert.equal((await response.json()).error, "product-provider-unavailable");
});

test("real provider preflight refuses an invalid paid product before issuing a payment challenge", async () => {
  const server = createBrokerageX402Server({ X402_NETWORK: NETWORK, X402_FACILITATOR: "https://facilitator.invalid", X402_PAY_TO: PAY_TO }, {
    facilitatorClient: facilitator, afterSettle: async () => {}, recordDelivery: async () => ({}), providers: createBrokerageProductProviders(),
  });
  const response = await server.fetch(new Request(`${ORIGIN}${ROUTES.issuer}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request: { ticker: "NVDA" } }) }));
  assert.equal(response.status, 422); assert.equal(response.headers.get("payment-required"), null);
  assert.match((await response.json()).reason, /ticker-and-issuer|required|source/u);
});
