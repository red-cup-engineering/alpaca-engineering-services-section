import { test } from "node:test";
import assert from "node:assert/strict";
import { signalsToBeliefObservations } from "../src/signal-to-belief-observations.mjs";
import { weightSignalsByIndependence } from "../src/independence-weighting.mjs";
import { createSignal } from "../src/signal.mjs";

function weighted(direction, independenceTag = `t-${Math.random()}`) {
  const signal = createSignal({ source: "s", sourceKind: "market-data", entity: "BTC", observedAt: "2026-08-30T00:00:00Z", direction, strength: 0.7, independenceTag, description: "d" });
  return weightSignalsByIndependence([signal])[0];
}

test("signalsToBeliefObservations: agreeing signal supports the belief", () => {
  const [observation] = signalsToBeliefObservations([weighted("increase")], "increase");
  assert.equal(observation.stance, "supports");
  assert.equal(observation.weight, weighted("increase").effectiveStrength);
});

test("signalsToBeliefObservations: disagreeing signal contradicts the belief", () => {
  const [observation] = signalsToBeliefObservations([weighted("decrease")], "increase");
  assert.equal(observation.stance, "contradicts");
});

test("signalsToBeliefObservations: neutral signals are dropped", () => {
  const observations = signalsToBeliefObservations([weighted("neutral")], "increase");
  assert.equal(observations.length, 0);
});

test("signalsToBeliefObservations: refuses an invalid beliefDirection", () => {
  assert.throws(() => signalsToBeliefObservations([weighted("increase")], "sideways"), TypeError);
});
