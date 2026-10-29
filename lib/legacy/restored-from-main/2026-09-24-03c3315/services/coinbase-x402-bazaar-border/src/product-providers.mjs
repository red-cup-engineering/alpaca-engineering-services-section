import { randomUUID } from "node:crypto";
import { admitNormalizedSemanticContent, EMPTY_WITNESS_ROOT, identifyJsonSemanticContent, identifyNormalizedSemanticContent } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-expression-notation/runtime";
import { inferTy } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-expression-notation/typing";

const semanticId = (value) => identifyJsonSemanticContent({ objectKind: "brokerage.coinbase-x402-bazaar-border.record", value, witnessRoot: EMPTY_WITNESS_ROOT }).id;
import { createStrategySynthesisProvider } from "./strategy-synthesis-provider.mjs";
// TypeError, not Error: an unresolvable optional capability is a request
// this deployment cannot admit, the same class of refusal a malformed body
// is -- the transport-era caller (server.mjs, deleted) mapped it to 422 for
// the same reason; market.561.group's own convention maps a validate
// binding's TypeError to 422 automatically.
const unavailable = (name, cause) => new TypeError(`optional-product-capability-unavailable:${name}${cause?.code ? `:${cause.code}` : ""}`);
async function capability(name, injected, load) {
  if (injected) return injected;
  try { return await load(); } catch (error) { throw unavailable(name, error); }
}

// Divination's own precondition/postcondition/refusal terms are private to
// its module (not exported) but are content-addressed and stable; this
// border hires Divination the same way its own test suite constructs a
// proposal (see divination/test/contract-daily-reading.test.mjs), by
// naming these three fixed ni:///sha-256 identifiers directly.
const DIVINATION_PRECONDITION = "ni:///sha-256;ntxOpkBcnbGVC6NeD1y4X54yLK7GmBmNf2ul7IhJV2I";
const DIVINATION_POSTCONDITION = "ni:///sha-256;am0o7fpff-A8Q_SdJFQDw0zJYBdAr8Q8EQEw4V0dWj4";
const DIVINATION_REFUSAL = "ni:///sha-256;IebXWZ-MmX6I7pLllQ4vNRHP9SdWr32AE_pC-w15YMk";
const DEFAULT_DIVINATION_BASE_URL = "http://127.0.0.1:8798";
const termContent = (term, objectKind) => identifyNormalizedSemanticContent({ objectKind, semanticType: inferTy([], term), term, witnessRoot: EMPTY_WITNESS_ROOT });
const termId = (term, objectKind) => termContent(term, objectKind).token;

function divinationProposalEnvelope(date, tradition, callerAccount, contract) {
  const operation = ["pair", ["mark", date], ["mark", tradition]];
  const cell = Object.freeze({
    law: contract.CONTRACT, caller: callerAccount, provider: contract.ACCOUNT,
    precondition: DIVINATION_PRECONDITION, operation: termId(operation, "brokerage-control.divination-operation"), postcondition: DIVINATION_POSTCONDITION, refusal: DIVINATION_REFUSAL,
    evidenceRoot: termId(["mark", "proposal-at-four-bottom"], "brokerage-control.evidence-root"), outcome: { positiveEvidence: false, negativeEvidence: false },
    measures: Object.freeze([
      { dimension: "asset", quantity: "0", unit: "none" }, { dimension: "compute", quantity: "1", unit: "daily-reading" },
      { dimension: "erasure", quantity: "0", unit: "alternative" }, { dimension: "gas", quantity: "0", unit: "gas" },
      { dimension: "time", quantity: "0", unit: "millisecond" }, { dimension: "wit", quantity: "0", unit: "typed-four-cover" },
    ]), parent: null,
  });
  // Divination admits its proposal as JSON semantic content {cell, operation}.
  const { token: id, bytes } = identifyJsonSemanticContent({ objectKind: "divination.daily-reading-proposal", value: { cell, operation }, witnessRoot: EMPTY_WITNESS_ROOT });
  return {
    "@context": contract.CONTEXT, id: `urn:uuid:${randomUUID()}`, type: "Accept", actor: "urn:ame:coinbase-x402-bazaar-border", target: contract.ACTOR,
    object: {
      type: "ServiceContract", contract: contract.CONTRACT, callerAccount,
      proposal: { type: "Document", id, mediaType: "application/sen+cbor", content: bytes.toString("base64") },
    },
  };
}

