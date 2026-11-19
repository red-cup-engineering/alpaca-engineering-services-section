# alpaca-engine

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Custody-bound Alpaca observation, mandate-limited actuation and recorded reconciliation through the shared venue providers.

The same engine runs a portfolio mandate for any authorized Alpaca principal.
The caller supplies a private mandate record reference. The engine loads the
current contract, authority grant, and evidence packet, and uses the venue bound
by those records. Principal, paper or live venue, and target weights come from
records supplied by the caller.

```sh
alpaca-engine --state-root /path/to/state --custody-root /path/to/custody --mandate mandate-reference
```

The packaged `content/deployment/systemd-user/alpaca-engine@.service` runs
this same CLI for one named mandate.

The mandate record under `mandates` carries `id`, `contractReference`,
`authorityGrantReference`, `evidencePacketReferences`, `targetWeights`,
`driftTolerance`, and `turnoverCapFraction`. It may also set
`minimumOrderNotional` or `suspended`. Each order needs an evidence packet for its ticker. The runtime records the cycle under
`portfolio-cycles`.

Account observations must return successful broker responses for the grant's
account UUID before they are recorded. OAuth exchange stores that UUID with
the selected paper or live environment in private custody.

The shared order-intent provider owns the exact broker order body and stable
client order ID. Execution and custody both use it: a funded market decision
produces its bounded limit order; a portfolio mandate produces its notional
market order. Custody rereads the current contract, grant, and intent before
using a credential. Retries look up the same client order ID before placing
anything, and uncertain effects retain a pending reconciliation result.

Applications use the engine's `observe`, `preflight`, and `execute` operations.
The former unreconciled transport functions and credential-based loop helpers
have been removed. They have no compatibility entry points.
