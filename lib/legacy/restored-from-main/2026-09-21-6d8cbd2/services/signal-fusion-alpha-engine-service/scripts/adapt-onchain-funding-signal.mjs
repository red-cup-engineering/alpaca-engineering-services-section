/**
 * I/O adapter: a real, keyless, public on-chain/derivatives metric --
 * perpetual-futures funding rate from CoinGecko's public derivatives
 * endpoint. A persistently positive funding rate means longs pay shorts
 * (crowd already long-biased); treated here as a contrarian signal, the
 * documented, swappable interpretation choice.
 */

import { createSignal } from "../src/signal.mjs";

/**
 * Fetches keyless, public perpetual-futures tickers from CoinGecko.
 * @param {object} [params]
 * @param {typeof fetch} [params.fetchImpl] Injectable fetch, for tests.
 * @returns {Promise<object[]>} the raw derivatives ticker array.
 */
export async function fetchDerivativesTickers({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl("https://api.coingecko.com/api/v3/derivatives?include_tickers=unexpired");
  if (!response.ok) throw new Error(`adapt-onchain-funding-signal: CoinGecko request failed with ${response.status}`);
  return response.json();
}

/**
 * Emits a contrarian funding-rate Signal for one entity's perpetual
 * contracts: positive funding (longs paying shorts, crowd long-biased) is
 * read as a "decrease" signal and vice versa, magnitude-scaled by
 * `strengthScale`.
 * @param {object[]} tickers Raw derivatives tickers (as from {@link fetchDerivativesTickers}).
 * @param {string} entity Entity identifier for the emitted signals (e.g. "BTC").
 * @param {string} indexId The tickers' `index_id` to match (e.g. "BTC").
 * @param {string} observedAt ISO 8601 timestamp for the emitted signal (a snapshot has no historical series on the free tier).
 * @param {number} [strengthScale] Divides the funding rate's magnitude before clamping to [0,1]; defaults to 0.01 (a 1% funding rate saturates strength).
 * @returns {import("../src/signal.mjs").Signal[]} one signal per matching, non-zero-funding ticker.
 */
export function fundingRateSignalsFromTickers(tickers, entity, indexId, observedAt, strengthScale = 0.01) {
  return tickers
    .filter((ticker) => ticker.index_id === indexId && typeof ticker.funding_rate === "number" && ticker.funding_rate !== 0)
    .map((ticker) => createSignal({
      source: `coingecko-derivatives:${ticker.market}:${ticker.symbol}`,
      sourceKind: "on-chain-metric",
      entity,
      observedAt,
      direction: ticker.funding_rate > 0 ? "decrease" : "increase",
      strength: Math.min(1, Math.abs(ticker.funding_rate) / strengthScale),
      independenceTag: "onchain-funding-rate",
      description: `${ticker.market} ${ticker.symbol} funding rate ${(ticker.funding_rate * 100).toFixed(4)}%`,
    }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , indexId = "BTC", entity = "BTC"] = process.argv;
  fetchDerivativesTickers().then((tickers) => {
    console.log(JSON.stringify(fundingRateSignalsFromTickers(tickers, entity, indexId, new Date().toISOString()), null, 2));
  });
}
