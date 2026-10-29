/**
 * Derives a causal volatility-regime Signal from a price series already
 * on hand (no new external fetch) -- a genuinely independent signal TYPE
 * from momentum, since it reads dispersion, not direction, of the same
 * returns. Documented, swappable heuristic: short-window realized vol
 * elevated versus its long-window baseline is read contrarian (risk-off,
 * expect pullback); depressed is read as calm risk-on continuation.
 */

import { createSignal } from "../src/signal.mjs";

function trailingReturns(series) {
  const returns = [];
  for (let index = 1; index < series.length; index += 1) {
    returns.push((series[index].price - series[index - 1].price) / series[index - 1].price);
  }
  return returns;
}

function stdDev(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

/**
 * Computes one volatility-regime Signal per period once both windows are
 * available, using only returns up to and including that period's own
 * index (no look-ahead). Direction: short/long realized-vol ratio above
 * `thresholdRatio` reads "decrease" (elevated regime, contrarian
 * pullback expectation); below `1/thresholdRatio` reads "increase"
 * (depressed regime, calm continuation); otherwise "neutral".
 * @param {{date: string, price: number}[]} series Ascending-time prices (daily or intraday, `date` bare or full ISO).
 * @param {string} entity Entity identifier for the emitted signals.
 * @param {number} [shortWindow] Short realized-vol window in periods; defaults to 5.
 * @param {number} [longWindow] Long realized-vol (baseline) window in periods; defaults to 20.
 * @param {number} [thresholdRatio] Ratio past which the regime is read as elevated/depressed; defaults to 1.3.
 * @param {number} [strengthScale] Divides `|ratio - 1|` before clamping strength to [0,1]; defaults to 1.0.
 * @param {string} [source] Provenance source tag; defaults to "derived-realized-volatility".
 * @returns {import("../src/signal.mjs").Signal[]} one signal per period index `>= longWindow`.
 */
export function volatilityRegimeSignalsFromSeries(series, entity, shortWindow = 5, longWindow = 20, thresholdRatio = 1.3, strengthScale = 1.0, source = "derived-realized-volatility") {
  const returns = trailingReturns(series);
  const signals = [];
  for (let index = longWindow; index < series.length; index += 1) {
    const returnIndex = index - 1; // returns[k] is the return ending at series[k+1]
    const shortVol = stdDev(returns.slice(returnIndex - shortWindow + 1, returnIndex + 1));
    const longVol = stdDev(returns.slice(returnIndex - longWindow + 1, returnIndex + 1));
    const ratio = longVol > 0 ? shortVol / longVol : 1;
    const direction = ratio > thresholdRatio ? "decrease" : ratio < 1 / thresholdRatio ? "increase" : "neutral";
    const rawDate = series[index].date;
    const observedAt = rawDate.includes("T") ? new Date(rawDate).toISOString() : new Date(`${rawDate}T00:00:00Z`).toISOString();
    signals.push(createSignal({
      source,
      sourceKind: "market-data",
      entity,
      observedAt,
      direction,
      strength: Math.min(1, Math.abs(ratio - 1) / strengthScale),
      independenceTag: `volatility-regime-${shortWindow}-${longWindow}`,
      description: `realized-vol ratio (short ${shortWindow}/long ${longWindow}) = ${ratio.toFixed(3)}`,
    }));
  }
  return signals;
}
