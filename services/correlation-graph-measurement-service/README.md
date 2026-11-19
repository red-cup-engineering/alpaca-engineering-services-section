# correlation-graph-measurement-service

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Constructs a finite weighted relation from causally bounded entity-return histories.

`measureCorrelationGraph({ returnsByEntity })` measures Pearson correlations
between equal-length, prealigned histories of at least three observations.
The default returns positively correlated edges. Set `positiveOnly: false`
to include inverse relationships with `transport: -1`.
`minimumAbsoluteCorrelation` sets an optional cutoff in [0, 1].

Missing values, constant histories, and nonfinite moments fail. Run
`npm test` to check signed edges and these refusal cases.
