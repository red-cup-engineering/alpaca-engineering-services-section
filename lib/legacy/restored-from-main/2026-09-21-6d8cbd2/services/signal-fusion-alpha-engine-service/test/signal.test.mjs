import { test } from "node:test";
import assert from "node:assert/strict";
import { createSignal } from "../src/signal.mjs";

const VALID = { source: "koios-news", sourceKind: "koios-news", entity: "BTC", observedAt: "2026-08-30T00:00:00Z", direction: "increase", strength: 0.6, independenceTag: "koios-economy-claims", description: "a claim" };

test("createSignal: accepts a well-formed signal", () => {
  const signal = createSignal(VALID);
  assert.equal(signal.entity, "BTC");
  assert.ok(Object.isFrozen(signal));
});

test("createSignal: refuses an unknown sourceKind", () => {
  assert.throws(() => createSignal({ ...VALID, sourceKind: "rumor" }), TypeError);
});

test("createSignal: refuses an unknown direction", () => {
  assert.throws(() => createSignal({ ...VALID, direction: "sideways" }), TypeError);
});

test("createSignal: refuses strength outside [0,1]", () => {
  assert.throws(() => createSignal({ ...VALID, strength: 1.5 }), TypeError);
});

test("createSignal: refuses an unparseable observedAt", () => {
  assert.throws(() => createSignal({ ...VALID, observedAt: "not-a-date" }), TypeError);
});

test("createSignal: accepts neutral direction (an adapter's explicit abstention)", () => {
  const signal = createSignal({ ...VALID, direction: "neutral" });
  assert.equal(signal.direction, "neutral");
});
