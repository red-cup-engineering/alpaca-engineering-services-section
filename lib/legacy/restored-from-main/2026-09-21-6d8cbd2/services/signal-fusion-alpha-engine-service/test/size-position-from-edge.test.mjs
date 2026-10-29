import { test } from "node:test";
import assert from "node:assert/strict";
import { kellyFraction } from "@red-cup-engineering/position-sizing-service";
import { sizeStakeFromKellyFraction } from "../scripts/size-position-from-edge.mjs";

// The Kelly formula itself now lives once in @red-cup-engineering/position-sizing-service;
// these first four cases are the same numeric assertions the retired src/kelly-sizing.mjs
// carried for its computeKellyFraction, ported to the shared upstream function (clamped to
// >= 0 here exactly as the retired local wrapper did).

test("kellyFraction: classic formula, p=0.6 R=1 -> f*=0.2", () => {
  const f = Math.max(0, kellyFraction({ winProbability: 0.6, payoffRatio: 1 }));
  assert.ok(Math.abs(f - 0.2) < 1e-9);
});

test("kellyFraction: a coin-flip edge (p=0.5, R=1) gives zero", () => {
  const f = Math.max(0, kellyFraction({ winProbability: 0.5, payoffRatio: 1 }));
  assert.ok(Math.abs(f - 0) < 1e-9);
});

test("kellyFraction: a losing edge never goes negative once clamped -- 'no bet'", () => {
  const f = Math.max(0, kellyFraction({ winProbability: 0.3, payoffRatio: 0.01 / 0.02 }));
  assert.equal(f, 0);
});

test("kellyFraction: refuses a non-positive payoffRatio (the upstream owner's own contract: RangeError, not TypeError)", () => {
  assert.throws(() => kellyFraction({ winProbability: 0.6, payoffRatio: 0 }), RangeError);
});

// sizeStakeFromKellyFraction is this consumer's own structural leverage clamp, not Kelly math --
// it stayed local when src/kelly-sizing.mjs was retired. Same numeric assertions as the retired
// sizeRiskStake.

test("sizeStakeFromKellyFraction: sizes full Kelly against the stake with no haircut", () => {
  const result = sizeStakeFromKellyFraction({ riskStakeAmount: 1000, kellyFraction: 0.2 });
  assert.equal(result.notional, 200);
  assert.equal(result.cappedByUnleveredStake, false);
});

test("sizeStakeFromKellyFraction: 'or beyond' -- an aggressionMultiplier past full Kelly is honored up to the stake", () => {
  const result = sizeStakeFromKellyFraction({ riskStakeAmount: 1000, kellyFraction: 0.4, aggressionMultiplier: 2 });
  assert.equal(result.appliedFraction, 0.8);
  assert.equal(result.notional, 800);
});

test("sizeStakeFromKellyFraction: the ONLY clamp is the unlevered stake ceiling, never a fractional-Kelly caution haircut", () => {
  const result = sizeStakeFromKellyFraction({ riskStakeAmount: 500, kellyFraction: 0.9, aggressionMultiplier: 3 });
  assert.equal(result.notional, 500);
  assert.equal(result.cappedByUnleveredStake, true);
});

test("sizeStakeFromKellyFraction: refuses a non-positive riskStakeAmount", () => {
  assert.throws(() => sizeStakeFromKellyFraction({ riskStakeAmount: 0, kellyFraction: 0.2 }), TypeError);
});
