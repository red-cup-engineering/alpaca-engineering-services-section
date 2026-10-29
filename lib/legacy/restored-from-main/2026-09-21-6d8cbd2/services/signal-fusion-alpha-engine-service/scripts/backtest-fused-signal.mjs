/**
 * CLI: `node backtest-fused-signal.mjs <input.json>`. Reads
 * `{coordinates, periods, entity, beliefDirection, warmup, horizon,
 * trainingWindow, transactionCostBps, periodsPerYear}` and prints the
 * measured out-of-sample edge -- the honest number, holdout untouched.
 */

import { readFileSync } from "node:fs";
import { measureFusedSignalEdge } from "../src/backtest-edge.mjs";

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , inputPath] = process.argv;
  const input = JSON.parse(readFileSync(inputPath, "utf8"));
  const result = measureFusedSignalEdge(input);
  console.log(JSON.stringify({
    methodology: result.methodology,
    foldCounts: { total: result.folds.folds.length, validation: result.folds.validation.length, holdout: result.folds.holdout.length },
    validationMetrics: result.validation.metrics,
    holdoutMetrics: result.holdout.metrics,
  }, null, 2));
}
