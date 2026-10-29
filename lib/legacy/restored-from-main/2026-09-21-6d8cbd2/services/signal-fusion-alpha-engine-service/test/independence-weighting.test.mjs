import { test } from "node:test";
import assert from "node:assert/strict";
import { weightSignalsByIndependence } from "../src/independence-weighting.mjs";
import { createSignal } from "../src/signal.mjs";

function signal(overrides) {
  return createSignal({ source: "s", sourceKind: "koios-news", entity: "BTC", observedAt: "2026-08-30T00:00:00Z", direction: "increase", strength: 0.8, independenceTag: "tag-a", description: "d", ...overrides });
}

test("weightSignalsByIndependence: a lone tag is unaffected (divisor 1)", () => {
  const [weighted] = weightSignalsByIndependence([signal({ independenceTag: "solo" })]);
  assert.equal(weighted.effectiveStrength, weighted.strength);
  assert.equal(weighted.independenceGroupSize, 1);
});

test("weightSignalsByIndependence: four signals sharing a tag are shrunk by 1/sqrt(4)", () => {
  const four = [1, 2, 3, 4].map(() => signal({ independenceTag: "crowded" }));
  const weighted = weightSignalsByIndependence(four);
  weighted.forEach((signal) => {
    assert.equal(signal.independenceGroupSize, 4);
    assert.ok(Math.abs(signal.effectiveStrength - signal.strength / 2) < 1e-9);
  });
});

test("weightSignalsByIndependence: mixed tags shrink each group independently", () => {
  const signals = [signal({ independenceTag: "a" }), signal({ independenceTag: "a" }), signal({ independenceTag: "b" })];
  const weighted = weightSignalsByIndependence(signals);
  assert.equal(weighted[0].independenceGroupSize, 2);
  assert.equal(weighted[2].independenceGroupSize, 1);
});

test("weightSignalsByIndependence: refuses an empty array", () => {
  assert.throws(() => weightSignalsByIndependence([]), TypeError);
});
