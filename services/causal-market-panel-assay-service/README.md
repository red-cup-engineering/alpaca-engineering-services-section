# causal-market-panel-assay-service

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Causally aligns observed entity series and refuses leakage, duplicate time, or malformed measures.

`assayCausalPanel({ seriesByEntity, asOf })` takes per-entity arrays of
`{ at, value, auxiliary? }` observations. It normalizes timestamps to UTC
and returns the observations shared by every entity, in time order. Values
must be finite numbers or nonempty numeric strings. Duplicate timestamps and
observations later than `asOf` fail even if they would be dropped by alignment.

Run `npm test` to verify alignment, cutoff enforcement, and malformed inputs.
