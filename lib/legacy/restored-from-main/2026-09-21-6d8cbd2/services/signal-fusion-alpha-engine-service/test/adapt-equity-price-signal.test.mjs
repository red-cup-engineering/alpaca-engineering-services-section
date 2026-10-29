import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchYahooDailyPriceSeries, fetchYahooIntradayPriceSeries, equityMomentumSignalsFromSeries } from "../scripts/adapt-equity-price-signal.mjs";

function fakeChartResponse(timestamps, closes) {
  return {
    ok: true,
    json: async () => ({ chart: { result: [{ timestamp: timestamps, indicators: { quote: [{ close: closes }] } }] } }),
  };
}

test("fetchYahooDailyPriceSeries: parses a chart response into a date-keyed series, skipping null closes", async () => {
  const timestamps = [1700000000, 1700086400, 1700172800];
  const closes = [100, null, 102];
  const fetchImpl = async () => fakeChartResponse(timestamps, closes);
  const series = await fetchYahooDailyPriceSeries({ symbol: "SPY", fetchImpl });
  assert.equal(series.length, 2);
  assert.match(series[0].date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(series[1].price, 102);
});

test("fetchYahooIntradayPriceSeries: emits full ISO timestamps, not bare dates", async () => {
  const timestamps = [1700000000, 1700003600];
  const closes = [100, 101];
  const fetchImpl = async () => fakeChartResponse(timestamps, closes);
  const series = await fetchYahooIntradayPriceSeries({ symbol: "SPY", fetchImpl });
  assert.ok(series[0].date.includes("T"));
});

test("fetchYahooDailyPriceSeries: throws on a non-ok response", async () => {
  const fetchImpl = async () => ({ ok: false, status: 429 });
  await assert.rejects(() => fetchYahooDailyPriceSeries({ symbol: "SPY", fetchImpl }), /429/);
});

test("equityMomentumSignalsFromSeries: reuses momentumSignalsFromSeries, tagged with the yahoo-finance-chart source", () => {
  const series = [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 101 }, { date: "2026-01-03", price: 102 }, { date: "2026-01-04", price: 103 }];
  const signals = equityMomentumSignalsFromSeries(series, "SPY", 1);
  assert.ok(signals.length > 0);
  assert.equal(signals[0].source, "yahoo-finance-chart");
  assert.equal(signals[0].direction, "increase");
});
