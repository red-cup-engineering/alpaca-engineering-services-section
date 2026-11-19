# deterministic-ridge-fit-service

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Fits and applies a deterministic standardized ridge model to bounded numeric samples.

`fitDeterministicRidge({ samples, lambda })` takes rows of `{ features, target }`
and a positive penalty. It centers and scales each feature by its sample
deviation and leaves the intercept unpenalized. Pass the returned model and
an equally sized feature vector to `predictDeterministicRidge(model, features)`.

Run `npm test` to check the fitted coefficients, prediction, and refusals for
missing or overflowing input.
