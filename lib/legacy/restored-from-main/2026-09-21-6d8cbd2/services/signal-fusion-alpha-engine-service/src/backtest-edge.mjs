/**
 * Measures a fused signal's real, out-of-sample edge. Composes three
 * already-published house primitives rather than re-authoring a harness:
 * `formPurgedWalkForwardFolds` (chronological purge/split),
 * `fuseBeliefWithEvidence` (trading-belief-service's bilattice fusion),
 * and `replayTransactionCosts` (cost-aware metrics, hit rate/expectancy).
 */

import { formPurgedWalkForwardFolds } from "@red-cup-engineering/purged-walk-forward-fold-service";
import { fuseBeliefWithEvidence } from "@red-cup-engineering/trading-belief-service/evidence-fusion";
import { replayTransactionCosts } from "@red-cup-engineering/transaction-cost-replay-service";
import { weightSignalsByIndependence } from "./independence-weighting.mjs";
import { signalsToBeliefObservations } from "./signal-to-belief-observations.mjs";

/** @typedef {import("./signal.mjs").Signal} Signal */
/** @typedef {{date: string, signals: Signal[], realizedReturn: number}} BacktestPeriod One day's signals plus that entity's realized return over the fold's horizon. */

function requireBeliefDirection(value) {
  if (value !== "increase" && value !== "decrease") throw new TypeError(`backtest-edge: beliefDirection must be "increase" or "decrease", got ${JSON.stringify(value)}`);
  return value;
}

/**
 * Turns one fold's prediction-time signals into a position weight in
 * [-1,1]: fuses them via {@link fuseBeliefWithEvidence}'s `supportFraction`
 * (a real bilattice fusion of supports/contradicts, not a re-implementation),
 * rescaled around 0.5 so full agreement gives +1/-1 and even support gives
 * 0. A prediction period with no non-neutral signals abstains (weight 0).
 * @param {Signal[]} signals
 * @param {"increase"|"decrease"} beliefDirection
 * @param {string} entity The entity this belief concerns (e.g. "BTC").
 * @returns {{weight: number, conflicted: boolean, observationCount: number}}
 */
export function beliefWeightFromSignals(signals, beliefDirection, entity) {
  requireBeliefDirection(beliefDirection);
  const nonNeutral = signals.filter((signal) => signal.direction !== "neutral" && signal.entity === entity);
  if (nonNeutral.length === 0) return { weight: 0, conflicted: false, observationCount: 0 };
  const weighted = weightSignalsByIndependence(nonNeutral);
  const observations = signalsToBeliefObservations(weighted, beliefDirection);
  const fused = fuseBeliefWithEvidence(observations);
  const directionSign = beliefDirection === "increase" ? 1 : -1;
  return { weight: directionSign * (2 * fused.supportFraction - 1), conflicted: fused.conflicted, observationCount: observations.length };
}

/**
 * MEASURES a fused signal's out-of-sample edge by purged walk-forward
 * backtest. For every fold, the prediction-time belief weight (fused from
 * ONLY that fold's own signals -- never later data, guarding look-ahead)
 * is applied to the entity's realized return at the fold's outcome
 * coordinate; folds are then split into `validation` (usable for any
 * threshold tuning) and untouched `holdout` (the reported edge), per
 * `formPurgedWalkForwardFolds`'s own chronological split.
 * @param {object} input
 * @param {string[]} input.coordinates Ordered ISO-date coordinates, one per period, index-aligned with `periods`.
 * @param {BacktestPeriod[]} input.periods Index-aligned with `coordinates`; each period's own `signals` are visible only to folds whose `prediction` index equals that period's index.
 * @param {string} input.entity The traded entity (e.g. "BTC").
 * @param {"increase"|"decrease"} input.beliefDirection The belief direction under test.
 * @param {number} input.warmup Minimum training history before the first fold, in periods.
 * @param {number} input.horizon Periods from prediction to outcome.
 * @param {number} input.trainingWindow Maximum training window length, in periods.
 * @param {number} [input.transactionCostBps] Linear cost in basis points; defaults to 0.
 * @param {number} [input.periodsPerYear] Annualization base; defaults to 365 (daily data).
 * @returns {{folds: object, validation: object, holdout: object, methodology: string}} `validation`/`holdout` are each `replayTransactionCosts` results (metrics include hitRate/expectancy/maximumDrawdown/informationRatio); `holdout` is the honest out-of-sample edge.
 * @throws {TypeError} when inputs are malformed or fold formation refuses them.
 */
export function measureFusedSignalEdge({ coordinates, periods, entity, beliefDirection, warmup, horizon, trainingWindow, transactionCostBps = 0, periodsPerYear = 365 }) {
  requireBeliefDirection(beliefDirection);
  if (!Array.isArray(periods) || periods.length !== coordinates.length) throw new TypeError("backtest-edge: periods must be index-aligned with coordinates");
  const folds = formPurgedWalkForwardFolds({ coordinates, warmup, horizon, trainingWindow });
  const toReplayPeriod = (fold) => {
    const predictionPeriod = periods[fold.prediction];
    const outcomePeriod = periods[fold.outcome];
    const { weight } = beliefWeightFromSignals(predictionPeriod.signals, beliefDirection, entity);
    return { at: fold.outcomeAt, weights: { [entity]: weight }, realizedReturns: { [entity]: outcomePeriod.realizedReturn } };
  };
  const replay = (foldSet) => replayTransactionCosts({ periods: foldSet.map(toReplayPeriod), transactionCostBps, periodsPerYear });
  return {
    folds,
    validation: replay(folds.validation),
    holdout: replay(folds.holdout),
    methodology: "purged chronological walk-forward split (formPurgedWalkForwardFolds); validation folds may inform tuning, holdout folds are untouched out-of-sample and are the reported edge",
  };
}
