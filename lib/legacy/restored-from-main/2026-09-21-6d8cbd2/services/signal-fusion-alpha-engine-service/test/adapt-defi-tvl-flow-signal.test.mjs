import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchChainTvlSeries, tvlFlowSignalsFromSeries } from "../scripts/adapt-defi-tvl-flow-signal.mjs";

test("fetchChainTvlSeries: parses DefiLlama's [{date,tvl}] array (epoch-seconds date) into ISO dates", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ([{ date: 1700000000, tvl: 1000000 }, { date: 1700086400, tvl: 1050000 }]) });
  const series = await fetchChainTvlSeries({ chain: "Ethereum", fetchImpl });
  assert.equal(series.length, 2);
  assert.match(series[0].date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(series[1].tvl, 1050000);
});

test("fetchChainTvlSeries: throws on a non-ok response", async () => {
  const fetchImpl = async () => ({ ok: false, status: 500 });
  await assert.rejects(() => fetchChainTvlSeries({ chain: "Ethereum", fetchImpl }), /500/);
});

test("tvlFlowSignalsFromSeries: rising chain TVL reads 'increase'", () => {
  const series = Array.from({ length: 10 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), tvl: 1_000_000 * (1 + i * 0.05) }));
  const signals = tvlFlowSignalsFromSeries(series, "ETH", 7);
  assert.ok(signals.length > 0);
  assert.equal(signals[0].direction, "increase");
  assert.equal(signals[0].independenceTag, "defi-tvl-flow-7d");
});

test("tvlFlowSignalsFromSeries: skips periods with a non-positive prior TVL rather than dividing by zero", () => {
  const series = [{ date: "2026-01-01", tvl: 0 }, ...Array.from({ length: 8 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, 2 + i)).toISOString().slice(0, 10), tvl: 1000 + i }))];
  const signals = tvlFlowSignalsFromSeries(series, "ETH", 1);
  assert.ok(signals.every((signal) => Number.isFinite(signal.strength)));
});
