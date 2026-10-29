import { test } from "node:test";
import assert from "node:assert/strict";
import { volatilityRegimeSignalsFromSeries } from "../scripts/adapt-volatility-regime-signal.mjs";

function dateSeries(prices) {
  return prices.map((price, index) => ({ date: new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10), price }));
}

test("volatilityRegimeSignalsFromSeries: a calm-then-shock series reads 'decrease' (elevated regime) at the shock", () => {
  const calm = Array.from({ length: 30 }, () => 100 + (Math.random() - 0.5) * 0.01);
  const shockIndex = 30;
  const shocked = [...calm];
  for (let index = shockIndex; index < shockIndex + 10; index += 1) shocked.push(100 * (1 + (index % 2 === 0 ? 0.08 : -0.08)));
  const series = dateSeries(shocked);
  const signals = volatilityRegimeSignalsFromSeries(series, "X", 3, 20, 1.3);
  assert.ok(signals.length > 0);
  assert.ok(signals.every((signal) => signal.independenceTag === "volatility-regime-3-20"));
  const lastSignal = signals[signals.length - 1];
  assert.equal(lastSignal.direction, "decrease");
});

test("volatilityRegimeSignalsFromSeries: a uniformly calm series (constant dispersion) has a mean regime ratio near 1 -- low mean strength, no systematic regime shift", () => {
  let seed = 7;
  const prices = Array.from({ length: 80 }, () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return 100 + ((seed / 0x7fffffff) - 0.5) * 0.5;
  });
  const series = dateSeries(prices);
  const signals = volatilityRegimeSignalsFromSeries(series, "X", 3, 20, 1.3);
  const meanStrength = signals.reduce((sum, signal) => sum + signal.strength, 0) / signals.length;
  assert.ok(meanStrength < 0.5, `expected low mean strength (ratio near 1) on a uniformly calm series, got mean strength ${meanStrength}`);
});

test("volatilityRegimeSignalsFromSeries: refuses no look-ahead by construction (signal count never exceeds series length minus longWindow)", () => {
  const series = dateSeries(Array.from({ length: 40 }, (_, i) => 100 + i));
  const signals = volatilityRegimeSignalsFromSeries(series, "X", 3, 20, 1.3);
  assert.equal(signals.length, 40 - 20);
});
