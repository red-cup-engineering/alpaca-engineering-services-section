/**
 * The widened, honest, multi-asset x multi-signal grid backtest, with
 * Benjamini-Hochberg/Bonferroni correction applied over the whole grid.
 * Real network I/O, zero execution: never places an order or arms a wallet.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fetchDailyPriceSeries, fetchHourlyPriceSeries, momentumSignalsFromSeries } from "../scripts/adapt-market-momentum-signal.mjs";
import { fetchYahooDailyPriceSeries, fetchYahooIntradayPriceSeries, equityMomentumSignalsFromSeries } from "../scripts/adapt-equity-price-signal.mjs";
import { volatilityRegimeSignalsFromSeries } from "../scripts/adapt-volatility-regime-signal.mjs";
import { adaptKoiosNewsSignal } from "../scripts/adapt-koios-news-signal.mjs";
import { fetchBitcoinActiveAddressSeries, activeAddressFlowSignalsFromSeries } from "../scripts/adapt-onchain-active-address-signal.mjs";
import { fetchChainTvlSeries, tvlFlowSignalsFromSeries } from "../scripts/adapt-defi-tvl-flow-signal.mjs";
import { fetchDeribitFundingRateHistory, fundingHistorySignalsFromRecords } from "../scripts/adapt-perp-funding-history-signal.mjs";
import { ENTITY_KOIOS_KEYWORDS } from "../scripts/entity-koios-keyword-catalog.mjs";
import { measureFusedSignalEdge } from "../src/backtest-edge.mjs";
import { kellyFraction as computeKellyFraction } from "@red-cup-engineering/position-sizing-service";
import { tStatisticFromInformationRatio, twoTailedPValue, benjaminiHochberg, bonferroniCorrection } from "../src/multiple-testing-correction.mjs";

const CRYPTO_ASSETS = Object.freeze([
  { entity: "BTC", coinId: "bitcoin", onchainActiveAddress: true, defiChain: null, deribitInstrument: "BTC-PERPETUAL" },
  { entity: "ETH", coinId: "ethereum", onchainActiveAddress: false, defiChain: "Ethereum", deribitInstrument: "ETH-PERPETUAL" },
  { entity: "SOL", coinId: "solana", onchainActiveAddress: false, defiChain: "Solana", deribitInstrument: null },
  { entity: "XRP", coinId: "ripple", onchainActiveAddress: false, defiChain: null, deribitInstrument: null },
  { entity: "ADA", coinId: "cardano", onchainActiveAddress: false, defiChain: null, deribitInstrument: null },
  { entity: "DOGE", coinId: "dogecoin", onchainActiveAddress: false, defiChain: null, deribitInstrument: null },
]);
const EQUITY_ASSETS = Object.freeze([
  { entity: "SPY", symbol: "SPY" },
  { entity: "QQQ", symbol: "QQQ" },
  { entity: "AAPL", symbol: "AAPL" },
  { entity: "MSFT", symbol: "MSFT" },
]);
const DAILY_FOLD_CONFIG = Object.freeze({ warmup: 30, horizon: 1, trainingWindow: 30, transactionCostBps: 10, periodsPerYear: 365 });
const INTRADAY_FOLD_CONFIG = Object.freeze({ warmup: 48, horizon: 1, trainingWindow: 48, transactionCostBps: 10, periodsPerYear: 24 * 365 });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries a keyless-public-API call with exponential backoff on HTTP 429 (rate limit) -- a real operational need once the grid fetches many assets from the same free-tier host. */
async function withRateLimitRetry(fn, { retries = 4, baseDelayMs = 4000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimited = /\b429\b/.test(error.message ?? "");
      if (!isRateLimited || attempt === retries) throw error;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
}

// Mirrors momentumSignalsFromSeries'/volatilityRegimeSignalsFromSeries' own observedAt normalization exactly, so a
// daily point ("YYYY-MM-DD") and an intraday point (full ISO) both key identically against their emitted signals --
// truncating to date-only here previously collapsed every intraday hour onto one coordinate (ordered-coordinates-required).
function canonicalKey(rawDate) {
  return rawDate.includes("T") ? new Date(rawDate).toISOString() : new Date(`${rawDate}T00:00:00Z`).toISOString();
}

function bucketSignalsByKey(signalArrays) {
  const byKey = new Map();
  for (const signals of signalArrays) {
    for (const signal of signals) {
      const key = canonicalKey(signal.observedAt);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(signal);
    }
  }
  return byKey;
}

/** Builds `measureFusedSignalEdge` input from a price series plus one or more named signal arrays, keyed to exact period identity (daily or intraday alike). */
function buildPeriods(series, signalArrays) {
  const keys = series.map((point) => canonicalKey(point.date));
  const byKey = bucketSignalsByKey(signalArrays);
  const periods = series.map((point, index) => ({
    date: keys[index],
    signals: byKey.get(keys[index]) ?? [],
    realizedReturn: index === 0 ? 0 : (series[index].price - series[index - 1].price) / series[index - 1].price,
  }));
  return { coordinates: keys, periods };
}

function runCombo({ asset, assetClass, timeframe, signalType, series, signalArrays, foldConfig, direction = "increase" }) {
  const { coordinates, periods } = buildPeriods(series, signalArrays);
  let backtest;
  try {
    backtest = measureFusedSignalEdge({ coordinates, periods, entity: asset, beliefDirection: direction, ...foldConfig });
  } catch (error) {
    return { asset, assetClass, timeframe, signalType, error: error.message };
  }
  const holdout = backtest.holdout.metrics;
  const tStatistic = holdout.periods > 1 ? tStatisticFromInformationRatio({ informationRatio: holdout.informationRatio, periods: holdout.periods, periodsPerYear: foldConfig.periodsPerYear }) : 0;
  const pValue = twoTailedPValue(tStatistic);
  const kellyFraction = holdout.averageWin > 0 && holdout.averageLoss > 0
    ? Math.max(0, computeKellyFraction({ winProbability: holdout.hitRate, payoffRatio: holdout.averageWin / holdout.averageLoss }))
    : 0;
  return {
    asset, assetClass, timeframe, signalType, direction,
    holdout: { periods: holdout.periods, hitRate: holdout.hitRate, expectancy: holdout.expectancy, informationRatio: holdout.informationRatio, maximumDrawdown: holdout.maximumDrawdown },
    tStatistic, pValue, kellyFraction,
  };
}

async function buildCryptoDailySignals(asset, storeRoot) {
  const series = await withRateLimitRetry(() => fetchDailyPriceSeries({ coinId: asset.coinId, days: 365 }));
  const momentum = momentumSignalsFromSeries(series, asset.entity);
  const volatility = volatilityRegimeSignalsFromSeries(series, asset.entity);
  const koios = adaptKoiosNewsSignal({ storeRoot, entity: asset.entity, entityKeywords: ENTITY_KOIOS_KEYWORDS[asset.entity] ?? [asset.entity.toLowerCase()] });
  const byType = { momentum, "volatility-regime": volatility, "koios-news": koios };
  if (asset.onchainActiveAddress) {
    await sleep(1500);
    const addressSeries = await withRateLimitRetry(() => fetchBitcoinActiveAddressSeries());
    byType["onchain-active-address-flow"] = activeAddressFlowSignalsFromSeries(addressSeries, asset.entity);
  }
  if (asset.defiChain) {
    await sleep(1500);
    const tvlSeries = await withRateLimitRetry(() => fetchChainTvlSeries({ chain: asset.defiChain }));
    byType["defi-tvl-flow"] = tvlFlowSignalsFromSeries(tvlSeries, asset.entity);
  }
  if (asset.deribitInstrument) {
    await sleep(1500);
    const endTimestampMs = Date.now();
    const startTimestampMs = endTimestampMs - 365 * 24 * 60 * 60 * 1000;
    const records = await withRateLimitRetry(() => fetchDeribitFundingRateHistory({ instrumentName: asset.deribitInstrument, startTimestampMs, endTimestampMs }));
    byType["perp-funding-rate-history"] = fundingHistorySignalsFromRecords(records, asset.entity);
  }
  return { series, byType };
}

async function buildEquityDailySignals(asset, storeRoot) {
  const series = await withRateLimitRetry(() => fetchYahooDailyPriceSeries({ symbol: asset.symbol }));
  const momentum = equityMomentumSignalsFromSeries(series, asset.entity);
  const volatility = volatilityRegimeSignalsFromSeries(series, asset.entity);
  const koios = adaptKoiosNewsSignal({ storeRoot, entity: asset.entity, entityKeywords: ENTITY_KOIOS_KEYWORDS[asset.entity] ?? [asset.entity.toLowerCase()] });
  return { series, byType: { momentum, "volatility-regime": volatility, "koios-news": koios } };
}

function combosForByType(asset, assetClass, timeframe, series, byType, foldConfig) {
  const rows = [];
  for (const [signalType, signals] of Object.entries(byType)) {
    rows.push(runCombo({ asset: asset.entity, assetClass, timeframe, signalType, series, signalArrays: [signals], foldConfig }));
  }
  rows.push(runCombo({ asset: asset.entity, assetClass, timeframe, signalType: "fused-all", series, signalArrays: Object.values(byType), foldConfig }));
  return rows;
}

async function buildIntradayRows(storeRoot) {
  const rows = [];
  const cryptoIntraday = [{ entity: "BTC", coinId: "bitcoin" }, { entity: "ETH", coinId: "ethereum" }];
  for (const asset of cryptoIntraday) {
    await sleep(3000);
    try {
      const series = await withRateLimitRetry(() => fetchHourlyPriceSeries({ coinId: asset.coinId, days: 7 }));
      const momentum = momentumSignalsFromSeries(series, asset.entity, 6, 0.02, "coingecko-market-chart", "h");
      const volatility = volatilityRegimeSignalsFromSeries(series, asset.entity, 6, 24, 1.3, 1.0, "derived-realized-volatility-intraday");
      rows.push(...combosForByType(asset, "crypto", "intraday-hourly", series, { momentum, "volatility-regime": volatility }, INTRADAY_FOLD_CONFIG));
    } catch (error) {
      rows.push({ asset: asset.entity, assetClass: "crypto", timeframe: "intraday-hourly", signalType: "ALL (asset fetch failed)", error: error.message });
    }
  }
  const equityIntraday = [{ entity: "SPY", symbol: "SPY" }, { entity: "QQQ", symbol: "QQQ" }];
  for (const asset of equityIntraday) {
    await sleep(2000);
    try {
      const series = await withRateLimitRetry(() => fetchYahooIntradayPriceSeries({ symbol: asset.symbol }));
      const momentum = equityMomentumSignalsFromSeries(series, asset.entity, 6, 0.005, "h");
      const volatility = volatilityRegimeSignalsFromSeries(series, asset.entity, 6, 24, 1.3, 1.0, "derived-realized-volatility-intraday");
      rows.push(...combosForByType(asset, "equity", "intraday-hourly", series, { momentum, "volatility-regime": volatility }, INTRADAY_FOLD_CONFIG));
    } catch (error) {
      rows.push({ asset: asset.entity, assetClass: "equity", timeframe: "intraday-hourly", signalType: "ALL (asset fetch failed)", error: error.message });
    }
  }
  return rows;
}

/**
 * Runs the full widened grid: every crypto/equity asset x every
 * applicable signal type (plus one fused-all combo per asset), daily and
 * intraday, then applies BH(q) and Bonferroni(alpha) across the entire
 * grid's holdout p-values in one family (never per-timeframe silos,
 * which would hide the true multiplicity).
 * @param {object} config
 * @param {string} config.koiosStoreRoot Absolute path to koios's claim store root.
 * @param {number} [config.fdrQ] Benjamini-Hochberg target FDR; defaults to 0.10.
 * @param {number} [config.bonferroniAlpha] Bonferroni family-wise alpha; defaults to 0.05.
 * @param {boolean} [config.includeIntraday] Whether to also run the smaller intraday-hourly sub-grid; defaults to true. Set false for a bounded single-pass daily-only run.
 * @returns {Promise<object>} `{grid, summary}`.
 */
export async function runSignalFusionAlphaGrid({ koiosStoreRoot, fdrQ = 0.10, bonferroniAlpha = 0.05, includeIntraday = true }) {
  const rows = [];
  for (const asset of CRYPTO_ASSETS) {
    await sleep(3000);
    try {
      const { series, byType } = await buildCryptoDailySignals(asset, koiosStoreRoot);
      rows.push(...combosForByType(asset, "crypto", "daily", series, byType, DAILY_FOLD_CONFIG));
    } catch (error) {
      rows.push({ asset: asset.entity, assetClass: "crypto", timeframe: "daily", signalType: "ALL (asset fetch failed)", error: error.message });
    }
  }
  for (const asset of EQUITY_ASSETS) {
    await sleep(2000);
    try {
      const { series, byType } = await buildEquityDailySignals(asset, koiosStoreRoot);
      rows.push(...combosForByType(asset, "equity", "daily", series, byType, DAILY_FOLD_CONFIG));
    } catch (error) {
      rows.push({ asset: asset.entity, assetClass: "equity", timeframe: "daily", signalType: "ALL (asset fetch failed)", error: error.message });
    }
  }
  try {
    if (includeIntraday) rows.push(...await buildIntradayRows(koiosStoreRoot));
  } catch (error) {
    rows.push({ asset: "intraday-grid", assetClass: "mixed", timeframe: "intraday-hourly", signalType: "ALL (fetch failed)", error: error.message });
  }

  const evaluable = rows.filter((row) => !row.error && row.holdout && row.holdout.periods > 1);
  const pValues = evaluable.map((row) => row.pValue);
  const bh = pValues.length > 0 ? benjaminiHochberg(pValues, fdrQ) : { significant: [], adjustedPValues: [], thresholdRank: null };
  const bonf = pValues.length > 0 ? bonferroniCorrection(pValues, bonferroniAlpha) : { significant: [], correctedAlpha: null };
  evaluable.forEach((row, index) => {
    row.bhAdjustedPValue = bh.adjustedPValues[index];
    row.bhSignificant = bh.significant[index];
    row.bonferroniSignificant = bonf.significant[index];
  });

  const surviving = evaluable.filter((row) => row.bhSignificant || row.bonferroniSignificant);
  return {
    grid: rows,
    summary: {
      totalCombos: rows.length,
      evaluableCombos: evaluable.length,
      erroredCombos: rows.length - evaluable.length,
      method: "Benjamini-Hochberg (1995) step-up FDR at q, and stricter Bonferroni family-wise correction at alpha, both applied once across the FULL combined daily+intraday grid (never per-timeframe silos)",
      fdrQ, bonferroniAlpha, bonferroniCorrectedAlpha: bonf.correctedAlpha,
      bhSignificantCount: bh.significant.filter(Boolean).length,
      bonferroniSignificantCount: bonf.significant.filter(Boolean).length,
      survivingCombos: surviving.map((row) => ({ asset: row.asset, assetClass: row.assetClass, timeframe: row.timeframe, signalType: row.signalType, direction: row.direction, holdout: row.holdout, pValue: row.pValue, bhAdjustedPValue: row.bhAdjustedPValue, kellyFraction: row.kellyFraction })),
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , configPath, outPath] = process.argv;
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  runSignalFusionAlphaGrid(config).then((result) => {
    const json = JSON.stringify(result, null, 2);
    if (outPath) writeFileSync(outPath, json);
    console.log(JSON.stringify(result.summary, null, 2));
  });
}
