import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { measureFusedSignalEdge, beliefWeightFromSignals } from "../src/backtest-edge.mjs";
import { createSignal } from "../src/signal.mjs";
import { momentumSignalsFromSeries } from "../scripts/adapt-market-momentum-signal.mjs";

const FIXTURE_PATH = fileURLToPath(new URL("./fixtures/btc-365d-coingecko.json", import.meta.url));

function perfectSignalPeriods(prices) {
  // a perfect, non-causal-cheating fixture: the signal at day i correctly reads day i's own OWN realized outcome return sign,
  // giving the harness a genuine, deterministic edge to detect -- proving it is not always reporting ~0 regardless of input
  const coordinates = prices.map((_, index) => new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10));
  const periods = prices.map((price, index) => {
    const realizedReturn = index === 0 ? 0 : (prices[index] - prices[index - 1]) / prices[index - 1];
    const nextReturn = index + 1 < prices.length ? (prices[index + 1] - prices[index]) / prices[index] : 0;
    const signal = createSignal({ source: "perfect-oracle", sourceKind: "market-data", entity: "X", observedAt: `${coordinates[index]}T00:00:00Z`, direction: nextReturn >= 0 ? "increase" : "decrease", strength: 1, independenceTag: "oracle", description: "perfect foresight" });
    return { date: coordinates[index], signals: [signal], realizedReturn };
  });
  return { coordinates, periods };
}

test("measureFusedSignalEdge: a genuinely predictive signal shows a real, positive holdout edge (harness sanity check)", () => {
  // deterministic sawtooth so a perfect next-day-direction signal has real, non-fabricated hit rate
  const prices = Array.from({ length: 120 }, (_, i) => 100 * (1 + 0.02 * Math.sin(i / 3)));
  const { coordinates, periods } = perfectSignalPeriods(prices);
  const result = measureFusedSignalEdge({ coordinates, periods, entity: "X", beliefDirection: "increase", warmup: 20, horizon: 1, trainingWindow: 20, transactionCostBps: 0 });
  assert.ok(result.holdout.metrics.hitRate > 0.9, `expected near-perfect holdout hit rate, got ${result.holdout.metrics.hitRate}`);
  assert.ok(result.holdout.metrics.expectancy > 0, `expected positive holdout expectancy, got ${result.holdout.metrics.expectancy}`);
});

test("measureFusedSignalEdge: an uninformative (coin-flip) signal shows ~no edge -- guards against fabricated edge", () => {
  let seed = 42;
  const randomDirection = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff > 0.5 ? "increase" : "decrease"; };
  const prices = Array.from({ length: 200 }, (_, i) => 100 * (1 + 0.001 * Math.sin(i)));
  const coordinates = prices.map((_, index) => new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10));
  const periods = prices.map((price, index) => {
    const realizedReturn = index === 0 ? 0 : (prices[index] - prices[index - 1]) / prices[index - 1];
    const signal = createSignal({ source: "coin-flip", sourceKind: "market-data", entity: "X", observedAt: coordinates[index] + "T00:00:00Z", direction: randomDirection(), strength: 1, independenceTag: "coin-flip", description: "uninformative" });
    return { date: coordinates[index], signals: [signal], realizedReturn };
  });
  const result = measureFusedSignalEdge({ coordinates, periods, entity: "X", beliefDirection: "increase", warmup: 30, horizon: 1, trainingWindow: 30, transactionCostBps: 0 });
  assert.ok(Math.abs(result.holdout.metrics.hitRate - 0.5) < 0.2, `expected hit rate near 0.5 for an uninformative signal, got ${result.holdout.metrics.hitRate}`);
});

test("measureFusedSignalEdge: REAL BTC daily data + real causal momentum signal -- reports the honest measured stats (no look-ahead)", () => {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  const series = fixture.series.map((day) => ({ date: day.date, price: day.price }));
  const coordinates = series.map((day) => day.date);
  const momentumSignals = momentumSignalsFromSeries(series, "BTC");
  const momentumByDate = new Map(momentumSignals.map((signal) => [signal.observedAt.slice(0, 10), signal]));
  const periods = series.map((day, index) => {
    const realizedReturn = index === 0 ? 0 : (series[index].price - series[index - 1].price) / series[index - 1].price;
    const signal = momentumByDate.get(day.date);
    return { date: day.date, signals: signal ? [signal] : [], realizedReturn };
  });
  const result = measureFusedSignalEdge({ coordinates, periods, entity: "BTC", beliefDirection: "increase", warmup: 30, horizon: 1, trainingWindow: 30, transactionCostBps: 10, periodsPerYear: 365 });
  // this is a REAL measurement -- record it in the test output (see also the founding backtest-result journal record) rather than asserting a specific sign
  console.log("REAL BTC 3-day-momentum holdout metrics:", JSON.stringify(result.holdout.metrics));
  console.log("REAL BTC 3-day-momentum validation metrics:", JSON.stringify(result.validation.metrics));
  assert.equal(typeof result.holdout.metrics.hitRate, "number");
  assert.ok(result.holdout.metrics.hitRate >= 0 && result.holdout.metrics.hitRate <= 1);
  assert.ok(result.folds.holdout.length > 10, "expect a real holdout sample large enough to be informative");
});

test("beliefWeightFromSignals: abstains (weight 0) when no non-neutral signal exists for the entity", () => {
  const result = beliefWeightFromSignals([], "increase", "BTC");
  assert.equal(result.weight, 0);
  assert.equal(result.observationCount, 0);
});

test("beliefWeightFromSignals: refuses a malformed beliefDirection", () => {
  assert.throws(() => beliefWeightFromSignals([], "sideways", "BTC"), TypeError);
});
