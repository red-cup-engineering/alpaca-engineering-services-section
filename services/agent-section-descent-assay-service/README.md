# Agent Section Descent Assay

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

**Compare forecasts from independent agents without erasing disagreement.**
This is a JavaScript *assay library* for sets of provider-reported forecasts:
each forecast names a provider, a market coordinate, a signed numeric value,
a confidence, and optional cited sources and observation times. It asks
which coordinates agents actually overlap on, how their measurements differ,
and whether contradictory evidence requires review.

It is **not** an agent runtime, an exchange, a trading strategy, a forecast
calibration engine, or a mathematical proof that local forecast sections form
a global sheaf.

## Where to begin

The package is
`@red-cup-engineering/agent-section-descent-assay-service`.
Its root export is
[`createAgentSectionDescentAssay`](src/assay.mjs).

```js
import { createAgentSectionDescentAssay } from
  '@red-cup-engineering/agent-section-descent-assay-service';

// Supply a real, independently implemented measurement of the overlap graph.
// The library does not fabricate disagreement energy on your behalf.
const assay = createAgentSectionDescentAssay({ measureSheafLaplacian });

const observation = assay({
  sections: [
    { provider: 'forecast-A', coordinate: 'BLK:5', value: 0.12,
      confidence: 0.8, evidenceReferences: ['source-1'] },
    { provider: 'forecast-B', coordinate: 'BLK:5', value: -0.07,
      confidence: 0.7, evidenceReferences: ['source-1'] }
  ],
  confidenceFloor: 0.5,
  agreementTolerance: 0.02
});
```

Here `measureSheafLaplacian` is **a required caller-supplied function**,
not an import furnished by this package. It receives
`{ sections, edges }`: a map from section index to numeric forecast
and confidence-weighted edges connecting overlapping coordinates.
It must return an object with `disagreementEnergy`. The package does not
independently certify that the measurement function implements the right
Laplacian or physically meaningful energy. Replace it with an appropriately
qualified implementation before interpreting numerical results.

## Interpreting the result

The returned `AgentSectionDescentAssay` distinguishes:

- `coordinateReadings`: per-coordinate positive and negative evidence,
  confidence qualification, and conflicting readings;
- `contradictionHeld` and `reviewRequired`: disagreement remains visible;
- `sharedSourceReferences`: duplicated citations are surfaced rather than
  automatically counted as independent evidence;
- `comparedEdgeCount` and `overlapObserved`: whether comparisons had an
  actual common coordinate;
- `disagreementEnergy` and `gluesWithinTolerance`: numerical observations
  conditional on the supplied Laplacian and explicit tolerance.

`sheafGluingProven` and `sourceIndependenceEstablished` are **false** in
the product; `confidenceCalibrationEstablished` is also false.
`forcedConsensus` is false and `effect` is `assay-only`.
Agreement within an arbitrary tolerance is not a theorem of global
compatibility, an authenticated source claim, or evidence of profitable
trading.

If `asOf` is supplied, it must use the existing absolute SEAVT clock
representation, not an arbitrary local-time string. Source observation,
publication, and reception remain distinct; a provider's timestamp is
not independent proof of when a cited fact became available.

## Scope, verification, and status

The complete [implementation](src/assay.mjs) consumes SignCell, SignChain,
SignCraft, and semiotic EAVT services supplied by its dependency workspace.
It returns immutable observation and review carriers; its caller remains
responsible for persistence, source authentication, and any effects.

[Input-refusal tests](test/assay.test.mjs) exercise required measurement
injection, the minimum number of agents, duplicate-coordinate reports,
confidence limits, and malformed evidence. From a workspace with the
declared dependencies resolved, run `npm test`. The presence of test
source does not establish a passing installation or external runtime.

For the wider agent system architecture, see
[Agent Computer System Engineering](https://github.com/red-cup-engineering/agent-computer-system-engineering-services-section).
