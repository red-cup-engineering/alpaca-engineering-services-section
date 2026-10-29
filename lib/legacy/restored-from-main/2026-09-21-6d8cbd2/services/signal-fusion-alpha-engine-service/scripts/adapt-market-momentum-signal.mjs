/**
 * I/O adapter: a real, causal (no look-ahead) technical-momentum signal
 * from a daily price series -- sign of the trailing `lookback`-day return
 * at each date, one fixed rule, no fitted parameters. Public market data;
 * `fetchDailyPriceSeries` hits CoinGecko's keyless public API by default,
 * injectable for tests/fixtures (same DI pattern as the house's paper
 * account read services).
 */

import { createSignal } from "../src/signal.mjs";

/**
 * Fetches a keyless, public daily price series from CoinGecko for one
 * asset. No API key required; public market data only.
 * @param {object} params
 * @param {string} params.coinId CoinGecko coin id (e.g. "bitcoin").
 * @param {string} [params.vsCurrency] Quote currency; defaults to "usd".
 * @param {number} [params.days] Trailing days of history; defaults to 365.
 * @param {typeof fetch} [params.fetchImpl] Injectable fetch, for tests.
 * @returns {Promise<{date: string, price: number}[]>} ascending-date daily closes.
 */
export async function fetchDailyPriceSeries({ coinId, vsCurrency = "usd", days = 365, fetchImpl = fetch }) {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}&interval=daily`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`adapt-market-momentum-signal: CoinGecko request failed with ${response.status}`);
  const body = await response.json();
  const points = body.prices.map(([timestampMs, price]) => ({ date: new Date(timestampMs).toISOString().slice(0, 10), price }));
  // CoinGecko appends a same-date partial "today" point after the last full day; collapse same-date points (keep the freshest price) so the series is strictly date-increasing, as formPurgedWalkForwardFolds requires
  const byDate = [];
  for (const point of points) {
    if (byDate.length > 0 && byDate[byDate.length - 1].date === point.date) byDate[byDate.length - 1] = point;
    else byDate.push(point);
  }
  return byDate;
}

/**
 * Fetches a keyless, public intraday price series from CoinGecko: for
 * `days` in (1, 90], CoinGecko's public API auto-serves hourly
 * granularity regardless of the `interval` query parameter (a free-tier
 * behavior, not a bug in this adapter) -- unlike {@link
 * fetchDailyPriceSeries}, this keeps the FULL timestamp (not truncated
 * to a bare date), since multiple points per calendar day is the point.
 * @param {object} params
 * @param {string} params.coinId CoinGecko coin id (e.g. "bitcoin").
 * @param {string} [params.vsCurrency] Quote currency; defaults to "usd".
 * @param {number} [params.days] Trailing days of history; must be in (1,90] to get hourly granularity; defaults to 7.
 * @param {typeof fetch} [params.fetchImpl] Injectable fetch, for tests.
 * @returns {Promise<{date: string, price: number}[]>} ascending-time closes, `date` a full ISO 8601 timestamp.
 */
export async function fetchHourlyPriceSeries({ coinId, vsCurrency = "usd", days = 7, fetchImpl = fetch }) {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`adapt-market-momentum-signal: CoinGecko hourly request failed with ${response.status}`);
  const body = await response.json();
  const points = body.prices.map(([timestampMs, price]) => ({ date: new Date(timestampMs).toISOString(), price }));
  // collapse any exact-same-timestamp duplicates (mirrors fetchDailyPriceSeries's trailing-point guard) so the series stays strictly time-increasing
  const deduped = [];
  for (const point of points) {
    if (deduped.length > 0 && deduped[deduped.length - 1].date === point.date) deduped[deduped.length - 1] = point;
    else deduped.push(point);
  }
  return deduped;
}

/**
 * Computes a causal momentum Signal for every period with `lookback` prior
 * periods available. Direction is the sign of the trailing return; "neutral"
 * on an exact zero. Strength is the trailing return's magnitude, capped
 * at 1 by `strengthScale`.
 * @param {{date: string, price: number}[]} series Ascending-time prices (as from {@link fetchDailyPriceSeries}). `date` is either a bare `YYYY-MM-DD` (daily series) or a full ISO 8601 timestamp (intraday series, e.g. from an hourly feed) -- both are accepted so this one function serves daily and intraday callers without duplication.
 * @param {string} entity Entity identifier for the emitted signals (e.g. "BTC").
 * @param {number} [lookback] Trailing-return window in periods; defaults to 3.
 * @param {number} [strengthScale] Divides the trailing return's magnitude before clamping to [0,1]; defaults to 0.05 (a 5% move saturates strength).
 * @param {string} [source] Provenance source tag; defaults to "coingecko-market-chart".
 * @param {string} [periodUnit] Label suffix for `independenceTag` ("d" for daily periods, "h" for hourly/intraday periods); defaults to "d", unchanged from this function's original daily-only behavior.
 * @returns {import("../src/signal.mjs").Signal[]} one signal per period index `>= lookback`.
 */
export function momentumSignalsFromSeries(series, entity, lookback = 3, strengthScale = 0.05, source = "coingecko-market-chart", periodUnit = "d") {
  const signals = [];
  for (let index = lookback; index < series.length; index += 1) {
    const trailingReturn = (series[index].price - series[index - lookback].price) / series[index - lookback].price;
    const direction = trailingReturn > 0 ? "increase" : trailingReturn < 0 ? "decrease" : "neutral";
    const rawDate = series[index].date;
    const observedAt = rawDate.includes("T") ? new Date(rawDate).toISOString() : new Date(`${rawDate}T00:00:00Z`).toISOString();
    signals.push(createSignal({
      source,
      sourceKind: "market-data",
      entity,
      observedAt,
      direction,
      strength: Math.min(1, Math.abs(trailingReturn) / strengthScale),
      independenceTag: `market-momentum-${lookback}${periodUnit}`,
      description: `${lookback}-period trailing return ${(trailingReturn * 100).toFixed(2)}%`,
    }));
  }
  return signals;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , coinId = "bitcoin", entity = "BTC"] = process.argv;
  fetchDailyPriceSeries({ coinId }).then((series) => {
    console.log(JSON.stringify(momentumSignalsFromSeries(series, entity), null, 2));
  });
}
