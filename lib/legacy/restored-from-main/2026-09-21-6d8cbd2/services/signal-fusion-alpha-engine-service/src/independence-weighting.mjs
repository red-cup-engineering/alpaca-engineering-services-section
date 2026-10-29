/**
 * Operationalizes the founder thesis (2026-09-01: "stacking many
 * independent weak PUBLIC signals manufactures a real edge") honestly:
 * many correlated signals from one `independenceTag` family must not
 * count as many independent votes. Shrinks each signal's effective
 * weight by the size of its own independence-tag group before fusion.
 */

/** @typedef {import("./signal.mjs").Signal} Signal */

/**
 * Groups signals by `independenceTag` and scales each signal's `strength`
 * by `1/sqrt(groupSize)` -- the standard correlated-evidence shrinkage: N
 * signals from the same tag contribute like `sqrt(N)` independent signals,
 * not N. A signal alone in its tag group is unaffected (divisor 1).
 * @param {Signal[]} signals
 * @returns {(Signal & {effectiveStrength: number, independenceGroupSize: number})[]} the same signals, each carrying its shrunk `effectiveStrength` alongside the original `strength`.
 * @throws {TypeError} when `signals` is not a non-empty array.
 */
export function weightSignalsByIndependence(signals) {
  if (!Array.isArray(signals) || signals.length === 0) {
    throw new TypeError("independence-weighting: signals must be a non-empty array");
  }
  const groupSizes = new Map();
  for (const signal of signals) {
    groupSizes.set(signal.independenceTag, (groupSizes.get(signal.independenceTag) ?? 0) + 1);
  }
  return signals.map((signal) => {
    const groupSize = groupSizes.get(signal.independenceTag);
    return Object.freeze({
      ...signal,
      effectiveStrength: signal.strength / Math.sqrt(groupSize),
      independenceGroupSize: groupSize,
    });
  });
}
