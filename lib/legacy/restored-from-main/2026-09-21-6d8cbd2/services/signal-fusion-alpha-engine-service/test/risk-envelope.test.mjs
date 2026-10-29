import { test } from "node:test";
import assert from "node:assert/strict";
import { createRiskEnvelope, armRiskEnvelope, checkAutoHalt, assertNoLiabilityBeyondStake } from "../src/risk-envelope.mjs";

function envelope(overrides = {}) {
  return createRiskEnvelope({ riskStakeAmount: 1000, admittedStrategies: ["btc-momentum"], autoHaltDrawdownFloor: 0.5, ...overrides });
}

test("createRiskEnvelope: starts unarmed", () => {
  assert.equal(envelope().armed, false);
});

test("armRiskEnvelope: the one-time founder hands step arms the envelope", () => {
  const armed = armRiskEnvelope(envelope(), { armedAt: "2026-09-01T00:00:00Z", signingCapabilityRef: "wallet-ref-1" });
  assert.equal(armed.armed, true);
  assert.equal(armed.signingCapabilityRef, "wallet-ref-1");
});

test("armRiskEnvelope: refuses to arm an already-armed envelope", () => {
  const armed = armRiskEnvelope(envelope(), { armedAt: "2026-09-01T00:00:00Z", signingCapabilityRef: "ref" });
  assert.throws(() => armRiskEnvelope(armed, { armedAt: "2026-09-02T00:00:00Z", signingCapabilityRef: "ref2" }), TypeError);
});

test("checkAutoHalt: no halt above the drawdown floor", () => {
  const result = checkAutoHalt(envelope(), 800);
  assert.equal(result.halt, false);
});

test("checkAutoHalt: automatic halt at or beyond the floor -- never a human-permission request", () => {
  const result = checkAutoHalt(envelope(), 500);
  assert.equal(result.halt, true);
  assert.ok(result.reason.includes("auto-halt"));
});

test("assertNoLiabilityBeyondStake: admits a notional within the stake", () => {
  const result = assertNoLiabilityBeyondStake(600, envelope());
  assert.equal(result.admitted, true);
  assert.equal(result.notional, 600);
});

test("assertNoLiabilityBeyondStake: clamps -- never leverages -- a notional beyond the stake", () => {
  const result = assertNoLiabilityBeyondStake(1500, envelope());
  assert.equal(result.admitted, false);
  assert.equal(result.notional, 1000);
});
