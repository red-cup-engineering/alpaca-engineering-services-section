import { test } from "node:test";
import assert from "node:assert/strict";
import { createExecutionIntent } from "../src/execution-intent.mjs";
import { createRiskEnvelope, armRiskEnvelope } from "../src/risk-envelope.mjs";

function envelope() {
  return createRiskEnvelope({ riskStakeAmount: 1000, admittedStrategies: ["btc-momentum"], autoHaltDrawdownFloor: 0.5 });
}

test("createExecutionIntent: requiresHumanApproval is always false by construction", () => {
  const intent = createExecutionIntent({ strategyId: "btc-momentum", entity: "BTC", direction: "increase", sizedNotional: 200, envelope: envelope(), createdAt: "2026-09-01T00:00:00Z" });
  assert.equal(intent.requiresHumanApproval, false);
});

test("createExecutionIntent: wouldExecuteAutonomously tracks only whether the envelope is armed", () => {
  const unarmed = createExecutionIntent({ strategyId: "s", entity: "BTC", direction: "increase", sizedNotional: 100, envelope: envelope(), createdAt: "2026-09-01T00:00:00Z" });
  assert.equal(unarmed.wouldExecuteAutonomously, false);
  const armed = armRiskEnvelope(envelope(), { armedAt: "2026-09-01T00:00:00Z", signingCapabilityRef: "ref" });
  const withArmed = createExecutionIntent({ strategyId: "s", entity: "BTC", direction: "increase", sizedNotional: 100, envelope: armed, createdAt: "2026-09-01T00:00:00Z" });
  assert.equal(withArmed.wouldExecuteAutonomously, true);
});

test("createExecutionIntent: this pass is always simulated, never real capital", () => {
  const intent = createExecutionIntent({ strategyId: "s", entity: "BTC", direction: "decrease", sizedNotional: 50, envelope: envelope(), createdAt: "2026-09-01T00:00:00Z" });
  assert.equal(intent.simulatedOnly, true);
  assert.equal(intent.realCapitalAtRisk, false);
  assert.equal(intent.killSwitch, "automatic-circuit-breaker");
});

test("createExecutionIntent: refuses a malformed direction", () => {
  assert.throws(() => createExecutionIntent({ strategyId: "s", entity: "BTC", direction: "sideways", sizedNotional: 1, envelope: envelope(), createdAt: "2026-09-01T00:00:00Z" }), TypeError);
});
