/**
 * I/O adapter: real, keyless, public Bitcoin active-address history from
 * blockchain.info's charts API. Rising usage reads trend-following.
 */

import { createSignal } from "../src/signal.mjs";

/**
 * Fetches a keyless, public daily active-address count series for
 * Bitcoin from blockchain.info's charts API.
 * @param {object} [params]
 * @param {string} [params.timespan] blockchain.info timespan string; defaults to "3years".
 * @param {typeof fetch} [params.fetchImpl] Injectable fetch, for tests.
 * @returns {Promise<{date: string, value: number}[]>} ascending-date daily active-address counts.
 */
export async function fetchBitcoinActiveAddressSeries({ timespan = "3years", fetchImpl = fetch } = {}) {
  const url = `https://api.blockchain.info/charts/n-unique-addresses?timespan=${timespan}&format=json`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`adapt-onchain-active-address-signal: blockchain.info request failed with ${response.status}`);
  const body = await response.json();
  return body.values.map(({ x, y }) => ({ date: new Date(x * 1000).toISOString().slice(0, 10), value: y }));
}

/**
 * Computes a causal, trailing-%-change active-address-flow Signal for
 * every date with `lookback` prior days available.
 * @param {{date: string, value: number}[]} series As from {@link fetchBitcoinActiveAddressSeries}.
 * @param {string} entity Entity identifier for the emitted signals (Bitcoin-only source; conventionally "BTC").
 * @param {number} [lookback] Trailing-change window in days; defaults to 7.
 * @param {number} [strengthScale] Divides the trailing change's magnitude before clamping to [0,1]; defaults to 0.1 (a 10% move saturates strength).
 * @returns {import("../src/signal.mjs").Signal[]} one signal per date index `>= lookback`.
 */
export function activeAddressFlowSignalsFromSeries(series, entity, lookback = 7, strengthScale = 0.1) {
  const signals = [];
  for (let index = lookback; index < series.length; index += 1) {
    const prior = series[index - lookback].value;
    if (!(prior > 0)) continue;
    const trailingChange = (series[index].value - prior) / prior;
    const direction = trailingChange > 0 ? "increase" : trailingChange < 0 ? "decrease" : "neutral";
    signals.push(createSignal({
      source: "blockchain.info-charts",
      sourceKind: "on-chain-metric",
      entity,
      observedAt: new Date(`${series[index].date}T00:00:00Z`).toISOString(),
      direction,
      strength: Math.min(1, Math.abs(trailingChange) / strengthScale),
      independenceTag: `onchain-active-address-flow-${lookback}d`,
      description: `${lookback}-day trailing active-address change ${(trailingChange * 100).toFixed(2)}%`,
    }));
  }
  return signals;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , entity = "BTC"] = process.argv;
  fetchBitcoinActiveAddressSeries().then((series) => {
    console.log(JSON.stringify(activeAddressFlowSignalsFromSeries(series, entity), null, 2));
  });
}
