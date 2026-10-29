/**
 * The typed public Signal a source adapter emits: one independent read on
 * an entity's near-term direction, stamped with its `independenceTag` so
 * correlated signals from the same source family can be shrunk before
 * fusion (independence-weighting.mjs). Legal fence: every adapter must
 * draw only on public information -- never MNPI, never a manipulative act.
 */

const SOURCE_KINDS = Object.freeze(["koios-news", "on-chain-metric", "market-data"]);
const DIRECTIONS = Object.freeze(["increase", "decrease", "neutral"]);

/** @typedef {{source: string, sourceKind: "koios-news"|"on-chain-metric"|"market-data", entity: string, observedAt: string, direction: "increase"|"decrease"|"neutral", strength: number, independenceTag: string, description: string}} Signal One typed, provenance-stamped public read on an entity's near-term direction. */

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`signal: ${label} must be a non-empty string, got ${JSON.stringify(value)}`);
  }
  return value;
}

function requireUnitInterval(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`signal: ${label} must be a finite number in [0,1], got ${JSON.stringify(value)}`);
  }
  return value;
}

function requireIsoDate(value, label) {
  requireNonEmptyString(value, label);
  if (Number.isNaN(Date.parse(value))) {
    throw new TypeError(`signal: ${label} must be a parseable ISO 8601 date, got ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Validates and freezes one Signal. Refuses a signal whose `sourceKind` is
 * not one of the three admitted public-source families, or whose
 * `direction` is outside {increase, decrease, neutral} -- there is no
 * "unknown direction" default; an adapter that cannot read a direction
 * must emit "neutral" explicitly, never omit the field.
 * @param {Signal} fields
 * @returns {Readonly<Signal>} the frozen, validated signal.
 * @throws {TypeError} when any field is missing or malformed.
 */
export function createSignal(fields) {
  if (typeof fields !== "object" || fields === null) throw new TypeError("signal: fields must be an object");
  requireNonEmptyString(fields.source, "source");
  if (!SOURCE_KINDS.includes(fields.sourceKind)) {
    throw new TypeError(`signal: sourceKind must be one of ${SOURCE_KINDS.join(", ")}, got ${JSON.stringify(fields.sourceKind)}`);
  }
  requireNonEmptyString(fields.entity, "entity");
  requireIsoDate(fields.observedAt, "observedAt");
  if (!DIRECTIONS.includes(fields.direction)) {
    throw new TypeError(`signal: direction must be one of ${DIRECTIONS.join(", ")}, got ${JSON.stringify(fields.direction)}`);
  }
  requireUnitInterval(fields.strength, "strength");
  requireNonEmptyString(fields.independenceTag, "independenceTag");
  requireNonEmptyString(fields.description, "description");
  return Object.freeze({
    source: fields.source,
    sourceKind: fields.sourceKind,
    entity: fields.entity,
    observedAt: fields.observedAt,
    direction: fields.direction,
    strength: fields.strength,
    independenceTag: fields.independenceTag,
    description: fields.description,
  });
}

export const SIGNAL_SOURCE_KINDS = SOURCE_KINDS;
export const SIGNAL_DIRECTIONS = DIRECTIONS;
