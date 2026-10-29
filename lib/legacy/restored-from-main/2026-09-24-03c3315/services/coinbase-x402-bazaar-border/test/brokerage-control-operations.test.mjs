import assert from "node:assert/strict";
import test from "node:test";
import {
  reconcileAccountEvidence,
  validateDivinationReadingRequest,
  validateOccupationEntropyRequest,
  validateStrategySynthesisRequest,
} from "../src/brokerage-control-operations.mjs";

const source = { uri: "https://example.invalid/filing", observedAt: "2026-07-22T20:00:00.000Z", digest: "sha256:filing" };
const snapshot = (cash) => ({ accountReference: "acct-1", observedAt: "2026-07-22T22:20:00.000Z", source, account: { cash, equity: cash, buying_power: cash } });

test("reconcileAccountEvidence normalizes and reconciles a customer-supplied pair of raw Alpaca snapshots, market.561.group's own (body) operation", () => {
  const reconciled = reconcileAccountEvidence({ request: { expected: snapshot(100), observed: snapshot(100) } });
  assert.equal(reconciled.type, "BrokerageAccountReconciliation");
  assert.equal(reconciled.disposition, "reconciled");
  assert.equal(reconciled.mismatchCount, 0);
  const mismatched = reconcileAccountEvidence({ request: { expected: snapshot(100), observed: snapshot(50) } });
  assert.equal(mismatched.disposition, "mismatch");
  assert.ok(mismatched.mismatchCount > 0);
  assert.throws(() => reconcileAccountEvidence({}), TypeError);
});

test("validateOccupationEntropyRequest refuses a malformed occupation array before the market prices it, without any live agent dependency", async () => {
  await assert.rejects(() => validateOccupationEntropyRequest({ request: { occupation: [] } }, {}), TypeError);
  await assert.rejects(() => validateOccupationEntropyRequest({ request: { occupation: [-1] } }, {}), TypeError);
  await assert.doesNotReject(() => validateOccupationEntropyRequest({ request: { occupation: [1, 1] } }, {}));
});

test("validateStrategySynthesisRequest refuses a malformed or over-budget request before the market prices it", async () => {
  const bodyOf = (overrides) => ({
    request: {
      customerActor: "urn:example:customer",
      contextProduct: "ni:///sha-256;AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      incumbentProgram: "ni:///sha-256;BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      acceptanceSuite: "ni:///sha-256;CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      abi: "export function decide(input) -> plain JSON target scores or weights",
      populationSize: 1, maxTokensPerCandidate: 512, maximumWallClockMs: 60000,
      evidenceFacts: ["Public discovery example only."], allowedFeatureDependencies: ["momentum"], failureHistory: [], generation: 0,
      ...overrides,
    },
  });
  await assert.doesNotReject(() => validateStrategySynthesisRequest(bodyOf({}), {}));
  await assert.rejects(() => validateStrategySynthesisRequest(bodyOf({ populationSize: 4 }), {}), RangeError);
  await assert.rejects(() => validateStrategySynthesisRequest(bodyOf({ abi: 123 }), {}), TypeError);
});

test("validateDivinationReadingRequest refuses a malformed daily-reading request before the market prices it, by the same cheap local check the paid call re-runs", async () => {
  await assert.rejects(() => validateDivinationReadingRequest({ request: { date: "not-a-date", tradition: "rcl" } }, {}));
  await assert.doesNotReject(() => validateDivinationReadingRequest({ request: { date: "2026-01-01", tradition: "rcl" } }, {}));
});
