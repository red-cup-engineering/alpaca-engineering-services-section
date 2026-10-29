---
title: "Alpaca Assist capability specification"
description: "What Alpaca Assist at alpaca-assist.561.group is and is not, the fences it holds, what the tree already holds for it, the architecture in six parts (the upstream assistant engine, the Alpaca tool set, the belief and reconciliation surfaces, the EVM wallet login and metered compute, the app Worker, the priced measures), the build order, and the review gate. Written 2026-09-05 before any app code, against the program carrier and the personal quant platform thesis."
date-created: 2026-09-05
type: specifications
name: 2026-09-05-alpaca-assist-specification
status: draft-for-owner-review
authors:
  - claude-fable-5.1
keywords:
  - alpaca-assist
  - assistant-engine
  - venue-algebra
  - sign-in-with-ethereum
  - x402
  - metered-compute
---

# Alpaca Assist capability specification

The key words MUST, MUST NOT, SHOULD, and MAY are to be interpreted as
described in BCP 14 (RFC 2119, RFC 8174). The program carrier is
[561 Group Investment Services Section](../../../../../../../../../../../../../../../../../../../../../../../../561-group-services-section/services/561-group-operations-services-section/services/561-group-economic-operations-services-section/services/561-group-business-operations-services-section/services/561-group-finance-operations-services-section/services/561-group-investment-services-section/README.md);
the theory is
[the personal quant platform](../../../../../../../../../../../../../../../../../../../../../../../../science-services-section/services/social-science-services-section/services/economics-and-business-science-services-section/services/finance-science-services-section/services/investment-science-services-section/content/text/documents/articles/notes/2026/09/05/2026-09-05-note-on-the-personal-quant-platform.md);
the sibling specification whose section (i) this one depends on is the
[Gig Assist specification](../../../../../../../../../../../../../../../../../../../../../../../../public-services-section/services/public-economic-services-section/services/public-worker-services-section/services/gig-assist-services-section/2026-09-05-gig-assist-specification.md).

## What Alpaca Assist is, and is not

Alpaca Assist is a decision-support assistant for one retail investor who
holds an Alpaca brokerage account. It reads the account, positions,
orders, and fills through the user's own revocable authority grant; keeps
the user's beliefs as first-class, falsifiable, dated records; shows every
position and fill beside the venue statement it reconciles against; runs
the house strategy tournament over the user's beliefs and the point-in-time
evidence; and, only inside a mandate envelope the user set and an
authority grant the user signed, forms order intents and carries them to
the venue through the venue algebra with an independent witness. A user's
own agent MAY use the app as a toolbelt over its remote MCP endpoint.

It is not a robo-advisor, not a signal seller, not an autotrader. It MUST
NOT hold a brokerage key it can use outside the user's grant, MUST NOT
place an order the user's envelope does not admit, MUST NOT present a
forecast as a fact or a projection as a return, MUST NOT sell or share a
user's positions, beliefs, or order flow, and MUST NOT gamify trading
(no streaks, no confetti, no "you're on fire").

## Fences

- **Provenance on every fact.** Every number the assistant states carries
  the observation it came from (venue, endpoint, timestamp, request id) or
  the record id of the belief or forecast it derives from. Retrieval and
  inference are separate steps in the analyst loop and are labeled.
- **The six records stay six.** Observation, belief, forecast, valuation,
  policy, and order intent are distinct typed, content-addressed records
  naming their inputs and model (the thesis). The app MUST NOT collapse
  them into a score.
- **Paper is a mode, not a gate.** The user chooses paper or bounded-live;
  bounded-live requires an independent arming reference the app refuses
  to accept from the contract itself (`validateAlpacaAppConfiguration`
  already enforces this). Neither mode is the default.
- **The envelope is the user's.** Per-order notional cap, gross exposure
  cap, daily-loss fraction (at most 3 percent), drawdown fraction (at
  most 10 percent), symbol allowlist, trading windows. The kill switch
  pauses the app on trip; resumption is the user's act.
- **Two witnesses per fill.** A fill is booked with the venue's own
  activity record and the app's intent; the reconciliation reading
  (agreed, mismatch, posted-only, asserted-only) is shown before any
  valuation.
- **The advice line is measured, not guessed.** The app publishes
  information and the user's own analysis over the user's own records; it
  does not recommend a security to a person. The investment science
  section's field note carries the regulatory reading; the app's copy is
  reviewed against it before each release.
