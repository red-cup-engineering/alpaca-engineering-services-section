/**
 * CLI: `node size-position-from-edge.mjs <input.json>`. Reads a measured
 * holdout edge plus an envelope config, sizes the walled risk stake
 * (bounded-stake aggression, never a fractional-Kelly caution haircut),
 * and emits a simulated autonomous execution intent -- NEVER a real
 * order this pass, no armed wallet exists yet.
 *
 * The Kelly formula itself is `@red-cup-engineering/position-sizing-service`'s
 * `kellyFraction` -- this package carries no Kelly arithmetic of its own
 * (economics-science-services-section's 2026-09-01 bounded-stake growth
 * policy is the shared upstream note; position-sizing-service is its one
 * engineering owner). `sizeStakeFromKellyFraction` below is NOT Kelly math:
 * it is this consumer's own structural leverage clamp -- never exceed the
 * unlevered risk stake -- which stays local because it is this pipeline's
 * own envelope/execution-intent concern, not a position-sizing primitive.
 */

import { readFileSync } from "node:fs";
import { kellyFraction } from "@red-cup-engineering/position-sizing-service";
import { createRiskEnvelope, assertNoLiabilityBeyondStake } from "../src/risk-envelope.mjs";
import { createExecutionIntent } from "../src/execution-intent.mjs";

function requireFiniteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`size-position-from-edge: ${label} must be a finite number, got ${JSON.stringify(value)}`);
  return value;
}

/**
 * Turns a Kelly fraction into a notional against a risk stake -- bounded-stake
 * aggression, not bankroll-preservation caution. The ONLY clamp is structural:
 * notional can never exceed the unlevered `riskStakeAmount`, because sizing
 * beyond it would require leverage that can create liability BEYOND the stake
 * (the one forbidden thing per the growth-policy note) -- it is never a
 * caution haircut on the edge itself.
 * @param {object} params
 * @param {number} params.riskStakeAmount The walled, losable-to-zero risk-capital amount; must be > 0. Never survival/working capital.
 * @param {number} params.kellyFraction The measured Kelly fraction; may exceed 1 (an aggressionMultiplier can push past full Kelly).
 * @param {number} [params.aggressionMultiplier] Multiplies the Kelly fraction before the unlevered clamp; defaults to 1 (full Kelly, "or beyond" via >1).
 * @returns {{notional: number, kellyFraction: number, appliedFraction: number, cappedByUnleveredStake: boolean}}
 * @throws {TypeError} when `riskStakeAmount` is not positive or `kellyFraction`/`aggressionMultiplier` is negative/non-finite.
 */
export function sizeStakeFromKellyFraction({ riskStakeAmount, kellyFraction: kelly, aggressionMultiplier = 1 }) {
  requireFiniteNumber(riskStakeAmount, "riskStakeAmount");
  if (riskStakeAmount <= 0) throw new TypeError(`size-position-from-edge: riskStakeAmount must be > 0, got ${riskStakeAmount}`);
  requireFiniteNumber(kelly, "kellyFraction");
  if (kelly < 0) throw new TypeError(`size-position-from-edge: kellyFraction must be >= 0, got ${kelly}`);
  requireFiniteNumber(aggressionMultiplier, "aggressionMultiplier");
  if (aggressionMultiplier < 0) throw new TypeError(`size-position-from-edge: aggressionMultiplier must be >= 0, got ${aggressionMultiplier}`);
  const requestedFraction = kelly * aggressionMultiplier;
  const appliedFraction = Math.min(1, requestedFraction);
  return {
    notional: appliedFraction * riskStakeAmount,
    kellyFraction: kelly,
    appliedFraction,
    cappedByUnleveredStake: requestedFraction > 1,
  };
}

/**
 * Sizes a position from a MEASURED (never raw-signal) edge and builds its
 * execution intent. Refuses to size when the measured edge is non-positive
 * (the imported `kellyFraction` clamped to >= 0 here) -- there is nothing to bet.
 * @param {object} input
 * @param {{hitRate: number, averageWin: number, averageLoss: number}} input.measuredEdge The holdout-fold trade statistics from measureFusedSignalEdge.
 * @param {object} input.envelope `createRiskEnvelope` fields.
 * @param {number} [input.aggressionMultiplier] Passed to `sizeStakeFromKellyFraction`; defaults to 1 (full Kelly).
 * @param {string} input.strategyId
 * @param {string} input.entity
 * @param {"increase"|"decrease"} input.direction
 * @param {string} input.createdAt
 * @returns {{kellyFraction: number, sizing: object, cap: object, intent: object}}
 */
export function sizePositionFromEdge({ measuredEdge, envelope: envelopeFields, aggressionMultiplier = 1, strategyId, entity, direction, createdAt }) {
  const envelope = createRiskEnvelope(envelopeFields);
  // a degenerate edge (all-win or all-loss holdout) has no payoff ratio; treat as no bet rather than throw
  const kelly = measuredEdge.averageWin > 0 && measuredEdge.averageLoss > 0
    ? Math.max(0, kellyFraction({ winProbability: measuredEdge.hitRate, payoffRatio: measuredEdge.averageWin / measuredEdge.averageLoss }))
    : 0;
  const sizing = sizeStakeFromKellyFraction({ riskStakeAmount: envelope.riskStakeAmount, kellyFraction: kelly, aggressionMultiplier });
  const cap = assertNoLiabilityBeyondStake(sizing.notional, envelope);
  const intent = createExecutionIntent({ strategyId, entity, direction, sizedNotional: cap.notional, envelope, createdAt });
  return { kellyFraction: kelly, sizing, cap, intent };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , inputPath] = process.argv;
  const input = JSON.parse(readFileSync(inputPath, "utf8"));
  console.log(JSON.stringify(sizePositionFromEdge(input), null, 2));
}
