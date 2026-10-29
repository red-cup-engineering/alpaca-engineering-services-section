/**
 * I/O adapter: keyless public equity/ETF price series from Yahoo
 * Finance's chart endpoint, reusing momentumSignalsFromSeries directly.
 */

import { momentumSignalsFromSeries } from "./adapt-market-momentum-signal.mjs";

const YAHOO_USER_AGENT = "Mozilla/5.0 (compatible; signal-fusion-alpha-engine-service/0.1)";

function parseChartResult(body, dateOnly) {
  const result = body?.chart?.result?.[0];
  if (!result) throw new Error("adapt-equity-price-signal: Yahoo chart response had no result");
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const series = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const price = closes[index];
    if (typeof price !== "number" || !Number.isFinite(price)) continue; // Yahoo emits null closes for non-trading gaps; skip rather than fabricate
    const iso = new Date(timestamps[index] * 1000).toISOString();
    series.push({ date: dateOnly ? iso.slice(0, 10) : iso, price });
  }
  return series;
}

/**
 * Fetches a keyless, public daily close series for one equity/ETF symbol
 * from Yahoo Finance's chart endpoint.
 * @param {object} params
 * @param {string} params.symbol Ticker symbol (e.g. "SPY", "AAPL").
 * @param {string} [params.range] Yahoo range string; defaults to "1y".
 * @param {typeof fetch} [params.fetchImpl] Injectable fetch, for tests.
 * @returns {Promise<{date: string, price: number}[]>} ascending-time daily closes, `date` as `YYYY-MM-DD`.
 */
export async function fetchYahooDailyPriceSeries({ symbol, range = "1y", fetchImpl = fetch }) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  const response = await fetchImpl(url, { headers: { "User-Agent": YAHOO_USER_AGENT } });
  if (!response.ok) throw new Error(`adapt-equity-price-signal: Yahoo daily chart request failed with ${response.status}`);
  return parseChartResult(await response.json(), true);
}

/**
 * Fetches a keyless, public intraday close series for one equity/ETF
 * symbol from Yahoo Finance's chart endpoint.
 * @param {object} params
 * @param {string} params.symbol Ticker symbol (e.g. "SPY", "AAPL").
 * @param {string} [params.range] Yahoo range string; defaults to "60d" (Yahoo's practical cap for 60m granularity).
 * @param {string} [params.interval] Yahoo interval string; defaults to "60m".
 * @param {typeof fetch} [params.fetchImpl] Injectable fetch, for tests.
 * @returns {Promise<{date: string, price: number}[]>} ascending-time closes, `date` as a full ISO 8601 timestamp.
 */
export async function fetchYahooIntradayPriceSeries({ symbol, range = "60d", interval = "60m", fetchImpl = fetch }) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const response = await fetchImpl(url, { headers: { "User-Agent": YAHOO_USER_AGENT } });
  if (!response.ok) throw new Error(`adapt-equity-price-signal: Yahoo intraday chart request failed with ${response.status}`);
  return parseChartResult(await response.json(), false);
}

/**
 * Computes causal equity momentum signals from a Yahoo daily/intraday
 * series by delegating to {@link momentumSignalsFromSeries}, tagged with
 * the `yahoo-finance-chart` provenance source so independence-weighting
 * can distinguish it from the CoinGecko-sourced crypto momentum family.
 * @param {{date: string, price: number}[]} series As from {@link fetchYahooDailyPriceSeries} or {@link fetchYahooIntradayPriceSeries}.
 * @param {string} entity Entity identifier for the emitted signals (e.g. "SPY").
 * @param {number} [lookback] Trailing-return window in periods; defaults to 3.
 * @param {number} [strengthScale] Divides the trailing return's magnitude before clamping to [0,1]; defaults to 0.02 (equities move less than crypto for the same window).
 * @param {string} [periodUnit] "d" for a daily series, "h" for an intraday series; defaults to "d".
 * @returns {import("../src/signal.mjs").Signal[]}
 */
export function equityMomentumSignalsFromSeries(series, entity, lookback = 3, strengthScale = 0.02, periodUnit = "d") {
  return momentumSignalsFromSeries(series, entity, lookback, strengthScale, "yahoo-finance-chart", periodUnit);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , symbol = "SPY", entity = symbol] = process.argv;
  fetchYahooDailyPriceSeries({ symbol }).then((series) => {
    console.log(JSON.stringify(equityMomentumSignalsFromSeries(series, entity), null, 2));
  });
}
