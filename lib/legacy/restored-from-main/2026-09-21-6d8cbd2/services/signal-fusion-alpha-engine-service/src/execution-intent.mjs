/**
 * The autonomous execution interface shape: arm-once-then-autonomous, no
 * per-trade human approval. THIS PASS never fires a real trade -- no
 * armed wallet exists yet -- so every intent this module produces is
 * `simulatedOnly: true`; the shape is what a real executor would consume.
 */

/** @typedef {import("./risk-envelope.mjs").RiskEnvelope} RiskEnvelope */

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`execution-intent: ${label} must be a non-empty string, got ${JSON.stringify(value)}`);
  return value;
}

/**
 * Builds one autonomous execution intent. `requiresHumanApproval` is
 * always `false` by construction -- the design never has a per-trade
 * approval field to flip; `wouldExecuteAutonomously` reflects only
 * whether the envelope is armed, and `simulatedOnly`/`realCapitalAtRisk`
 * report this pass's actual state honestly rather than a design promise.
 * @param {object} params
 * @param {string} params.strategyId Identifies the belief/strategy this intent executes.
 * @param {string} params.entity The traded entity.
 * @param {"increase"|"decrease"} params.direction The belief direction driving this intent.
 * @param {number} params.sizedNotional The Kelly-sized, envelope-capped notional (see @red-cup-engineering/position-sizing-service, scripts/size-position-from-edge.mjs, risk-envelope.mjs).
 * @param {Readonly<RiskEnvelope>} params.envelope The risk envelope this intent is sized under.
 * @param {string} params.createdAt ISO 8601 timestamp.
 * @returns {Readonly<object>} the frozen execution intent record.
 * @throws {TypeError} when any required field is missing or malformed.
 */
export function createExecutionIntent({ strategyId, entity, direction, sizedNotional, envelope, createdAt }) {
  requireNonEmptyString(strategyId, "strategyId");
  requireNonEmptyString(entity, "entity");
  if (direction !== "increase" && direction !== "decrease") throw new TypeError(`execution-intent: direction must be "increase" or "decrease", got ${JSON.stringify(direction)}`);
  if (typeof sizedNotional !== "number" || !Number.isFinite(sizedNotional) || sizedNotional < 0) throw new TypeError("execution-intent: sizedNotional must be a non-negative finite number");
  if (typeof envelope !== "object" || envelope === null || typeof envelope.armed !== "boolean") throw new TypeError("execution-intent: envelope must be a RiskEnvelope");
  requireNonEmptyString(createdAt, "createdAt");
  return Object.freeze({
    type: "AutonomousExecutionIntent",
    strategyId,
    entity,
    direction,
    sizedNotional,
    requiresHumanApproval: false,
    wouldExecuteAutonomously: envelope.armed,
    killSwitch: "automatic-circuit-breaker",
    simulatedOnly: true,
    realCapitalAtRisk: false,
    createdAt,
  });
}
