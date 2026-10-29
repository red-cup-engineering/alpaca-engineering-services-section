/**
 * The honesty guard for a wide asset x signal grid: Benjamini-Hochberg
 * (1995) FDR and Bonferroni correction over the grid's holdout p-values.
 */

function erf(x) {
  // Abramowitz & Stegun 7.1.26, |error| < 1.5e-7 -- ample precision for a p-value gate
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

function standardNormalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Converts a purged-walk-forward holdout's annualized `informationRatio`
 * back to the per-combo t-statistic for the null hypothesis "mean net
 * return per period is 0", using `informationRatio = (mean/stdDev) *
 * sqrt(periodsPerYear)`, so `t = informationRatio * sqrt(periods /
 * periodsPerYear)`.
 * @param {object} params
 * @param {number} params.informationRatio The holdout replay's annualized information ratio.
 * @param {number} params.periods The holdout replay's period count (`metrics.periods`).
 * @param {number} params.periodsPerYear The annualization base used to compute `informationRatio`.
 * @returns {number} the t-statistic.
 */
export function tStatisticFromInformationRatio({ informationRatio, periods, periodsPerYear }) {
  if (!Number.isFinite(informationRatio) || !Number.isFinite(periods) || periods <= 0 || !Number.isFinite(periodsPerYear) || periodsPerYear <= 0) {
    throw new TypeError("multiple-testing-correction: informationRatio, periods, periodsPerYear must be finite and periods/periodsPerYear positive");
  }
  return informationRatio * Math.sqrt(periods / periodsPerYear);
}

/**
 * Two-tailed p-value for a t-statistic under the standard-normal
 * approximation to the t-distribution (accurate for the large-sample
 * holdouts this engine produces).
 * @param {number} tStatistic
 * @returns {number} p-value in (0, 1].
 */
export function twoTailedPValue(tStatistic) {
  if (!Number.isFinite(tStatistic)) throw new TypeError("multiple-testing-correction: tStatistic must be finite");
  return Math.min(1, 2 * (1 - standardNormalCdf(Math.abs(tStatistic))));
}

/**
 * The Benjamini-Hochberg (1995) step-up false-discovery-rate procedure:
 * sorts p-values ascending, finds the largest rank `k` with `p(k) <=
 * (k/m)*q`, and calls every p-value at or below that rank significant.
 * @param {number[]} pValues One p-value per tested combo, any order.
 * @param {number} [q] Target false-discovery rate; defaults to 0.10.
 * @returns {{significant: boolean[], adjustedPValues: number[], thresholdRank: number|null}}
 *   `significant`/`adjustedPValues` are index-aligned with the input `pValues`; `thresholdRank` is the largest rank `k` that cleared the BH line, or `null` when none did.
 */
export function benjaminiHochberg(pValues, q = 0.10) {
  if (!Array.isArray(pValues) || pValues.length === 0) throw new TypeError("multiple-testing-correction: pValues must be a non-empty array");
  if (!(q > 0 && q < 1)) throw new TypeError("multiple-testing-correction: q must be in (0,1)");
  const m = pValues.length;
  const ordered = pValues.map((pValue, index) => ({ pValue, index })).sort((a, b) => a.pValue - b.pValue);
  let thresholdRank = null;
  for (let rank = m; rank >= 1; rank -= 1) {
    if (ordered[rank - 1].pValue <= (rank / m) * q) { thresholdRank = rank; break; }
  }
  // BH-adjusted p-values (q-values): monotone non-decreasing from the largest rank down
  const adjustedOrdered = new Array(m);
  let runningMin = 1;
  for (let rank = m; rank >= 1; rank -= 1) {
    const raw = ordered[rank - 1].pValue * m / rank;
    runningMin = Math.min(runningMin, raw);
    adjustedOrdered[rank - 1] = runningMin;
  }
  const significant = new Array(m).fill(false);
  const adjustedPValues = new Array(m);
  ordered.forEach(({ index }, rank0) => {
    const rank = rank0 + 1;
    adjustedPValues[index] = adjustedOrdered[rank0];
    significant[index] = thresholdRank !== null && rank <= thresholdRank;
  });
  return { significant, adjustedPValues, thresholdRank };
}

/**
 * The stricter Bonferroni family-wise correction: significant only when
 * `pValue <= alpha / m`.
 * @param {number[]} pValues One p-value per tested combo, any order.
 * @param {number} [alpha] Family-wise error rate; defaults to 0.05.
 * @returns {{significant: boolean[], correctedAlpha: number}} `significant` is index-aligned with the input.
 */
export function bonferroniCorrection(pValues, alpha = 0.05) {
  if (!Array.isArray(pValues) || pValues.length === 0) throw new TypeError("multiple-testing-correction: pValues must be a non-empty array");
  if (!(alpha > 0 && alpha < 1)) throw new TypeError("multiple-testing-correction: alpha must be in (0,1)");
  const correctedAlpha = alpha / pValues.length;
  return { significant: pValues.map((pValue) => pValue <= correctedAlpha), correctedAlpha };
}
