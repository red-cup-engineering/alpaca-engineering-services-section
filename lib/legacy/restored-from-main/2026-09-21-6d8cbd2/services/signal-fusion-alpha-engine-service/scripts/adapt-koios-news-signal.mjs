/**
 * I/O adapter: reads koios's own real, owned claim store (SEAVT-shaped
 * `{subject, claims[]}` files under `sites/koios.news/store/<category>/`)
 * and emits Signal[] for claims mentioning a given entity's keywords.
 * Public information only -- our own published news, nothing else.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createSignal } from "../src/signal.mjs";

const DEFAULT_KEYWORDS_BY_DIRECTION = Object.freeze({
  increase: ["surge", "soar", "rally", "record high", "adoption", "inflow", "breakout", "bullish"],
  decrease: ["crash", "plunge", "selloff", "sell-off", "regulatory crackdown", "ban", "outflow", "bearish", "collapse"],
});

function listClaimFiles(storeRoot) {
  const files = [];
  for (const category of readdirSync(storeRoot)) {
    const categoryPath = join(storeRoot, category);
    if (!statSync(categoryPath).isDirectory()) continue;
    for (const name of readdirSync(categoryPath)) {
      if (name.endsWith(".json")) files.push({ category, path: join(categoryPath, name) });
    }
  }
  return files;
}

function fieldText(claim) {
  return claim.proposition?.object ?? "";
}

/** Reads one claim file, classifies direction by keyword substring match against `entityKeywords`/`keywordsByDirection` (a real but documented, swappable heuristic); returns `null` when the claim does not mention the entity. */
function claimToSignal(file, entity, entityKeywords, keywordsByDirection = DEFAULT_KEYWORDS_BY_DIRECTION) {
  const parsed = JSON.parse(readFileSync(file.path, "utf8"));
  const title = parsed.claims?.find((claim) => claim.id === "title");
  const summary = parsed.claims?.find((claim) => claim.id === "summary");
  const published = parsed.claims?.find((claim) => claim.id === "published");
  if (!title) return null;
  const text = `${fieldText(title)} ${fieldText(summary ?? {})}`.toLowerCase();
  if (!entityKeywords.some((keyword) => text.includes(keyword.toLowerCase()))) return null;
  const increaseHit = keywordsByDirection.increase.some((keyword) => text.includes(keyword));
  const decreaseHit = keywordsByDirection.decrease.some((keyword) => text.includes(keyword));
  const direction = increaseHit && !decreaseHit ? "increase" : decreaseHit && !increaseHit ? "decrease" : "neutral";
  const publishedDate = published ? new Date(fieldText(published)) : null;
  // a claim's "published" field is sometimes an empty string (real koios data quality, e.g. some NBER-sourced papers) -- fall back to the claim's own assertion time rather than crash on an Invalid Date
  const observedAt = publishedDate && !Number.isNaN(publishedDate.getTime()) ? publishedDate.toISOString() : title.time.asserted;
  return createSignal({
    source: title.provenance.citation,
    sourceKind: "koios-news",
    entity,
    observedAt,
    direction,
    strength: direction === "neutral" ? 0 : 0.5,
    independenceTag: `koios-${file.category}-claims`,
    description: fieldText(title),
  });
}

/**
 * Reads the koios claim store and emits one Signal per claim mentioning
 * `entity`, skipping non-matching or neutral-only claims.
 * @param {object} params
 * @param {string} params.storeRoot Absolute path to the koios store root (`sites/koios.news/store`).
 * @param {string} params.entity Entity identifier to tag emitted signals with (e.g. "BTC").
 * @param {string[]} params.entityKeywords Case-insensitive substrings identifying the entity in claim text.
 * @param {{increase: string[], decrease: string[]}} [params.keywordsByDirection] Direction keyword lexicon; defaults to a small built-in one.
 * @returns {import("../src/signal.mjs").Signal[]} signals for every matching, non-neutral claim.
 */
export function adaptKoiosNewsSignal({ storeRoot, entity, entityKeywords, keywordsByDirection }) {
  const files = listClaimFiles(storeRoot);
  const signals = [];
  for (const file of files) {
    const signal = claimToSignal(file, entity, entityKeywords, keywordsByDirection);
    if (signal && signal.direction !== "neutral") signals.push(signal);
  }
  return signals;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , storeRoot, entity, ...keywords] = process.argv;
  const signals = adaptKoiosNewsSignal({ storeRoot, entity, entityKeywords: keywords.length > 0 ? keywords : [entity.toLowerCase()] });
  console.log(JSON.stringify(signals, null, 2));
}
