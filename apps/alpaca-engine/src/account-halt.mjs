// The account-level halt for a principal's Alpaca mandate: the breaker the
// per-order caps (maximumOrderNotional, maximumLossAmount, concentration) are
// not.  Its rule is the retired alpaca-account-kill-switch-service's
// evaluateKillSwitch, carried here because that service was retired to a
// replacement that never landed, leaving both loops without one:
//
//   - drawdown from the high-water mark of account equity above
//     maximumDrawdownFraction (10% unless the contract declares one);
//   - the day's loss against Alpaca's own `last_equity` (equity at the prior
//     close) above maximumDailyLossFraction (3% unless declared);
//   - equity under equityFloorAmount, when the contract declares one (the
//     Kalshi desk's equity floor).
//
// It reads only account evidence already in hand: the portfolio cycle's own
// observation, or the equity the market game sized a fleet decision on (its
// `account` moves). With no account evidence the game decides nothing, so
// there is nothing to halt; the halt lifts when evidence back inside the
// limits enters the game, or when the contract's declared limits change.
//
// A paper account reset (equity landing within 2% of the $100,000 reset
// figure under a higher mark, the 2026-07-23 false trip) rebaselines the mark
// instead of tripping; a live account is never rebaselined.  A halt places
// nothing: the mandate's positions stand and the next cycle re-reads the
// account.  Time alone never lifts it.

export const DEFAULT_HALT_LIMITS = Object.freeze({ maximumDrawdownFraction: 0.10, maximumDailyLossFraction: 0.03, equityFloorAmount: null });
export const PAPER_ACCOUNT_RESET_BASELINE = 100_000;
export const PAPER_ACCOUNT_RESET_TOLERANCE = 0.02;

const fraction = (value, fallback, label) => {
  if (value === undefined || value === null) return fallback;
  if (!(Number.isFinite(value) && value > 0 && value < 1)) throw new RangeError(`${label}-out-of-range`);
  return value;
};

/** The halt limits a contract declares, its risk block's, defaulting to the retired kill switch's. */
export function haltLimitsOf(contract) {
  const risk = contract?.risk ?? {};
  const floor = risk.equityFloorAmount;
  if (floor !== undefined && floor !== null && !(Number.isFinite(floor) && floor >= 0)) throw new RangeError("equity-floor-amount-out-of-range");
  return Object.freeze({
    maximumDrawdownFraction: fraction(risk.maximumDrawdownFraction, DEFAULT_HALT_LIMITS.maximumDrawdownFraction, "maximum-drawdown-fraction"),
    maximumDailyLossFraction: fraction(risk.maximumDailyLossFraction, DEFAULT_HALT_LIMITS.maximumDailyLossFraction, "maximum-daily-loss-fraction"),
    equityFloorAmount: floor ?? null,
  });
}

const amount = (value) => (value === undefined || value === null || value === "" ? NaN : Number(value));

/**
 * Pure evaluation of one account reading.  `account` is Alpaca's account
 * payload (`equity`, `last_equity`, as strings or numbers); `priorHighWaterMark`
 * is the mark the last cycle recorded, or null on the first.  Returns the
 * reading, the mark to record, and whether it halts and why.
 */
export function evaluateAccountHalt({ account, priorHighWaterMark = null, limits = DEFAULT_HALT_LIMITS, mode }) {
  if (mode !== "paper" && mode !== "live") throw new TypeError("alpaca-mode-required");
  const equity = amount(account?.equity);
  if (!(Number.isFinite(equity) && equity > 0)) throw new TypeError("broker-account-equity-required");
  const lastEquity = amount(account?.last_equity ?? account?.lastEquity);
  const prior = Number.isFinite(priorHighWaterMark) && priorHighWaterMark > 0 ? priorHighWaterMark : null;
  const base = prior ?? equity;
  const resetDetected = mode === "paper" && prior !== null
    && Math.abs(equity - PAPER_ACCOUNT_RESET_BASELINE) <= PAPER_ACCOUNT_RESET_BASELINE * PAPER_ACCOUNT_RESET_TOLERANCE
    && prior > PAPER_ACCOUNT_RESET_BASELINE * (1 + PAPER_ACCOUNT_RESET_TOLERANCE);
  const highWaterMark = resetDetected ? equity : Math.max(base, equity);
  const drawdownFraction = resetDetected ? 0 : (highWaterMark - equity) / highWaterMark;
  const hasLastEquity = !resetDetected && Number.isFinite(lastEquity) && lastEquity > 0;
  const dailyLossFraction = hasLastEquity && equity < lastEquity ? (lastEquity - equity) / lastEquity : 0;
  const reasons = [];
  if (drawdownFraction > limits.maximumDrawdownFraction) reasons.push(`drawdown ${(drawdownFraction * 100).toFixed(3)}% from high-water mark ${highWaterMark.toFixed(2)} exceeds ${(limits.maximumDrawdownFraction * 100).toFixed(1)}%`);
  if (dailyLossFraction > limits.maximumDailyLossFraction) reasons.push(`daily loss ${(dailyLossFraction * 100).toFixed(3)}% from last close ${lastEquity.toFixed(2)} exceeds ${(limits.maximumDailyLossFraction * 100).toFixed(1)}%`);
  if (limits.equityFloorAmount !== null && equity < limits.equityFloorAmount) reasons.push(`equity ${equity.toFixed(2)} under the floor ${limits.equityFloorAmount.toFixed(2)}`);
  return Object.freeze({
    type: "AlpacaAccountHaltEvaluation", version: 1, mode, equity, lastEquity: hasLastEquity ? lastEquity : null,
    priorHighWaterMark: prior, highWaterMark, highWaterMarkSource: prior === null ? "this-reading" : "recorded",
    drawdownFraction, dailyLossFraction, resetDetected, limits, halted: reasons.length > 0, reasons: Object.freeze(reasons),
  });
}
