import { test } from "node:test";
import assert from "node:assert/strict";
import { tStatisticFromInformationRatio, twoTailedPValue, benjaminiHochberg, bonferroniCorrection } from "../src/multiple-testing-correction.mjs";

test("twoTailedPValue: matches the standard normal critical values (t=1.96 -> ~0.05, t=2.576 -> ~0.01)", () => {
  assert.ok(Math.abs(twoTailedPValue(1.96) - 0.05) < 0.001);
  assert.ok(Math.abs(twoTailedPValue(2.576) - 0.01) < 0.001);
  assert.ok(Math.abs(twoTailedPValue(0) - 1) < 1e-6);
});

test("tStatisticFromInformationRatio: recovers a known t from informationRatio = t * sqrt(periodsPerYear/periods)", () => {
  const t = tStatisticFromInformationRatio({ informationRatio: 1, periods: 365, periodsPerYear: 365 });
  assert.ok(Math.abs(t - 1) < 1e-9);
});

test("benjaminiHochberg: matches the textbook step-up procedure on a known 6-value example", () => {
  const pValues = [0.005, 0.011, 0.019, 0.033, 0.050, 0.20];
  const result = benjaminiHochberg(pValues, 0.05);
  assert.deepEqual(result.significant, [true, true, true, true, false, false]);
  assert.equal(result.thresholdRank, 4);
});

test("benjaminiHochberg: all-null grid (uniform-ish large p-values) finds nothing significant", () => {
  const pValues = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
  const result = benjaminiHochberg(pValues, 0.10);
  assert.ok(result.significant.every((flag) => flag === false));
  assert.equal(result.thresholdRank, null);
});

test("benjaminiHochberg: refuses an empty array and an out-of-range q", () => {
  assert.throws(() => benjaminiHochberg([], 0.05), TypeError);
  assert.throws(() => benjaminiHochberg([0.05], 1.5), TypeError);
});

test("bonferroniCorrection: only the smallest of many p-values clears a strict grid-wide threshold", () => {
  const pValues = [0.005, 0.011, 0.019, 0.033, 0.050, 0.20];
  const result = bonferroniCorrection(pValues, 0.05);
  assert.deepEqual(result.significant, [true, false, false, false, false, false]);
  assert.ok(Math.abs(result.correctedAlpha - 0.05 / 6) < 1e-12);
});

test("bonferroniCorrection is at least as strict as benjaminiHochberg on the same grid", () => {
  const pValues = [0.002, 0.008, 0.02, 0.04, 0.09, 0.15, 0.3, 0.5, 0.7, 0.9];
  const bh = benjaminiHochberg(pValues, 0.10).significant;
  const bonf = bonferroniCorrection(pValues, 0.05).significant;
  bonf.forEach((isSignificant, index) => {
    if (isSignificant) assert.ok(bh[index], `Bonferroni-significant index ${index} should also be BH-significant`);
  });
});