/**
 * Hires the running Divination sovereign enterprise (port 8798 by default)
 * over its own ActivityStreams contract endpoint for one daily reading.
 * This function is only ever invoked by the border AFTER x402 settlement;
 * cheap, local, pure validation happens in .preflight below, so an unpaid
 * probe never reaches the network.
 */
export function createDivinationReadingProvider(env = process.env, dependencies = {}) {
  const baseUrl = env.DIVINATION_BASE_URL || DEFAULT_DIVINATION_BASE_URL;
  const callerAccount = env.BROKERAGE_X402_ACCOUNT || "eip155:31337:0x4c9a7b985d461cdd341dcdbd52d76473c66f4f5d";
  const fetchImpl = dependencies.fetch || globalThis.fetch;
  let divination;
  const resolveDivination = async () => {
    if (divination) return divination;
    const reading = await capability("divination-daily-reading", dependencies.divinationReading, () => import("@lenticule-science/divination-services-section/rmn-daily-reading"));
    const contract = await capability("divination-contract", dependencies.divinationContract, () => import("@lenticule-science/divination-services-section/contract-daily-reading"));
    if (typeof reading.computeDailyReadingTerm !== "function" || !contract.ACCOUNT || !contract.ACTOR || !contract.CONTEXT || !contract.CONTRACT) throw unavailable("divination-daily-reading");
    divination = { computeDailyReadingTerm: reading.computeDailyReadingTerm, ...contract };
    return divination;
  };

  const provider = async function divinationReadingProvider(request) {
    const date = request?.date, tradition = request?.tradition;
    const law = await resolveDivination();
    law.computeDailyReadingTerm(date, tradition); // cheap local re-validation; throws the same way preflight does
    const envelope = divinationProposalEnvelope(date, tradition, callerAccount, law);
    const response = await fetchImpl(`${baseUrl}/contracts/daily-reading`, {
      method: "POST", headers: { "content-type": "application/activity+json" }, body: JSON.stringify(envelope),
    });
    const result = await response.json();
    if (result?.type !== "Accept" || result.object?.disposition !== "completion") {
      throw new Error(`divination-refused:${result?.object?.disposition ?? result?.object?.type ?? "unreachable"}`);
    }
    const reading = (result.object.attachment ?? []).find((entry) => entry.profile === "org.emsenn.divination.daily-reading.v1");
    if (!reading) throw new Error("divination-reading-attachment-missing");
    return {
      id: result.object.witness, date, tradition, disposition: result.object.disposition,
      evidence: result.object.evidence, witness: result.object.witness,
      reading: { id: reading.id, mediaType: reading.mediaType, contentBase64: reading.content },
    };
  };
  provider.preflight = async (request) => { (await resolveDivination()).computeDailyReadingTerm(request?.date, request?.tradition); };
  provider.originatingActor = "urn:ame:divination-daily-reading";
  provider.externalEvidence = (_request, output) => [
    { uri: `${provider.originatingActor}#evidence`, digest: output.evidence },
    { uri: `${provider.originatingActor}#witness`, digest: output.witness },
  ];
  return provider;
}

const DEFAULT_OCCUPATION_ENTROPY_AGENT_URL = "http://127.0.0.1:8812/.well-known/agent-card.json";

function decorateProvider(provider, { actor, preflight, evidence }) {
  Object.defineProperties(provider, {
    originatingActor: { value: actor, enumerable: true },
    preflight: { value: preflight, enumerable: true },
    externalEvidence: { value: evidence, enumerable: true },
  });
  return provider;
}

export function createIssuerEvidenceProvider(dependencies = {}) {
  const resolve = () => capability("issuer-evidence", dependencies.issuerEvidence, () => import("@red-cup-engineering/brokerage-control-api-federation/evidence-packet"));
  return decorateProvider(async (request) => {
    const { formIssuerEvidencePacket } = await resolve();
    if (typeof formIssuerEvidencePacket !== "function") throw unavailable("issuer-evidence");
    return formIssuerEvidencePacket(request);
  }, {
    actor: "urn:ame:issuer-research-media-service",
    preflight: async (request) => { const { validateIssuerEvidenceRequest } = await resolve(); if (typeof validateIssuerEvidenceRequest !== "function") throw unavailable("issuer-evidence"); validateIssuerEvidenceRequest(request); },
    evidence: (request, output) => request.sources.map((source) => ({ uri: source.uri, digest: source.digest })).concat({ uri: `urn:brokerage:issuer-evidence:${output.ticker}`, digest: output.id }),
  });
}

