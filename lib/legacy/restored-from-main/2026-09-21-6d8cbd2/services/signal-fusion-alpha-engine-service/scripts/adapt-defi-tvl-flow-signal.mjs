/**
 * I/O adapter: real, keyless, public DeFi total-value-locked history per
 * chain from DefiLlama's public API. TVL is a genuine on-chain-flow
 * metric distinct from price and from active-address usage; applies to
 * any chain with a DeFi ecosystem (Ethereum, Solana, ...), unlike the
 * Bitcoin-only active-address adapter.
 */

import { createSignal } from "../src/signal.mjs";

/**
 * Fetches a keyless, public daily historical TVL series for one chain
 * from DefiLlama.
 * @param {object} params
 * @param {string} params.chain DefiLlama chain name (e.g. "Ethereum", "Solana").
 * @param {typeof fetch} [params.fetchImpl] Injectable fetch, for tests.
 * @returns {Promise<{date: string, tvl: number}[]>} ascending-date daily TVL in USD.
 */
export async function fetchChainTvlSeries({ chain, fetchImpl = fetch }) {
  const url = `https://api.llama.fi/v2/historicalChainTvl/${encodeURIComponent(chain)}`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`adapt-defi-tvl-flow-signal: DefiLlama request failed with ${response.status}`);
  const body = await response.json();
  return body.map(({ date, tvl }) => ({ date: new Date(date * 1000).toISOString().slice(0, 10), tvl }));
}

/**
 * Computes a causal, trailing-%-change TVL-flow Signal for every date
 * with `lookback` prior days available. Rising TVL reads trend-following
 * ("increase" -- capital flowing into the chain's ecosystem).
 * @param {{date: string, tvl: number}[]} series As from {@link fetchChainTvlSeries}.
 * @param {string} entity Entity identifier for the emitted signals (e.g. "ETH", "SOL").
 * @param {number} [lookback] Trailing-change window in days; defaults to 7.
 * @param {number} [strengthScale] Divides the trailing change's magnitude before clamping to [0,1]; defaults to 0.05.
 * @returns {import("../src/signal.mjs").Signal[]} one signal per date index `>= lookback` with a positive prior TVL.
 */
export function tvlFlowSignalsFromSeries(series, entity, lookback = 7, strengthScale = 0.05) {
  const signals = [];
  for (let index = lookback; index < series.length; index += 1) {
    const prior = series[index - lookback].tvl;
    if (!(prior > 0)) continue;
    const trailingChange = (series[index].tvl - prior) / prior;
    const direction = trailingChange > 0 ? "increase" : trailingChange < 0 ? "decrease" : "neutral";
    signals.push(createSignal({
      source: "defillama-historical-chain-tvl",
      sourceKind: "on-chain-metric",
      entity,
      observedAt: new Date(`${series[index].date}T00:00:00Z`).toISOString(),
      direction,
      strength: Math.min(1, Math.abs(trailingChange) / strengthScale),
      independenceTag: `defi-tvl-flow-${lookback}d`,
      description: `${lookback}-day trailing chain-TVL change ${(trailingChange * 100).toFixed(2)}%`,
    }));
  }
  return signals;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , chain = "Ethereum", entity = "ETH"] = process.argv;
  fetchChainTvlSeries({ chain }).then((series) => {
    console.log(JSON.stringify(tvlFlowSignalsFromSeries(series, entity), null, 2));
  });
}
