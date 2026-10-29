import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchBitcoinActiveAddressSeries, activeAddressFlowSignalsFromSeries } from "../scripts/adapt-onchain-active-address-signal.mjs";

test("fetchBitcoinActiveAddressSeries: parses blockchain.info's {x,y} chart shape into {date,value}", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ values: [{ x: 1700000000, y: 500000 }, { x: 1700086400, y: 520000 }] }) });
  const series = await fetchBitcoinActiveAddressSeries({ fetchImpl });
  assert.equal(series.length, 2);
  assert.match(series[0].date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(series[1].value, 520000);
});

test("fetchBitcoinActiveAddressSeries: throws on a non-ok response", async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchBitcoinActiveAddressSeries({ fetchImpl }), /503/);
});

test("activeAddressFlowSignalsFromSeries: rising active addresses reads 'increase'", () => {
  const series = Array.from({ length: 10 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), value: 500000 + i * 20000 }));
  const signals = activeAddressFlowSignalsFromSeries(series, "BTC", 7);
  assert.ok(signals.length > 0);
  assert.equal(signals[0].direction, "increase");
  assert.equal(signals[0].sourceKind, "on-chain-metric");
});

test("activeAddressFlowSignalsFromSeries: falling active addresses reads 'decrease'", () => {
  const series = Array.from({ length: 10 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), value: 700000 - i * 20000 }));
  const signals = activeAddressFlowSignalsFromSeries(series, "BTC", 7);
  assert.equal(signals[0].direction, "decrease");
});