- **Local-first where the data is personal.** Beliefs and settings are the
  user's; the server holds them sealed at rest under the user's session,
  exportable in full as JSON at any time, deletable in one action.

## What the tree already holds (measured 2026-09-05)

- `@red-cup-engineering/alpaca-engineering-services-section` 0.1.0: the
  run loop, strategy engine, production adapter, file state, operator
  verbs, and a CLI. Its product definition names the composed and
  uncomposed capabilities; this specification turns each "available
  sibling, not composed" into a tool or a surface.
- The venue algebra (seven published services over `venueFill`,
  `venueQuote`, `venueMandate`) and strategy evaluation (six services,
  including `trading-belief-service`, the falsifier-bearing belief
  record), both under `financial-engineering-services-section`.
- `alpaca-paper-account-read-service`, `alpaca-principal-account-read-service`,
  `alpaca-market-data-read-service`, `alpaca-news-read-service`,
  `daily-trading-context-service`, `point-in-time-asset-universe-service`,
  `alpaca-account-kill-switch-service`, `alpaca-alert-watch-service`.
- `metered-compute-payment-service` 0.1.5: `quoteMeteredCompute` and
  `settleMeteredCompute` (a single-use quote, a wallet grant with
  per-request and total budgets, a settlement receipt). Seated under the
  Alpaca section; it is a payment primitive and moves beside
  `x402-services-section`.
- The x402 boundary (`x402-services-section`, the official `@x402/*`
  implementation, `exact` scheme on Base USDC) and the pacing gateway as
  the live example of a priced measure.
- The EVM primitives in `computer-data-cryptography-services-section`
  (`hashPersonalMessage`, `signMessage`, `recoverAddress`,
  `toChecksumAddress`), the ERC-4337 enterprise account and the x402
  facilitator signer in `ethereum-services-section`, and the wallet
  registry in `key-management-services-section` (rows: chain, address,
  owner founder or org, role).
- The ops gateway's Hive login lane (`/login/hive`,
  `verify-hive-signed-message-service`, `{kind: "hive"}` principals,
  a nonce carrier, HMAC browser sessions).
- The EVE Assist engine, being moved into
  `personal-intelligence-systems-services-section` (Gig Assist
  specification section (i)).

## Architecture

### (i) The assistant engine, upstream

Alpaca Assist consumes the moved engine by exact pin: `./tools` (the
registry builder), `./chat` (the analyst loop with a caller-supplied
system instruction), `./chat/providers`, `./chat/sse`, `./mcp`,
`./web/session`, `./crypto`. It MUST NOT copy or fork any of these. The
tool-handler contract `handler(ctx, args) -> { data, observations }` is
preserved with a domain `ctx = { alpaca, store, userId, principal, grant,
fetchImpl, now }`.

### (ii) The Alpaca tool set

