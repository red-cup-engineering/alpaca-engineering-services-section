import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCT_OFFERS, createX402BrokerageBorder } from "../src/http-border.mjs";
import { CDP_FACILITATOR_SELECTION, ROUTES } from "../src/server.mjs";
import { createIssuerEvidenceProvider } from "../src/product-providers.mjs";

const settled = async () => ({ success: true, transaction: "0xsettled", network: "eip155:8453", asset: "USDC", amount: "0.25", payTo: "0xpayee" });
const border = (verifyAndSettle = settled) => createX402BrokerageBorder({
  payTo: "0xpayee", facilitator: "https://facilitator.example", verifyAndSettle,
  providers: { "issuer-evidence-packet": async () => ({ id: "urn:product:issuer", type: "IssuerEvidencePacket" }) },
});

test("the Coinbase border exposes neither account-read nor order-execution authority", () => {
  assert.equal(ROUTES.alpacaRead, undefined);
  assert.equal(ROUTES.execution, undefined);
  assert.equal(PRODUCT_OFFERS["/v1/alpaca/read"], undefined);
  assert.equal(PRODUCT_OFFERS["/v1/alpaca/execute"], undefined);
  assert.equal(JSON.stringify({ ROUTES, PRODUCT_OFFERS }).includes("placeOrder"), false);
});

test("CDP selection remains explicit leaf policy over the shared client", () => {
  assert.deepEqual(CDP_FACILITATOR_SELECTION, {
    provider: "cdp",
    urlMarker: "api.cdp.coinbase.com",
    correlation: { sdkLanguage: "javascript", source: "coinbase-x402-bazaar-border", sourceVersion: "0.1.7" },
  });
});

test("credentials are refused before payment and before any product provider", async () => {
  const response = await border()({ path: "/v1/issuer-evidence", body: { authorization: "Bearer secret" } });
  assert.equal(response.status, 422);
  assert.equal(response.body.error, "credential-bearing-commercial-request-refused");
});

test("a forged settlement for another payment requirement is refused", async () => {
  const response = await border(async () => ({ success: true, transaction: "0xforged", network: "eip155:1", asset: "USDC", amount: "0.25", payTo: "0xpayee" }))({
    path: "/v1/issuer-evidence", headers: { "payment-signature": "forged" }, body: {},
  });
  assert.equal(response.status, 402);
  assert.equal(response.body.error, "payment-refused");
});

test("wrong product and unavailable optional capability refuse explicitly", async () => {
  const productMismatch = createX402BrokerageBorder({ payTo: "0xpayee", facilitator: "https://facilitator.example", verifyAndSettle: settled,
    providers: { "issuer-evidence-packet": Object.assign(async () => ({}), { productService: "aggressive-alpha-research-packet", originatingActor: "urn:ame:wrong-product" }) } });
  const wrongProduct = await productMismatch({ path: "/v1/issuer-evidence", headers: { "payment-signature": "paid" }, body: {} });
  assert.equal(wrongProduct.status, 503);
  assert.equal(wrongProduct.body.error, "product-provider-product-mismatch");
  const wrongActor = createX402BrokerageBorder({ payTo: "0xpayee", facilitator: "https://facilitator.example", verifyAndSettle: settled,
    providers: { "issuer-evidence-packet": Object.assign(async () => ({}), { originatingActor: "" }) } });
  const actorResponse = await wrongActor({ path: "/v1/issuer-evidence", headers: { "payment-signature": "paid" }, body: {} });
  assert.equal(actorResponse.body.error, "product-provider-actor-invalid");
  const issuer = createIssuerEvidenceProvider({ issuerEvidence: {} });
  await assert.rejects(issuer.preflight({}), /optional-product-capability-unavailable:issuer-evidence/u);
});
