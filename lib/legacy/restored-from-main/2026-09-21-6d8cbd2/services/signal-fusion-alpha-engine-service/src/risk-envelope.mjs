/**
 * The armed envelope from the growth-policy note's "automated means
 * automated" section: the founder arms ONCE; thereafter the ONLY stop is
 * an automatic circuit breaker, never a per-trade permission prompt. This
 * module has no code path referencing any capital pool but
 * `riskStakeAmount` -- survival capital is walled off by omission.
 */

function requirePositive(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new TypeError(`risk-envelope: ${label} must be a finite number > 0, got ${JSON.stringify(value)}`);
  return value;
}
function requireUnitInterval(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new TypeError(`risk-envelope: ${label} must be in [0,1], got ${JSON.stringify(value)}`);
  return value;
}
function requireNonEmptyStringArray(value, label) {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    throw new TypeError(`risk-envelope: ${label} must be a non-empty array of non-empty strings`);
  }
  return value;
}

/** @typedef {{riskStakeAmount: number, admittedStrategies: string[], autoHaltDrawdownFloor: number, armed: boolean, armedAt: string|null, signingCapabilityRef: string|null}} RiskEnvelope */

/**
 * Creates an unarmed risk envelope. `riskStakeAmount` is the ONLY capital
 * figure this module ever handles -- survival/working capital is walled
 * off by never being representable here at all, not by a runtime check.
 * @param {object} params
 * @param {number} params.riskStakeAmount Walled, losable-to-zero risk capital; must be > 0.
 * @param {string[]} params.admittedStrategies Strategy identifiers this envelope authorizes.
 * @param {number} params.autoHaltDrawdownFloor Fraction of the stake, in [0,1); a drawdown at or beyond this fraction trips the auto-halt.
 * @returns {Readonly<RiskEnvelope>} an unarmed envelope (`armed: false`).
 * @throws {TypeError} when any field is malformed.
 */
export function createRiskEnvelope({ riskStakeAmount, admittedStrategies, autoHaltDrawdownFloor }) {
  const stake = requirePositive(riskStakeAmount, "riskStakeAmount");
  const strategies = requireNonEmptyStringArray(admittedStrategies, "admittedStrategies");
  const floor = requireUnitInterval(autoHaltDrawdownFloor, "autoHaltDrawdownFloor");
  if (floor >= 1) throw new TypeError("risk-envelope: autoHaltDrawdownFloor must be < 1");
  return Object.freeze({ riskStakeAmount: stake, admittedStrategies: Object.freeze([...strategies]), autoHaltDrawdownFloor: floor, armed: false, armedAt: null, signingCapabilityRef: null });
}

/**
 * The founder's one-time hands step: arms an envelope with a signing
 * capability reference. Never called per-trade -- everything after this
 * is autonomous.
 * @param {Readonly<RiskEnvelope>} envelope
 * @param {{armedAt: string, signingCapabilityRef: string}} arming
 * @returns {Readonly<RiskEnvelope>} the same envelope with `armed: true`.
 * @throws {TypeError} when `armedAt` or `signingCapabilityRef` is missing, or the envelope is already armed.
 */
export function armRiskEnvelope(envelope, { armedAt, signingCapabilityRef }) {
  if (envelope.armed) throw new TypeError("risk-envelope: envelope is already armed");
  if (typeof armedAt !== "string" || Number.isNaN(Date.parse(armedAt))) throw new TypeError("risk-envelope: armedAt must be a parseable ISO 8601 date");
  if (typeof signingCapabilityRef !== "string" || signingCapabilityRef.trim().length === 0) throw new TypeError("risk-envelope: signingCapabilityRef must be a non-empty string");
  return Object.freeze({ ...envelope, armed: true, armedAt, signingCapabilityRef });
}

/**
 * The automatic circuit breaker -- the ONLY kill-switch this module
 * defines, and it is never a request for human permission. Halts the
 * moment the stake's value hits or crosses the envelope's drawdown floor.
 * @param {Readonly<RiskEnvelope>} envelope
 * @param {number} currentStakeValue The risk stake's current mark-to-market value.
 * @returns {{halt: boolean, reason: string|null, drawdown: number}}
 * @throws {TypeError} when `currentStakeValue` is not a finite number.
 */
export function checkAutoHalt(envelope, currentStakeValue) {
  if (typeof currentStakeValue !== "number" || !Number.isFinite(currentStakeValue)) throw new TypeError("risk-envelope: currentStakeValue must be a finite number");
  const drawdown = Math.max(0, 1 - currentStakeValue / envelope.riskStakeAmount);
  const halt = drawdown >= envelope.autoHaltDrawdownFloor;
  return { halt, reason: halt ? `drawdown ${drawdown.toFixed(4)} reached auto-halt floor ${envelope.autoHaltDrawdownFloor}` : null, drawdown };
}

/**
 * The one hard structural cap named by the growth-policy note: notional
 * exposure can never exceed the unlevered risk stake, because exceeding
 * it requires borrowing -- liability beyond the stake, the one real ruin.
 * @param {number} notional A proposed position notional.
 * @param {Readonly<RiskEnvelope>} envelope
 * @returns {{admitted: boolean, notional: number, reason: string|null}} `notional` clamped to the stake when the proposal exceeds it.
 */
export function assertNoLiabilityBeyondStake(notional, envelope) {
  if (typeof notional !== "number" || !Number.isFinite(notional) || notional < 0) throw new TypeError("risk-envelope: notional must be a non-negative finite number");
  if (notional > envelope.riskStakeAmount) {
    return { admitted: false, notional: envelope.riskStakeAmount, reason: "proposed notional exceeds the unlevered risk stake -- clamped, never leveraged" };
  }
  return { admitted: true, notional, reason: null };
}
