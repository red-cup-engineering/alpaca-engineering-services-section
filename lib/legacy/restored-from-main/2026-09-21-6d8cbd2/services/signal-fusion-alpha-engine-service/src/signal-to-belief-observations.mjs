/** Bridges Signal[] onto trading-belief-service's BeliefObservation shape; translation only, fusion stays in trading-belief-service. */

/** @typedef {import("./signal.mjs").Signal} Signal */
/** @typedef {{stance: "supports"|"contradicts", description: string, weight?: number}} BeliefObservation */

/**
 * Converts independence-weighted signals into belief observations against
 * one stated belief `direction`; agreement supports, disagreement
 * contradicts, "neutral" signals are dropped (no stance).
 * @param {(Signal & {effectiveStrength: number})[]} weightedSignals
 * @param {"increase"|"decrease"} beliefDirection
 * @returns {BeliefObservation[]} `weight` set to each signal's `effectiveStrength`.
 * @throws {TypeError} when inputs are malformed.
 */
export function signalsToBeliefObservations(weightedSignals, beliefDirection) {
  if (!Array.isArray(weightedSignals)) throw new TypeError("signal-to-belief-observations: weightedSignals must be an array");
  if (beliefDirection !== "increase" && beliefDirection !== "decrease") {
    throw new TypeError(`signal-to-belief-observations: beliefDirection must be "increase" or "decrease", got ${JSON.stringify(beliefDirection)}`);
  }
  return weightedSignals
    .filter((signal) => signal.direction !== "neutral")
    .map((signal) => describeObservation(signal, beliefDirection));
}

function describeObservation(signal, beliefDirection) {
  return {
    stance: signal.direction === beliefDirection ? "supports" : "contradicts",
    description: `${signal.sourceKind}:${signal.source} -- ${signal.description}`,
    weight: signal.effectiveStrength,
  };
}
