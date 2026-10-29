import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchDailyPriceSeries, fetchHourlyPriceSeries, momentumSignalsFromSeries } from "../scripts/adapt-market-momentum-signal.mjs";

function coingeckoResponse(prices) {
  return { ok: true, json: async () => ({ prices }) };
}

test("fetchDailyPriceSeries: collapses CoinGecko's trailing same-date partial-'today' point (real observed live-data artifact)", async () => {
  const day = (n) => Date.UTC(2026, 0, n);
  const fetchImpl = async () => coingeckoResponse([[day(1), 100], [day(2), 101], [day(3), 102], [day(3) + 3600_000, 102.5]]);
  const series = await fetchDailyPriceSeries({ coinId: "bitcoin", fetchImpl });
  assert.equal(series.length, 3, `expected the duplicate trailing day collapsed, got ${JSON.stringify(series)}`);
  assert.equal(series[2].price, 102.5, "the freshest same-day price should win");
  const dates = series.map((point) => point.date);
  assert.deepEqual(dates, [...dates].sort());
});

test("fetchDailyPriceSeries: throws on a non-ok response", async () => {
  const fetchImpl = async () => ({ ok: false, status: 429 });
  await assert.rejects(() => fetchDailyPriceSeries({ coinId: "bitcoin", fetchImpl }), /429/);
});

test("fetchHourlyPriceSeries: preserves full-timestamp resolution (does not collapse same-day hours)", async () => {
  const hour = (h) => Date.UTC(2026, 0, 1, h);
  const fetchImpl = async () => coingeckoResponse([[hour(0), 100], [hour(1), 100.5], [hour(2), 101]]);
  const series = await fetchHourlyPriceSeries({ coinId: "bitcoin", fetchImpl });
  assert.equal(series.length, 3);
  assert.ok(series.every((point) => point.date.includes("T")));
});

test("fetchHourlyPriceSeries: strictly time-increasing output (the property formPurgedWalkForwardFolds requires)", async () => {
  const hour = (h) => Date.UTC(2026, 0, 1, h);
  const fetchImpl = async () => coingeckoResponse([[hour(0), 100], [hour(1), 101], [hour(1), 101.2]]);
  const series = await fetchHourlyPriceSeries({ coinId: "bitcoin", fetchImpl });
  const times = series.map((point) => Date.parse(point.date));
  for (let index = 1; index < times.length; index += 1) assert.ok(times[index] > times[index - 1]);
});

test("momentumSignalsFromSeries: accepts an hourly (full-ISO) series and stamps the given periodUnit", () => {
  const series = [
    { date: "2026-01-01T00:00:00.000Z", price: 100 },
    { date: "2026-01-01T01:00:00.000Z", price: 101 },
    { date: "2026-01-01T02:00:00.000Z", price: 102 },
  ];
  const signals = momentumSignalsFromSeries(series, "BTC", 1, 0.02, "coingecko-market-chart", "h");
  assert.ok(signals.length > 0);
  assert.equal(signals[0].independenceTag, "market-momentum-1h");
  assert.equal(signals[0].observedAt, "2026-01-01T01:00:00.000Z");
});

test("momentumSignalsFromSeries: default params are unchanged for a daily (bare-date) series (backward compatibility)", () => {
  const series = [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 101 }, { date: "2026-01-03", price: 102 }, { date: "2026-01-04", price: 103 }];
  const signals = momentumSignalsFromSeries(series, "BTC");
  assert.equal(signals[0].independenceTag, "market-momentum-3d");
  assert.equal(signals[0].source, "coingecko-market-chart");
});