export function createAggressiveAlphaProvider(dependencies = {}) {
  const resolve = () => capability("alpha-portfolio-order-intent", dependencies.alphaPortfolioIntent, () => import("@red-cup-engineering/alpha-portfolio-order-intent-service"));
  return decorateProvider(async (request) => {
    const { formAggressivePortfolioIntent } = await resolve();
    if (typeof formAggressivePortfolioIntent !== "function") throw unavailable("alpha-portfolio-order-intent");
    const intent = formAggressivePortfolioIntent(request);
    return Object.freeze({
      type: "AggressiveAlphaAnalysisPacket", version: 1, id: intent.id,
      symbol: intent.symbol, side: intent.side, notional: intent.notional,
      maximumLoss: intent.maximumLoss, concentration: intent.concentration,
      thesis: intent.thesis, falsifier: intent.falsifier,
      liquidityPremise: intent.liquidityPremise, executionPremise: intent.executionPremise,
      scenarios: intent.scenarios, evidence: intent.evidence, policyDigest: intent.policyDigest,
      effect: "analysis-only", liveVenueEffect: false,
    });
  }, {
    actor: "urn:ame:alpha-portfolio-order-intent-service",
    preflight: async (request) => { const { validateAggressivePortfolioIntentRequest } = await resolve(); if (typeof validateAggressivePortfolioIntentRequest !== "function") throw unavailable("alpha-portfolio-order-intent"); validateAggressivePortfolioIntentRequest(request); },
    evidence: (request, output) => request.evidencePackets.map((packet) => ({ uri: `urn:brokerage:issuer-evidence:${packet.id}`, digest: packet.id })).concat({ uri: `urn:brokerage:aggressive-alpha:${output.symbol}`, digest: output.id }),
  });
}

export function createPaperIntentProvider(dependencies = {}) {
  const resolve = () => capability("alpha-portfolio-order-intent", dependencies.alphaPortfolioIntent, () => import("@red-cup-engineering/alpha-portfolio-order-intent-service"));
  return decorateProvider(async (request) => {
    const { formAggressivePortfolioIntent } = await resolve();
    if (typeof formAggressivePortfolioIntent !== "function") throw unavailable("alpha-portfolio-order-intent");
    return formAggressivePortfolioIntent(request);
  }, {
    actor: "urn:ame:alpha-portfolio-order-intent-service",
    preflight: async (request) => { const { validateAggressivePortfolioIntentRequest } = await resolve(); if (typeof validateAggressivePortfolioIntentRequest !== "function") throw unavailable("alpha-portfolio-order-intent"); validateAggressivePortfolioIntentRequest(request); },
    evidence: (_request, output) => [{ uri: `urn:brokerage:paper-intent:${output.symbol}`, digest: output.id }],
  });
}

export function createAccountReconciliationProvider(dependencies = {}) {
  const resolve = () => capability("account-evidence-reconciliation", dependencies.accountReconciliation, () => import("@red-cup-engineering/account-evidence-reconciliation-service"));
  const normalizeRequest = async (request) => {
    const { normalizeAlpacaSnapshot } = await resolve();
    if (typeof normalizeAlpacaSnapshot !== "function") throw unavailable("account-evidence-reconciliation");
    const normalize = (value) => value?.type === "NormalizedBrokerageAccountSnapshot" ? value : normalizeAlpacaSnapshot(value);
    return { expected: normalize(request?.expected), observed: normalize(request?.observed), ...(request?.tolerances ? { tolerances: request.tolerances } : {}) };
  };
  return decorateProvider(async (request) => {
    const { reconcileSnapshots } = await resolve();
    if (typeof reconcileSnapshots !== "function") throw unavailable("account-evidence-reconciliation");
    return reconcileSnapshots(await normalizeRequest(request));
  }, {
    actor: "urn:ame:account-evidence-reconciliation-service",
    preflight: async (request) => { const { reconcileSnapshots } = await resolve(); if (typeof reconcileSnapshots !== "function") throw unavailable("account-evidence-reconciliation"); reconcileSnapshots(await normalizeRequest(request)); },
    evidence: (_request, output) => [{ uri: `urn:brokerage:account-reconciliation:${encodeURIComponent(output.accountReference)}`, digest: output.id }],
  });
}

export { createStrategySynthesisProvider };