In this package, `src/tools/`, one tool per file, composed into a registry
in `src/tools/registry.mjs` by the engine's builder. Each tool returns
`data` and `observations`, where every observation is the venue response's
provenance (endpoint, status, timestamp, request id). Read tools:
`read_account`, `list_positions`, `list_orders`, `list_fills`,
`read_market_bars`, `read_news`, `read_daily_context`,
`read_point_in_time_universe`, `read_reconciliation` (positions and fills
against the venue statement, with the four-way reading), `read_risk`
(the kill-switch reading against the user's envelope). Belief tools:
`record_belief` (through `trading-belief-service`: proposition, entities,
direction, magnitude, horizon, confidence, falsifier, supporting and
contrary observations, dependencies), `revise_belief`, `list_beliefs`,
`check_falsifiers` (which beliefs' falsifiers have fired against current
observations). Analysis tools: `run_strategy_tournament` (over the user's
beliefs and the point-in-time universe, returning the holdout-verified
record), `propose_allocation` (mandate-bounded target weights, labeled a
proposal), `replay_costs`. Action tools, gated: `form_order_intent`
(requires an active grant and an envelope; returns the intent record, not
a placed order), `place_order_intent` (requires bounded-live or paper
arming, refuses outside the envelope, executes through the venue algebra's
transport with the independent witness), `cancel_order`, `pause_app`,
`revoke_authority`. Every action tool MUST re-check the envelope at call
time and MUST record the outcome through the semantic record journal.

### (iii) The belief and reconciliation surfaces

Two pages the GUI serves from the same tools: the belief ledger (each
belief with its horizon, confidence, falsifier, and the observations for
and against, revisions as a dated chain) and the books (positions and
fills with their venue witness and reconciliation reading, exportable as
Beancount through the house reader's shape). Neither page shows a
recommendation.

### (iv) The EVM wallet login and metered compute

- `verify-evm-signed-message-service`, a new operation package under
  `ethereum-services-section/services/`, fabricated through the jsnode
  line from a work order in that section's specifications directory,
  mirroring `verify-hive-signed-message-service`: parse an EIP-4361
  message (domain, address, statement, uri, version, chain-id, nonce,
  issued-at, expiration-time, not-before, request-id, resources), recover
  the signer from the EIP-191 `personal_sign` signature through the house
  `recoverAddress` and `hashPersonalMessage`, compare checksummed
  addresses, and check the nonce and time window. Externally owned
  accounts first; ERC-1271 contract signatures are a second verb that
  reads the contract through `public-evm-read`. Refusals are data
  (`SIGNATURE_MISMATCH`, `NONCE_UNKNOWN`, `EXPIRED`, `DOMAIN_MISMATCH`).
- On the ops gateway: `/login/evm` and `/login/evm/callback` beside the
  Hive lane, a nonce carrier, and `{kind: "evm", address}` principals in
  the browser session; the same lane serves alpaca-assist.561.group's
  Worker through the engine's session module.
- Compute metering: the principal's address is looked up in the wallet
  registry; a row with owner `founder` or `org` marks house compute, never
  quoted or settled. Every other account carries a wallet grant (asset,
  network, per-request and total budgets) the user sets once; each model
  turn and priced tool call produces a `MeteredComputeQuote` and, on
  payment through the x402 boundary, a `MeteredComputeSettlementReceipt`.
  The user sees their spend on the settings page as rows.

### (v) The app at alpaca-assist.561.group

A Cloudflare Worker in the public seat
(`public-web-finance-services-section/services/alpaca-assist-services-section`),
in EVE Assist's deploy shape: `src/index.mjs` re-exports the engine's
Worker handler configured with the Alpaca tool set, the EVM login lane,
and this app's D1 store (tables: users by address, sealed Alpaca grants,
settings, MCP tokens, beliefs, chat, compute quotes and receipts);
`public/` synced from this package's GUI at deploy; custom domain
`alpaca-assist.561.group`; `run_worker_first` for `/auth/*`, `/api/*`,
`/mcp`. Secrets: `SESSION_SECRET`, `SEAL_KEY`, Alpaca OAuth client id and
secret (Alpaca Connect registration is a founder's-hands item). No
application logic in the site directory.

### (vi) Priced measures on the x402 gateway

Pure functions already published, listed by the call on the house x402
gateway settling to the house Base USDC address, each returning a labeled
number and its inputs' ids: `propose_allocation` (mandate-bounded weights),
`replay_costs` (net return under an explicit cost model),
`read_risk` (drawdown and daily-loss reading for supplied equity series),
`check_falsifiers` (for supplied beliefs and observations). The business
plan prices them; the first listing is first cash.

## Build order

1. Engine upstream (Gig Assist specification section (i)); the EVE package
   repinned; both test suites green.
2. `verify-evm-signed-message-service` fabricated, tested against
   EIP-4361 test vectors, published; the gateway's `/login/evm` lane
   released; the founder signs in with their wallet on ops.561.group.
3. The Alpaca tool set in this package: read tools first, tests over
   recorded venue fixtures; then belief tools over `trading-belief-service`;
   then analysis; action tools last, behind the envelope.
4. The Worker in the public seat, deployed to alpaca-assist.561.group with
   the read tools and wallet login; `curl` returns 200 and `/api/me`
   returns the signed-in address.
5. Metered compute wired (registry exemption, quotes, receipts, the spend
   page); the first priced measure listed on the x402 gateway.
6. `metered-compute-payment-service` moved beside `x402-services-section`
   through the publish gate; consumers repinned.

## Review gate

A release passes when: `npm test` is green in this package, the engine
package, and the site; the import audit and duplication check are clean
over the changed packages; every tool's observations carry venue
provenance in the fixture tests; an action tool called outside the
envelope refuses with a datum in a test; the deployed Worker answers 200
at the custom domain; the founder can sign in with a registered wallet and
sees no compute quotes; a second wallet sees a quote on its first model
turn; and the app's public copy has been read against the field note's
regulatory section.
