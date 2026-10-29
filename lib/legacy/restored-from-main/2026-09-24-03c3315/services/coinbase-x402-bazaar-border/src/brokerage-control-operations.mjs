import { normalizeAlpacaSnapshot, reconcileSnapshots } from "@red-cup-engineering/account-evidence-reconciliation-service";
import { createDivinationReadingProvider, createOccupationEntropyProvider } from "./product-providers.mjs";
import { createStrategySynthesisProvider } from "./strategy-synthesis-provider.mjs";

/**
 * The catalog-facing (body, env) operations for the three
 * coinbase-x402-bazaar-border routes whose own compute dispatches a live
 * call to an agent the *deployment* chooses (2026-09-11 founder ruling: one
 * x402 market, market.561.group; a compute binding that needs
 * deployment-supplied live dependencies takes them from `env`), plus one
 * small pure composition (`reconcileAccountEvidence`) this seller owns
 * because no single upstream export matches its historical
 * `{expected, observed}` request contract.
 *
 * The three agentic operations are thin (body, env) adapters over this
 * package's own provider factories (`./product-providers.mjs`,
 * `./strategy-synthesis-provider.mjs`), which already own the actual
 * conformance/dispatch logic; nothing here duplicates it.
 *
 * None of these functions verifies or settles payment, selects a
 * facilitator, or writes a settlement witness journal -- market.561.group
 * does all three, uniformly, for every offer in its catalog.
 */

// --- reconcile: this seller's own composition of the reconciliation ---
// library's normalize + reconcile steps, over its historical
// {expected, observed[, tolerances]} raw-or-normalized-snapshot contract. ---

function normalizedSnapshot(value) {
  return value?.type === "NormalizedBrokerageAccountSnapshot" ? value : normalizeAlpacaSnapshot(value);
}

/**
 * Reconcile one customer-supplied pair of Alpaca account snapshots
 * (`request.expected`, `request.observed`; either raw Alpaca-shaped or
 * already normalized), after the market has already priced and admitted
 * this call.
 * @param {{request: {expected: object, observed: object, tolerances?: object}}} body
 * @returns {object} The `BrokerageAccountReconciliation` record.
 */
export function reconcileAccountEvidence(body) {
  const request = body?.request;
  if (!request || typeof request !== "object") throw new TypeError("request-object-required");
  return reconcileSnapshots({
    expected: normalizedSnapshot(request.expected),
    observed: normalizedSnapshot(request.observed),
    ...(request.tolerances ? { tolerances: request.tolerances } : {}),
  });
}

// --- divination/daily-reading: hires the running Divination sovereign ---
// enterprise, per deployment, over env.DIVINATION_BASE_URL. ---

/**
 * Refuse a malformed daily-reading request before the market prices it.
 * @param {{request: {date: string, tradition: string}}} body
 * @param {{DIVINATION_BASE_URL?: string, BROKERAGE_X402_ACCOUNT?: string}} env
 */
export async function validateDivinationReadingRequest(body, env = {}) {
  await createDivinationReadingProvider(env).preflight(body?.request);
  return body;
}

/**
 * Hire the running Divination sovereign enterprise for one daily reading,
 * after the market has already priced and settled payment for it.
 * @param {{request: {date: string, tradition: string}}} body
 * @param {{DIVINATION_BASE_URL?: string, BROKERAGE_X402_ACCOUNT?: string}} env
 */
export async function readDailyDivination(body, env = {}) {
  return createDivinationReadingProvider(env)(body?.request);
}

// --- occupation-entropy: one signed A2A RMN task to the occupation- ---
// entropy-readout die, per deployment, over env.OCCUPATION_ENTROPY_AGENT_URL. ---

/**
 * Refuse a malformed occupation-entropy request before the market prices it.
 * @param {{request: {occupation: number[]}}} body
 * @param {{OCCUPATION_ENTROPY_AGENT_URL?: string}} env
 */
export async function validateOccupationEntropyRequest(body, env = {}) {
  await createOccupationEntropyProvider(env).preflight(body?.request);
  return body;
}

/**
 * Hire the occupation-entropy-readout die's signed A2A face for one
 * Boltzmann occupation-entropy readout, after the market has already priced
 * and settled payment for it.
 * @param {{request: {occupation: number[]}}} body
 * @param {{OCCUPATION_ENTROPY_AGENT_URL?: string}} env
 */
export async function readOccupationEntropy(body, env = {}) {
  return createOccupationEntropyProvider(env)(body?.request);
}

// --- strategies/synthesize: one bounded agentic strategy-synthesis work- ---
// lot call, per deployment, over env.INFERENCE_WORK_LOT_AGENT_CARD_URL, then ---
// an independent static assay of every candidate. ---

/**
 * Refuse a malformed or over-budget strategy-synthesis request before the
 * market prices it.
 * @param {{request: object}} body
 * @param {{INFERENCE_WORK_LOT_AGENT_CARD_URL?: string}} env
 */
export async function validateStrategySynthesisRequest(body, env = {}) {
  await createStrategySynthesisProvider(env).preflight(body?.request);
  return body;
}

/**
 * Synthesize one provider-distinct, independently statically assayed
 * strategy-program candidate population, after the market has already
 * priced and settled payment for it, through the inference work-lot agent
 * named by the deployment.
 * @param {{request: object}} body
 * @param {{INFERENCE_WORK_LOT_AGENT_CARD_URL?: string}} env
 */
export async function synthesizeStrategyProgram(body, env = {}) {
  return createStrategySynthesisProvider(env)(body?.request);
}
