import assert from "node:assert/strict";
import test from "node:test";
import { createBrokerageX402Server, ROUTES } from "../src/server.mjs";

const NETWORK = "eip155:84532";
const PAY_TO = "0x32886F6F361C1d570255c2762967A2e41D0E9B1a";
const ENV = Object.freeze({ X402_NETWORK: NETWORK, X402_PAY_TO: PAY_TO, X402_FACILITATOR: "https://facilitator.invalid" });

function unpaidFacilitator() {
  return {
    async getSupported() { return { kinds: [{ x402Version: 2, scheme: "exact", network: NETWORK }], extensions: [], signers: {} }; },
    async verify() { throw new Error("an unpaid request must never verify"); },
    async settle() { throw new Error("an unpaid request must never settle"); },
  };
}

function paidFacilitator() {
  return {
    async getSupported() { return { kinds: [{ x402Version: 2, scheme: "exact", network: NETWORK }], extensions: [], signers: {} }; },
    async verify() { return { isValid: true, payer: `0x${"11".repeat(20)}` }; },
    async settle() { return { success: true, network: NETWORK, transaction: `0x${"ab".repeat(32)}`, payer: `0x${"11".repeat(20)}` }; },
  };
}

function issuerProvider(result = { id: "urn:product:issuer", type: "IssuerEvidencePacket" }) {
  const provider = async () => result;
  provider.originatingActor = "urn:ame:issuer-provider";
  provider.preflight = async () => {};
  provider.externalEvidence = () => ({ type: "ExternalEvidence" });
  return provider;
}

function server(dependencies = {}) {
  return createBrokerageX402Server(ENV, {
    facilitatorClient: unpaidFacilitator(),
    afterSettle: async () => {},
    recordDelivery: async ({ output }) => ({ witness: { recorded: true, output } }),
    providers: { issuer: issuerProvider() },
    ...dependencies,
  });
}

test("GET /healthz reports offer counts without touching payment", async () => {
  const res = await server().fetch(new Request("https://border.test/healthz"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.offers, Object.keys(ROUTES).length);
  assert.equal(body.availableOffers, 1);
});

test("GET the well-known catalog lists every route, priced and unpriced", async () => {
  const res = await server().fetch(new Request("https://border.test/.well-known/brokerage-products"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.products.length, Object.keys(ROUTES).length);
  assert.equal(body.products.find((p) => p.key === "issuer").available, true);
  assert.equal(body.products.find((p) => p.key === "alpha").available, false);
});

test("credentials are refused before payment and before any product provider", async () => {
  const seller = server();
  const res = await seller.fetch(new Request(`https://border.test${ROUTES.issuer}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request: {}, authorization: "Bearer secret" }),
  }));
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error, "product-preflight-refused");
});

test("an unavailable product refuses before payment, without invoking the unpaid facilitator", async () => {
  const res = await server({ providers: {} }).fetch(new Request(`https://border.test${ROUTES.issuer}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request: {} }),
  }));
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "product-provider-unavailable");
});

test("a real (non-discovery-probe) request with no payment gets a 402 challenge, and the provider never runs", async () => {
  let ran = false;
  const provider = issuerProvider();
  const wrapped = Object.assign(async (...args) => { ran = true; return provider(...args); }, provider);
  const res = await server({ providers: { issuer: wrapped } }).fetch(new Request(`https://border.test${ROUTES.issuer}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request: { ticker: "NOT-THE-DISCOVERY-EXAMPLE" } }),
  }));
  assert.equal(res.status, 402);
  assert.ok(res.headers.get("payment-required"));
  assert.equal(ran, false);
});

const challengeOf = (response) => JSON.parse(Buffer.from(response.headers.get("payment-required"), "base64").toString("utf8"));

test("a paid request runs the provider, records a witness, and returns settlement headers", async () => {
  const seller = server({ facilitatorClient: paidFacilitator() });
  const requestBody = JSON.stringify({ request: { ticker: "NOT-THE-DISCOVERY-EXAMPLE" } });
  const unpaid = await seller.fetch(new Request(`https://border.test${ROUTES.issuer}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: requestBody,
  }));
  const payment = Buffer.from(JSON.stringify({
    x402Version: 2, accepted: challengeOf(unpaid).accepts[0], payload: { signature: "0xtest" },
  })).toString("base64");
  const res = await seller.fetch(new Request(`https://border.test${ROUTES.issuer}`, {
    method: "POST", headers: { "content-type": "application/json", "payment-signature": payment }, body: requestBody,
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.output, { id: "urn:product:issuer", type: "IssuerEvidencePacket" });
  assert.equal(body.witness.recorded, true);
  assert.ok(res.headers.get("payment-response"));
});
