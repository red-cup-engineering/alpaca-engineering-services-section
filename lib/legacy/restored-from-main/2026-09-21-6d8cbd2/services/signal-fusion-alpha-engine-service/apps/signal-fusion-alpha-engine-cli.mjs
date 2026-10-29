/**
 * The composed end-to-end face: real signal adapters (koios claims,
 * market momentum) -> fusion+backtest (measures the honest out-of-sample
 * edge) -> bounded-stake sizing -> a SIMULATED execution intent. Composes
 * scripts/ and src/ only, per import law; never fires a real order.
 */

import { readFileSync } from "node:fs";
import { fetchDailyPriceSeries, momentumSignalsFromSeries } from "../scripts/adapt-market-momentum-signal.mjs";
import { adaptKoiosNewsSignal } from "../scripts/adapt-koios-news-signal.mjs";
import { measureFusedSignalEdge } from "../src/backtest-edge.mjs";
import { sizePositionFromEdge } from "../scripts/size-position-from-edge.mjs";

async function loadPriceSeries(config) {
  if (config.priceSeriesFixturePath) {
    const fixture = JSON.parse(readFileSync(config.priceSeriesFixturePath, "utf8"));
    return fixture.series.map((day) => ({ date: day.date, price: day.price }));
  }
  return fetchDailyPriceSeries(config.priceSeriesLive);
}

function buildPeriods(series, koiosSignals) {
  const coordinates = series.map((day) => day.date);
  const momentumSignals = momentumSignalsFromSeries(series, koiosSignals.entity);
  const momentumByDate = new Map(momentumSignals.map((signal) => [signal.observedAt.slice(0, 10), signal]));
  const koiosByDate = new Map();
  for (const signal of koiosSignals.signals) {
    const date = signal.observedAt.slice(0, 10);
    if (!koiosByDate.has(date)) koiosByDate.set(date, []);
    koiosByDate.get(date).push(signal);
  }
  const periods = series.map((day, index) => {
    const signals = [...(momentumByDate.has(day.date) ? [momentumByDate.get(day.date)] : []), ...(koiosByDate.get(day.date) ?? [])];
    const realizedReturn = index === 0 ? 0 : (series[index].price - series[index - 1].price) / series[index - 1].price;
    return { date: day.date, signals, realizedReturn };
  });
  return { coordinates, periods };
}

/**
 * Runs the full pipeline: real signals -> fused belief -> measured
 * out-of-sample edge -> bounded-stake-sized simulated execution intent.
 * @param {object} config See `apps/signal-fusion-alpha-engine-cli.mjs`'s CLI usage for the full shape.
 * @returns {Promise<object>} `{backtest, sizing}` -- the measured edge and the resulting sizing/intent.
 */
export async function runSignalFusionAlphaEngine(config) {
  const series = await loadPriceSeries(config);
  const koiosSignals = adaptKoiosNewsSignal({ storeRoot: config.koiosStoreRoot, entity: config.entity, entityKeywords: config.entityKeywords });
  const { coordinates, periods } = buildPeriods(series, { entity: config.entity, signals: koiosSignals });
  const backtest = measureFusedSignalEdge({ coordinates, periods, entity: config.entity, beliefDirection: config.beliefDirection, warmup: config.warmup, horizon: config.horizon, trainingWindow: config.trainingWindow, transactionCostBps: config.transactionCostBps ?? 0, periodsPerYear: config.periodsPerYear ?? 365 });
  const sizing = sizePositionFromEdge({
    measuredEdge: backtest.holdout.metrics,
    envelope: config.envelope,
    aggressionMultiplier: config.aggressionMultiplier ?? 1,
    strategyId: config.strategyId,
    entity: config.entity,
    direction: config.beliefDirection,
    createdAt: new Date().toISOString(),
  });
  return { backtest, sizing };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , configPath] = process.argv;
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  runSignalFusionAlphaEngine(config).then((result) => console.log(JSON.stringify(result, null, 2)));
}
