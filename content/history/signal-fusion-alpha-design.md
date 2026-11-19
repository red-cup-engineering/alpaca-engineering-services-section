# signal-fusion-alpha-engine-service

Founder thesis (2026-09-01): agents have tremendous access to public
news/feed data; a single signal is priced, but stacking many independent
weak PUBLIC signals manufactures a real edge no single actor priced. This
package builds that engine, composed entirely from already-published house
primitives, and MEASURES the resulting edge out-of-sample before any real
capital is committed.

## What this package is

- `src/signal.mjs` — the typed `Signal` an adapter emits (`source`,
  `sourceKind`, `entity`, `observedAt`, `direction`, `strength`,
  `independenceTag`).
- `src/independence-weighting.mjs` — shrinks correlated signals sharing an
  `independenceTag` by `1/sqrt(groupSize)` before fusion, so N correlated
  signals from one source family count like `sqrt(N)` independent votes,
  not N — the honest operationalization of "independent" in the thesis.
- `src/signal-to-belief-observations.mjs` — bridges `Signal[]` onto
  [trading-belief-service](../trading-belief-service/README.md)'s own
  `BeliefObservation` shape; translation only.
- `src/backtest-edge.mjs` — `measureFusedSignalEdge`: composes
  [`purged-walk-forward-fold-service`](../purged-walk-forward-fold-service)
  (chronological purge/split),
  `trading-belief-service`'s real `fuseBeliefWithEvidence` (metrologic
  bilattice `aggregate`/`isTop`), and
  [`transaction-cost-replay-service`](../transaction-cost-replay-service)
  (cost-aware metrics, including the `hitRate`/`expectancy` this build
  added to that package at 0.1.1) into one walk-forward backtest. Holdout
  folds are never used for tuning; the reported edge is always the
  untouched holdout.
- `src/kelly-sizing.mjs` / `src/risk-envelope.mjs` / `src/execution-intent.mjs`
  — bounded-stake aggression sizing and the autonomous execution
  architecture (see below).
- `scripts/adapt-koios-news-signal.mjs` — reads koios's own real, owned
  claim store (`sites/koios.news/store/<category>/*.json`, SEAVT-shaped
  `{subject, claims[]}`, 1,195 files) and emits signals for claims
  mentioning an entity, direction classified by a small, documented,
  swappable keyword lexicon.
- `scripts/adapt-market-momentum-signal.mjs` — a real, causal (no
  look-ahead) technical-momentum signal from CoinGecko's keyless public
  `market_chart` API (or an injected series/fixture).
- `scripts/adapt-onchain-funding-signal.mjs` — a real, keyless on-chain
  metric: perpetual-futures funding rate from CoinGecko's public
  derivatives endpoint, read contrarian.
- `scripts/fuse-signals-to-belief.mjs`, `scripts/backtest-fused-signal.mjs`,
  `scripts/size-position-from-edge.mjs` — thin CLI entrypoints over the
  `src/` modules.
- `apps/signal-fusion-alpha-engine-cli.mjs` — the composed end-to-end
  face: real adapters -> fusion -> backtest -> sizing -> a simulated
  execution intent.

## Legal fence

Every adapter draws only on PUBLIC information: koios's own published
news, and keyless public market/derivatives APIs. No MNPI, no
manipulative act. This pass recommends/simulates only — it fires no real
order.

## Sizing: bounded-stake aggression, not bankroll preservation

