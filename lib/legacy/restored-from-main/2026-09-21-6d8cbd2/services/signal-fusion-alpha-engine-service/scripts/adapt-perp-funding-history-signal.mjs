/**
 * I/O adapter: real, keyless, public perp funding-rate HISTORY from
 * Deribit (unlike the CoinGecko snapshot adapter, this has real history).
 */

import { createSignal } from "../src/signal.mjs";

/**
 * Fetches keyless, public hourly funding-rate history for one Deribit
 * perpetual instrument.
 * @param {object} params
 * @param {string} params.instrumentName Deribit instrument (e.g. "BTC-PERPETUAL", "ETH-PERPETUAL").
 * @param {number} params.startTimestampMs Range start, epoch milliseconds.
 * @param {number} params.endTimestampMs Range end, epoch milliseconds.
 * @param {typeof fetch} [params.fetchImpl] Injectable fetch, for tests.
 * @returns {Promise<{timestamp: number, interest8h: number}[]>} ascending-time hourly funding records.
 */
export async function fetchDeribitFundingRateHistory({ instrumentName, startTimestampMs, endTimestampMs, fetchImpl = fetch }) {
  const url = `https://www.deribit.com/api/v2/public/get_funding_rate_history?instrument_name=${encodeURIComponent(instrumentName)}&start_timestamp=${startTimestampMs}&end_timestamp=${endTimestampMs}`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`adapt-perp-funding-history-signal: Deribit request failed with ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`adapt-perp-funding-history-signal: Deribit error ${JSON.stringify(body.error)}`);
  return body.result.map((record) => ({ timestamp: record.timestamp, interest8h: record.interest_8h }));
}

function dailyMeanFunding(records) {
  const byDate = new Map();
  for (const record of records) {
    const date = new Date(record.timestamp).toISOString().slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(record.interest8h);
  }
  return [...byDate.entries()]
    .map(([date, values]) => ({ date, meanInterest8h: values.reduce((sum, value) => sum + value, 0) / values.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Aggregates hourly Deribit funding records to one contrarian Signal per
 * day: persistently positive funding (longs paying shorts, crowd
 * long-biased) reads "decrease" and vice versa, mirroring the existing
 * snapshot adapter's documented, swappable interpretation.
 * @param {{timestamp: number, interest8h: number}[]} records As from {@link fetchDeribitFundingRateHistory}.
 * @param {string} entity Entity identifier for the emitted signals (e.g. "BTC").
 * @param {number} [strengthScale] Divides the mean funding rate's magnitude before clamping to [0,1]; defaults to 0.0005 (Deribit's `interest_8h` is a small fraction).
 * @returns {import("../src/signal.mjs").Signal[]} one signal per day with at least one funding record and a non-zero mean.
 */
export function fundingHistorySignalsFromRecords(records, entity, strengthScale = 0.0005) {
  return dailyMeanFunding(records)
    .filter((day) => day.meanInterest8h !== 0)
    .map((day) => createSignal({
      source: "deribit-funding-rate-history",
      sourceKind: "on-chain-metric",
      entity,
      observedAt: new Date(`${day.date}T00:00:00Z`).toISOString(),
      direction: day.meanInterest8h > 0 ? "decrease" : "increase",
      strength: Math.min(1, Math.abs(day.meanInterest8h) / strengthScale),
      independenceTag: "perp-funding-rate-history",
      description: `mean daily 8h funding ${(day.meanInterest8h * 100).toFixed(4)}%`,
    }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , instrumentName = "BTC-PERPETUAL", entity = "BTC"] = process.argv;
  const endTimestampMs = Date.now();
  const startTimestampMs = endTimestampMs - 365 * 24 * 60 * 60 * 1000;
  fetchDeribitFundingRateHistory({ instrumentName, startTimestampMs, endTimestampMs }).then((records) => {
    console.log(JSON.stringify(fundingHistorySignalsFromRecords(records, entity), null, 2));
  });
}
