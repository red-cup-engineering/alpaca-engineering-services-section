import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adaptKoiosNewsSignal } from "../scripts/adapt-koios-news-signal.mjs";

function claimFile({ title, summary = "", published }) {
  const claims = [
    { id: "title", proposition: { predicate: "title", object: title }, time: { asserted: "2026-06-19T07:30:54.515Z" }, force: "alleges", provenance: { witness: "collapse-finance", citation: "https://example.test/a" }, status: "supported" },
    { id: "summary", proposition: { predicate: "summary", object: summary }, time: { asserted: "2026-06-19T07:30:54.515Z" }, force: "alleges", provenance: { witness: "collapse-finance", citation: "https://example.test/a" }, status: "supported" },
  ];
  if (published !== undefined) {
    claims.push({ id: "published", proposition: { predicate: "published", object: published }, time: { asserted: "2026-06-19T07:30:54.515Z" }, force: "alleges", provenance: { witness: "collapse-finance", citation: "https://example.test/a" }, status: "supported" });
  }
  return { subject: title, claims };
}

function withStore(files, fn) {
  const root = mkdtempSync(join(tmpdir(), "koios-store-test-"));
  mkdirSync(join(root, "collapse-finance"));
  files.forEach((file, index) => writeFileSync(join(root, "collapse-finance", `claim-${index}.json`), JSON.stringify(file)));
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("adaptKoiosNewsSignal: matches entity keywords and classifies direction by lexicon", () => {
  withStore([claimFile({ title: "Bitcoin surges to record high on ETF inflows", published: "Thu, 18 Jun 2026 16:19:01 GMT" })], (storeRoot) => {
    const signals = adaptKoiosNewsSignal({ storeRoot, entity: "BTC", entityKeywords: ["bitcoin"] });
    assert.equal(signals.length, 1);
    assert.equal(signals[0].direction, "increase");
    assert.equal(signals[0].sourceKind, "koios-news");
  });
});

test("adaptKoiosNewsSignal: skips a claim that does not mention the entity keywords", () => {
  withStore([claimFile({ title: "Local council approves new bike lanes" })], (storeRoot) => {
    const signals = adaptKoiosNewsSignal({ storeRoot, entity: "BTC", entityKeywords: ["bitcoin"] });
    assert.equal(signals.length, 0);
  });
});

test("adaptKoiosNewsSignal: falls back to the claim's assertion time rather than crashing when published is an empty string (real koios data quality gap)", () => {
  withStore([claimFile({ title: "Bitcoin crashes amid regulatory crackdown", published: "" })], (storeRoot) => {
    const signals = adaptKoiosNewsSignal({ storeRoot, entity: "BTC", entityKeywords: ["bitcoin"] });
    assert.equal(signals.length, 1);
    assert.equal(signals[0].direction, "decrease");
    assert.equal(signals[0].observedAt, "2026-06-19T07:30:54.515Z");
  });
});

test("adaptKoiosNewsSignal: a claim with no direction-keyword hit classifies neutral and is dropped", () => {
  withStore([claimFile({ title: "Bitcoin mentioned in a policy roundup" })], (storeRoot) => {
    const signals = adaptKoiosNewsSignal({ storeRoot, entity: "BTC", entityKeywords: ["bitcoin"] });
    assert.equal(signals.length, 0);
  });
});