Corrected same night the growth-policy note was first drafted
([economics-science-services-section, 2026-09-01](../../../../../../../../../../../../../../../../../../../science-services-section/services/social-science-services-section/services/economics-and-business-science-services-section/services/economics-science-services-section/content/text/documents/articles/notes/2026/09/01/2026-09-01-note-on-agent-liquid-time-growth-policy.md)):
a fractional-Kelly/no-ruin haircut protects a bankroll you are trying to
preserve. The risk stake here is small, walled, and re-seedable — losing
it is not ruin. So `src/kelly-sizing.mjs` sizes HARD toward the measured
Kelly fraction (full Kelly, or beyond via `aggressionMultiplier`); the
ONLY clamp (`src/risk-envelope.mjs`'s `assertNoLiabilityBeyondStake`) is
structural: notional can never exceed the unlevered risk stake, because
exceeding it requires leverage that creates liability BEYOND the stake —
the one real ruin the note names. Survival/working capital is walled off
by omission: no function in this package can reference any capital pool
but `riskStakeAmount`.

## Execution architecture: arm once, then autonomous

Per the note's "automated means automated" ruling: the founder arms an
envelope ONCE (`armRiskEnvelope` — funds the stake wallet, grants signing,
sets bounds). Thereafter the only stop is `checkAutoHalt`, an AUTOMATIC
circuit breaker (drawdown hits the envelope floor), never a per-trade
permission prompt. `src/execution-intent.mjs` builds this shape now —
`requiresHumanApproval` is always `false` by construction — but every
intent this pass produces is `simulatedOnly: true, realCapitalAtRisk:
false`: no armed wallet exists yet. Arming one is the next lane, on
founder go.

## The measured edge (this pass, real data, honest number)

Ran `apps/signal-fusion-alpha-engine-cli.mjs` against real CoinGecko daily
BTC/USD price history (365 days, 2025-09 to 2026-09,
`test/fixtures/btc-365d-coingecko.json`) fused with real koios claims
mentioning bitcoin/crypto (18 matched, of 1,195 store files), against the
belief "BTC increases", purged walk-forward split (30-day warmup/training
window, 1-day horizon, 10bps transaction cost), holdout untouched:

```
HOLDOUT (167 periods, out-of-sample):  hitRate 0.467  expectancy -0.00084/period
                                        informationRatio -0.79  maxDrawdown 0.297
VALIDATION (167 periods):              hitRate 0.473  expectancy +0.00058/period
                                        informationRatio +0.42  maxDrawdown 0.283
```

**No measured edge.** Looking only at validation would have suggested a
small positive edge (informationRatio +0.42) — exactly the
overfitting/look-ahead trap this harness exists to catch. The untouched
holdout shows the opposite sign. Resulting Kelly fraction: `0` (the
formula clamps a non-positive edge to "no bet", never negative-sized).
`scripts/size-position-from-edge.mjs` correctly recommends zero notional
on this belief — the honest behavior of a kill-switch on a refuted edge,
not a bug. koios's real coverage for BTC-tagged claims was sparse (18
matches) and contributed negligibly next to the daily momentum signal;
a denser multi-signal test is future work as koios's own store grows and
more independent public sources are wired in. This is a genuine,
currently-nil measured result on the one strategy tested — not evidence
that signal-fusion alpha is impossible, only that this particular
momentum+news belief on BTC over this window is not one.

## Publish gate

Fresh install, `npm test` (`node --test test/*.test.mjs`, 38 tests
including the real-data integration test above), then `npm publish`
against the house registry. New package: fresh-install-and-green-tests
gate only, no prior tarball to diff.

## Thread

Five-custody thread (org-layering.md, 2026-09-01):
- science: [Agent + liquid + time — the growth policy](../../../../../../../../../../../../../../../../../../../science-services-section/services/social-science-services-section/services/economics-and-business-science-services-section/services/economics-science-services-section/content/text/documents/articles/notes/2026/09/01/2026-09-01-note-on-agent-liquid-time-growth-policy.md) (economics-science-services-section) — the bounded-stake-aggression sizing law and the "automated means automated" execution ruling this package implements verbatim; and [trading-belief-service](../trading-belief-service/README.md)'s own cited doxastic grounding for the falsifier this engine's beliefs must carry.
- engineering: [Metrologic](../../../../../../../../../../../../../../../../../../../science-services-section/services/information-science-services-section/services/math-services-section/services/obsmetrological-services-section/apps/metrologic/README.md) (bilattice fusion, consumed indirectly through trading-belief-service's already-proven `fuseBeliefWithEvidence`); `purged-walk-forward-fold-service`, `transaction-cost-replay-service@0.1.1` (this build's own additive hitRate/expectancy patch), and `trading-belief-service@0.1.0` — all composed, none re-authored.
- operations: none yet — pure computation + adapters, no standing scheduled process. The paper-trading loops (`alpaca-esther-paper-trading-loop`) are the future operations arm once an envelope is armed.
- 561-group: [Goal-stack roadmap, 2026-09-01 0300 cut](../../../../../../../../../../../../../../../../../../../561-group-services-section/services/561-group-operations-services-section/services/561-group-enterprise-services-section/services/561-group-enterprise-project-management-services-section/data/records/2026-09-01-0300-goal-stack-roadmap.json) — the `first-moneyday-earning-stack` and `internal-compute-market` threads this engine serves; the roadmap cut's "Alpaca retired" note is superseded by the same live founder order `trading-belief-service`'s README already records ("We can definitely enrich Alpaca," 2026-09-01).
- public: self (this section) — the trading-belief product ladder's backtest/sizing lot; a principal-facing belief ledger and an armed paper/live loop are the next lots.
