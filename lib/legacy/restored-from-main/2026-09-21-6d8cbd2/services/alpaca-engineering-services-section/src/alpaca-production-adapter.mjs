import { createBrokerageAuthorityCustody } from "@red-cup-engineering/brokerage-authority-custody-service";
import { createBrokerageMarketEventRecorder } from "@red-cup-engineering/brokerage-independent-witness-and-books";
import { createAlpacaAdapter } from "@red-cup-engineering/pluggable-venue-adapter-service/alpaca";

const required = (value, label) => { if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label}-required`); return value.trim(); };
const safeTransport = (fetchImpl) => async ({ method, url, headers, body }) => {
  const response = await fetchImpl(url, { method, headers: body === undefined ? headers : { ...headers, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const raw = response.status === 204 ? "" : await response.text();
  let parsed = null;
  if (raw) { try { parsed = JSON.parse(raw); } catch { throw new TypeError("alpaca-json-response-required"); } }
  return { status: response.status, headers: { "x-request-id": response.headers?.get?.("x-request-id") ?? null }, body: parsed };
};

export async function createAdapter(configuration, dependencies = {}) {
  const grant = configuration?.authorityGrant, contract = configuration?.contract;
  const keyName = required(configuration?.credentials?.keyEnvironmentVariable, "credential-key-environment-variable");
  const secretName = required(configuration?.credentials?.secretEnvironmentVariable, "credential-secret-environment-variable");
  const environment = dependencies.environment ?? process.env;
  const apiKeyId = required(environment[keyName], "configured-alpaca-key");
  const apiSecret = required(environment[secretName], "configured-alpaca-secret");
  if (grant?.credentialReference !== configuration.credentials.reference) throw new TypeError("credential-reference-binding-mismatch");
  const live = configuration.mode === "bounded-live", expectedVenue = live ? "alpaca-trading-live" : "alpaca-trading-paper";
  if (grant?.venue !== expectedVenue || contract?.venue !== expectedVenue) throw new TypeError("production-adapter-venue-mismatch");
  const credentialRecord = Object.freeze({ kind: live ? "alpaca-trading-api-key-live" : "alpaca-trading-api-key", environment: live ? "live" : "paper", venue: expectedVenue,
    principal: configuration.principal, accountReference: configuration.accountReference, credential: Object.freeze({ apiKeyId, apiSecret }) });
  const authorityCustody = dependencies.authorityCustody ?? Object.freeze({
    async store() { throw new TypeError("runtime-credential-store-refused"); },
    async retrieve(reference) { return reference === grant.credentialReference ? credentialRecord : undefined; },
    async revoke() { throw new TypeError("runtime-credential-revoke-refused"); },
  });
  const executionRecords = new Map();
  const resolveAuthorityGrant = async (reference) => reference === grant.id ? grant : undefined;
  const resolveOperationAuthorization = async (reference) => executionRecords.get(reference);
  const custody = createBrokerageAuthorityCustody({ authorityCustody, transport: safeTransport(dependencies.fetchImpl ?? fetch), resolveAuthorityGrant,
    resolvePaperOperationAuthorization: resolveOperationAuthorization, resolveLiveOperationAuthorization: resolveOperationAuthorization, clock: dependencies.clock });
  const venue = createAlpacaAdapter({ product: expectedVenue, baseUrl: live ? "https://api.alpaca.markets/" : "https://paper-api.alpaca.markets/", authorityClient: custody });
  const recordOutcome = dependencies.recordOutcome ?? createBrokerageMarketEventRecorder({ originatingActor: "urn:ame:alpaca-app", nodeId: required(configuration?.books?.nodeId, "books-node-id") },
    { BROKERAGE_BOOKS_DATA_ROOT: required(configuration?.books?.dataRoot, "books-data-root") }, { now: dependencies.clock });
  return Object.freeze({
    ...venue,
    registerExecutionRecords(records) { executionRecords.set(records.intent.id, records); },
    async cancelOrderByClientOrderId({ grant: cancellationGrant, clientOrderId, now }) {
      const observed = await venue.getOrderByClientOrderId({ grant: cancellationGrant, clientOrderId, now });
      if (observed.status < 200 || observed.status >= 300 || !observed.payload?.id) throw new TypeError("cancel-order-lookup-refused");
      const authorization = Object.freeze({ id: `cancel:${observed.payload.id}:${Date.parse(now)}`, type: live ? "LiveOrderCancellationAuthorization" : "PaperOrderCancellationAuthorization", authorityGrant: cancellationGrant.id,
        orderId: observed.payload.id, revoked: false, validUntil: new Date(Date.parse(now) + 5 * 60_000).toISOString() });
      executionRecords.set(authorization.id, authorization);
      return venue.cancelOrder({ grant: cancellationGrant, orderId: observed.payload.id, operationAuthorizationReference: authorization.id, now });
    },
    recordOutcome: async (outcome) => recordOutcome({ type: "alpaca-app-outcome", outcome, recordedAt: outcome.observedAt }),
  });
}
