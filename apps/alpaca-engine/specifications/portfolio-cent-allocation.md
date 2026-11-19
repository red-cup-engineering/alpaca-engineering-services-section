# Bounded whole-cent portfolio intents

The existing portfolio planner produces proposals from a supplied observation;
it does not place orders. Its fractional drift and statistical target weights
retain the existing Number calculations. The conversion of those proposals to
whole-cent notionals must not increase the declared gross turnover, aggregate
notional or per-order limits.

## Currency boundary

1. Compute the spendable cent budget by truncating the exact decimal product of
   the supplied equity and turnover-cap fraction to two decimal places, then
   taking the lower of that budget and the exact aggregate-limit cent budget
2. Keep each row bounded by the whole-cent floor of its existing proposed
   notional and the original declared per-order cap. Existing sell proposals
   remain bounded by the planner's observed holding value
3. When scaling is needed, apportion the cent budget in proportion to the
   existing proposed notionals using exact rational quotients and remainders
4. Allocate at most one remaining cent per row in descending remainder order,
   without exceeding its maximum. Equal remainders follow the existing
   sell-first, then symbol order. Target insertion order must not choose a tie
5. Filter notionals below the existing minimum order size after allocation.
   Do not redistribute amounts removed by that filter into larger orders
6. Preserve the current numeric notional output, refusing if its decimal
   representation cannot retain the allocated cent count

Use the existing `exact-number-data-service` decimal/rational provider. No new
money codec, execution route, policy bypass, authority or live automation is
introduced. A plan's turnover is the sum of buys and sells, not their net.
`requestedTurnover`, `turnoverLimit` and `turnoverScale` remain descriptive
Number fields; individual emitted notionals are whole-cent allocations.

## Regression and receiving

For a synthetic $100 account, two equal targets and a 1.01% turnover cap, the
previous independent rounding emitted $0.51 plus $0.51 against a $1.01 cap.
The repaired planner emits $0.51 plus $0.50, with deterministic ties. A $1.006
per-order cap cannot become a $1.01 order. Subcent limits, decimal strings near
cent boundaries, mixed buys/sells, minimum order filtering and quiet plans are
covered in `test/portfolio-cent-bounds.test.mjs`.

The existing `createMandatedPortfolioService` and optional system portfolio
interface consume this planner. Their authority, halt checks, fresh execution
admission and record custody are unchanged. Synthetic tests do not establish
production installation or authorize any account effect.
