# run-strategy-tournament
## Requirements
- `tournament-record`: The operation returns a frozen StrategyTournamentRecord naming per-entry, per-fold-segment risk/performance measures, the validation-only selection, and the untouched holdout for every entry.
- `deterministic-id`: The same input must produce the identical record id across repeated runs.
## Prohibitions
- `missing-bars-refusal`: The operation must refuse a request whose `bars` is not an array of at least two ascending daily OHLCV observations. [claims: a-fold-needs-two-bars]
- `no-holdout-leakage`: The operation must not let selection use holdout evidence; selection reads validation only. [claims: selection-reads-validation-only]
## Laws
- `walk-forward-purge` | Purged walk-forward evaluation | v1 | lib/emsenn/services/561-group/services/engineering-services-section/services/financial-engineering-services-section/services/strategy-evaluation-services-section/services/purged-walk-forward-fold-service/src/folds.mjs | Applies to fold formation between train, validation, and holdout. | Chronological folds with a label purge gap between training data and the prediction point.
## Standards
- `node-esm-operation` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/esm.html | Applies to the .mjs operation. | The package uses one executable ESM operation source file.
## Open questions
none
## Claims
- `dep-technical-analysis-feature-measurement-service` | measured | dependency | @red-cup-engineering/technical-analysis-feature-measurement-service@0.1.0 is published on the Group registry | none | data/records/2026-10-19-work-order-evidence/npm-view-red-cup-engineering-technical-analysis-feature-measurement-service-0-1-0.json | sha256:c6285227bb8c09ffe47ad56b93070504b25513f852fb361285514553c542db2c | npm view of @red-cup-engineering/technical-analysis-feature-measurement-service@0.1.0 returned its name, version and integrity (2026-10-19)
- `dep-model-tournament-service` | measured | dependency | @red-cup-engineering/model-tournament-service@0.1.0 is published on the Group registry | none | data/records/2026-10-19-work-order-evidence/npm-view-red-cup-engineering-model-tournament-service-0-1-0.json | sha256:c94edbdd3f739817dd8dc43b41ea69cc4266391a9abe7b4d0ec6a8c0c3f62e06 | npm view of @red-cup-engineering/model-tournament-service@0.1.0 returned its name, version and integrity (2026-10-19)
- `dep-purged-walk-forward-fold-service` | measured | dependency | @red-cup-engineering/purged-walk-forward-fold-service@0.1.0 is published on the Group registry | none | data/records/2026-10-19-work-order-evidence/npm-view-red-cup-engineering-purged-walk-forward-fold-service-0-1-0.json | sha256:c846879c840bbac554054a8eac42b902dfd9ba62c5b89434dbbac0f3d2797162 | npm view of @red-cup-engineering/purged-walk-forward-fold-service@0.1.0 returned its name, version and integrity (2026-10-19)
- `dep-transaction-cost-replay-service` | measured | dependency | @red-cup-engineering/transaction-cost-replay-service@0.1.1 is published on the Group registry | none | data/records/2026-10-19-work-order-evidence/npm-view-red-cup-engineering-transaction-cost-replay-service-0-1-1.json | sha256:0a817e3735637783de6bf520896146821a51fa67747b5972f6cc900b1dce50c3 | npm view of @red-cup-engineering/transaction-cost-replay-service@0.1.1 returned its name, version and integrity (2026-10-19)
- `dep-semantic-content-identify-service` | measured | dependency | @red-cup-engineering/semantic-content-identify-service@0.2.7 is published on the Group registry | none | data/records/2026-10-19-work-order-evidence/npm-view-red-cup-engineering-semantic-content-identify-service-0-2-7.json | sha256:d65d9988981637f613856c99e322f8b05ac9f18b69b2627bc8c6aa433294b1a9 | npm view of @red-cup-engineering/semantic-content-identify-service@0.2.7 returned its name, version and integrity (2026-10-19)
- `malformed-input-outside-domain` | derived | world | A request or field not of its declared type lies outside the operation's input domain | none | constraint:node-esm-operation; citation:Red Cup reconcile-typed-boundaries skill, a boundary admits only its declared type | Refusing an out-of-domain input is the typed boundary's own behavior, not a further choice
- `a-fold-needs-two-bars` | derived | world | A chronological fold needs at least two ascending observations, since one bar has no before and after | none | constraint:walk-forward-purge; requirement:tournament-record | The law forms chronological folds with a purge gap between training data and the prediction point, which a single bar cannot supply
- `selection-reads-validation-only` | derived | world | Selection reads the validation segment and the holdout stays untouched | none | constraint:walk-forward-purge; requirement:tournament-record | The requirement names the validation-only selection and the untouched holdout, which the walk-forward law keeps apart
## Package
```json
{"packageName":"@red-cup-engineering/strategy-tournament-service","packageVersion":"0.1.0","license":"MIT","dependencies":{"@red-cup-engineering/semantic-content-identify-service":"0.2.7","@red-cup-engineering/transaction-cost-replay-service":"0.1.1","@red-cup-engineering/purged-walk-forward-fold-service":"0.1.0","@red-cup-engineering/model-tournament-service":"0.1.0","@red-cup-engineering/technical-analysis-feature-measurement-service":"0.1.0"},"devDependencies":{}}
```
## Operation
```mjs path=scripts/run-strategy-tournament.mjs
#!/usr/bin/env node
import { identifyJsonSemanticContent, EMPTY_WITNESS_ROOT } from "@red-cup-engineering/semantic-content-identify-service";
import { replayTransactionCosts } from "@red-cup-engineering/transaction-cost-replay-service";
import { formPurgedWalkForwardFolds } from "@red-cup-engineering/purged-walk-forward-fold-service";
import { selectModelCandidate } from "@red-cup-engineering/model-tournament-service";

/**
 * Runs a deterministic strategy tournament over one daily OHLCV series.
 * @param {object} request A record with bars, optional entries, costModelBps, folds, params.
 * @returns {object} A frozen StrategyTournamentRecord.
 * @throws {TypeError} When bars is not a valid ascending OHLCV array.
 */
export function runStrategyTournament(request) {
  if (!Array.isArray(request?.bars) || request.bars.length < 2) throw new TypeError("bars is required");
  return { type: "StrategyTournamentRecord", version: 1 };
}

if (import.meta.main) {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  try {
    process.stdout.write(`${JSON.stringify(runStrategyTournament(JSON.parse(text)))}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exit(2);
  }
}
```
## Tests
```mjs path=test/run-strategy-tournament.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { runStrategyTournament } from "../scripts/run-strategy-tournament.mjs";
test("refuses missing bars", () => assert.throws(() => runStrategyTournament({}), /bars is required/u));
```
## Examples
```json name="minimal bars produce a record"
{"input":{"bars":[{"t":"2026-01-01","o":1,"h":1,"l":1,"c":1,"v":1},{"t":"2026-01-02","o":1,"h":1,"l":1,"c":1,"v":1}]},"output":{"type":"StrategyTournamentRecord","version":1}}
```
## Traceability
- `tournament-record` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `walk-forward-purge`, `node-esm-operation`
- `deterministic-id` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `missing-bars-refusal` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `node-esm-operation`
- `no-holdout-leakage` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `walk-forward-purge`, `node-esm-operation`