function isNonNegSafeInt(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validateOccupation(occupation) {
  if (!Array.isArray(occupation) || occupation.length === 0 || !occupation.every(isNonNegSafeInt)) {
    // TypeError, not Error: this runs from .preflight too, where a malformed
    // request must map to a refusal (422), not an internal error (500).
    throw new TypeError("occupation must be a non-empty array of non-negative safe integers");
  }
}

/**
 * Hires the occupation-entropy-readout die's signed A2A face — its only
 * served face (2026-07-24) — for one Boltzmann
 * occupation-entropy readout: one RMN Mark request in, one Mark result out.
 * Like the Divination provider above, this border only ever calls the die's
 * provider AFTER x402 settlement; cheap, local, pure validation happens in
 * .preflight below, so an unpaid probe never reaches the network.
 */
export function createOccupationEntropyProvider(env = process.env, dependencies = {}) {
  const agentUrl = env.OCCUPATION_ENTROPY_AGENT_URL || DEFAULT_OCCUPATION_ENTROPY_AGENT_URL;
  const resolveA2a = () => capability("occupation-entropy-a2a", dependencies.a2a, async () => ({
    ...(await import("@red-cup-engineering/computer-inference-engine/dispatch/sovereign-provider-interface")),
    ...(await import("@red-cup-engineering/a2a-services-section/rmn-part")),
    ...(await import("@red-cup-engineering/a2a-services-section/a2a-client")),
  }));

  const provider = async function occupationEntropyProvider(request) {
    validateOccupation(request?.occupation);
    const { SOVEREIGN_CIRCUIT_INTERFACE_EXTENSION, extractSenPart, userSenMessage, a2aResultMetadata, a2aResultParts, sendSenTask } = await resolveA2a();
    if (![SOVEREIGN_CIRCUIT_INTERFACE_EXTENSION, extractSenPart, userSenMessage, a2aResultMetadata, a2aResultParts, sendSenTask].every(Boolean)) throw unavailable("occupation-entropy-a2a");
    const bytes = termContent(["mark", JSON.stringify({ occupation: request.occupation })], "brokerage-control.occupation-request").bytes;
    const exchange = await sendSenTask({
      agentUrl,
      extensions: [SOVEREIGN_CIRCUIT_INTERFACE_EXTENSION],
      requireSignature: true,
      message: userSenMessage(bytes, "occupation-entropy-request.rmn.cbor", randomUUID()),
      signal: AbortSignal.timeout(20_000),
    });
    if (a2aResultMetadata(exchange.result).disposition !== "completion") throw new Error("occupation-entropy-readout-refused");
    const term = admitNormalizedSemanticContent(extractSenPart(a2aResultParts(exchange.result)).bytes).envelope.settledBody;
    if (!Array.isArray(term) || term[0] !== "mark") throw new Error("occupation-entropy-readout-refused:result was not one Mark term");
    return JSON.parse(term[1]);
  };
  provider.preflight = async (request) => { validateOccupation(request?.occupation); };
  provider.originatingActor = "urn:ame:occupation-entropy-readout";
  provider.externalEvidence = (_request, output) => [
    { uri: "urn:ame:occupation-entropy-readout#certificate", digest: semanticId(output?.certificate ?? null) },
  ];
  return provider;
}

export function createDefaultProviders(env = process.env, dependencies = {}) {
  return {
    issuer: createIssuerEvidenceProvider(dependencies),
    alpha: createAggressiveAlphaProvider(dependencies),
    paperIntent: createPaperIntentProvider(dependencies),
    reconcile: createAccountReconciliationProvider(dependencies),
    strategySynthesis: createStrategySynthesisProvider(env, dependencies),
    divinationReading: createDivinationReadingProvider(env, dependencies),
    occupationEntropy: createOccupationEntropyProvider(env, dependencies),
  };
}

/**
 * Select the subset of a providers map to actually wire live, by explicit
 * product key allowlist. Excluded keys are dropped entirely (never merely
 * disabled in place) so `providerAvailable` sees them as absent and the
 * x402 payment boundary refuses those routes pre-payment, before any
 * settlement — this is the catalog-shrink lever for products a quality
 * pass finds thin, stub, or dependent on infrastructure unreachable from
 * the deployed host, without deleting their source.
 * @param {Record<string, Function>} providers - the full provider map, e.g. from createDefaultProviders.
 * @param {string[]|undefined} enabledKeys - product keys to keep; undefined keeps every key (default, backward-compatible).
 * @returns {Record<string, Function>} the filtered providers map.
 */
export function selectEnabledProviders(providers, enabledKeys) {
  if (enabledKeys === undefined) return providers;
  return Object.fromEntries(enabledKeys.filter((key) => key in providers).map((key) => [key, providers[key]]));
}
