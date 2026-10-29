import { resolve } from "node:path";
import { createSemanticRecordJournal } from "@red-cup-engineering/semantic-record-journal-service";

const CATEGORY = "brokerage.coinbase-x402-bazaar.settlements";
const OBJECT_KIND = "brokerage.coinbase-x402-bazaar-border.settlement-record";
const DELIVERY_CATEGORY = "brokerage.coinbase-x402-bazaar.deliveries";
const WITNESS_ACTOR = "urn:ame:coinbase-x402-bazaar-border";
export function createBrokerageX402SettlementWitness(env = process.env, dependencies = {}) {
  const dataRoot = dependencies.dataRoot ?? env.BROKERAGE_X402_DATA_ROOT;
  if (typeof dataRoot !== "string" || !dataRoot) throw new TypeError("BROKERAGE_X402_DATA_ROOT-required");
  const journal = dependencies.journal ?? createSemanticRecordJournal({ root: resolve(dataRoot), objectKind: OBJECT_KIND });
  const now = dependencies.now ?? (() => new Date().toISOString());
  return async function appendSettlement(context) {
    const transaction = context?.result?.transaction, network = context?.result?.network, amount = context?.result?.amount ?? context?.requirements?.amount;
    if (typeof transaction !== "string" || typeof network !== "string" || amount == null) throw new TypeError("settled-brokerage-x402-context-incomplete");
    const recordedAt = now(), resource = String(context.requirements?.resource ?? context.resource ?? "unknown");
    const record = { type: "BrokerageX402SettlementWitness", version: 2, network, transaction, payer: context.result.payer ?? null, amount: String(amount), resource, recordedAt };
    return journal.record({ category: CATEGORY, recordedAt, record, charge: { support: true, refutation: false } });
  };
}

/** A local custody receipt: it records delivery, but never turns a product
 * provider into the witness or into a brokerage authority. */
export function createBrokerageOutcomeWitnessRecorder(env = process.env, dependencies = {}) {
  const dataRoot = dependencies.dataRoot ?? env.BROKERAGE_X402_DATA_ROOT;
  if (typeof dataRoot !== "string" || !dataRoot) throw new TypeError("BROKERAGE_X402_DATA_ROOT-required");
  const journal = dependencies.journal ?? createSemanticRecordJournal({ root: resolve(dataRoot), objectKind: OBJECT_KIND });
  const now = dependencies.now ?? (() => new Date().toISOString());
  return async function recordDelivery({ originatingActor, inputs, output, externalEvidence }) {
    if (typeof originatingActor !== "string" || !originatingActor || originatingActor === WITNESS_ACTOR || !Array.isArray(inputs) || !output || !Array.isArray(externalEvidence)) throw new TypeError("product-delivery-witness-input-invalid");
    const recordedAt = now();
    const record = { type: "CoinbaseX402ProductDeliveryWitness", version: 2, witnessActor: WITNESS_ACTOR, originatingActor, inputs, output, externalEvidence, recordedAt };
    const receipt = await journal.record({ category: DELIVERY_CATEGORY, recordedAt, record, charge: { support: true, refutation: false } });
    return Object.freeze({ type: "RecordedCoinbaseX402ProductDeliveryWitness", version: 2, witness: { id: receipt.id ?? receipt.token, ...record }, recordReceipt: receipt });
  };
}
