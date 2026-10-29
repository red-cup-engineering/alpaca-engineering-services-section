import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchDeribitFundingRateHistory, fundingHistorySignalsFromRecords } from "../scripts/adapt-perp-funding-history-signal.mjs";

test("fetchDeribitFundingRateHistory: parses Deribit's result array into {timestamp,interest8h}", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ result: [{ timestamp: 1700000000000, interest_8h: 0.0002 }, { timestamp: 1700003600000, interest_8h: 0.0003 }] }) });
  const records = await fetchDeribitFundingRateHistory({ instrumentName: "BTC-PERPETUAL", startTimestampMs: 0, endTimestampMs: 1, fetchImpl });
  assert.equal(records.length, 2);
  assert.equal(records[1].interest8h, 0.0003);
});

test("fetchDeribitFundingRateHistory: throws on a Deribit-shaped error body", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ error: { message: "bad instrument" } }) });
  await assert.rejects(() => fetchDeribitFundingRateHistory({ instrumentName: "NOPE", startTimestampMs: 0, endTimestampMs: 1, fetchImpl }), /bad instrument/);
});

test("fetchDeribitFundingRateHistory: throws on a non-ok response", async () => {
  const fetchImpl = async () => ({ ok: false, status: 502 });
  await assert.rejects(() => fetchDeribitFundingRateHistory({ instrumentName: "BTC-PERPETUAL", startTimestampMs: 0, endTimestampMs: 1, fetchImpl }), /502/);
});

test("fundingHistorySignalsFromRecords: persistently positive funding (crowd long-biased) reads contrarian 'decrease'", () => {
  const dayMs = new Date("2026-01-01T00:00:00Z").getTime();
  const records = Array.from({ length: 3 }, (_, hour) => ({ timestamp: dayMs + hour * 3600 * 1000, interest8h: 0.001 }));
  const signals = fundingHistorySignalsFromRecords(records, "BTC");
  assert.equal(signals.length, 1);
  assert.equal(signals[0].direction, "decrease");
  assert.equal(signals[0].independenceTag, "perp-funding-rate-history");
});

test("fundingHistorySignalsFromRecords: persistently negative funding reads contrarian 'increase'", () => {
  const dayMs = new Date("2026-01-01T00:00:00Z").getTime();
  const records = [{ timestamp: dayMs, interest8h: -0.0005 }];
  const signals = fundingHistorySignalsFromRecords(records, "BTC");
  assert.equal(signals[0].direction, "increase");
});

test("fundingHistorySignalsFromRecords: skips days whose mean funding is exactly zero", () => {
  const dayMs = new Date("2026-01-01T00:00:00Z").getTime();
  const records = [{ timestamp: dayMs, interest8h: 0.001 }, { timestamp: dayMs + 3600 * 1000, interest8h: -0.001 }];
  const signals = fundingHistorySignalsFromRecords(records, "BTC");
  assert.equal(signals.length, 0);
});
