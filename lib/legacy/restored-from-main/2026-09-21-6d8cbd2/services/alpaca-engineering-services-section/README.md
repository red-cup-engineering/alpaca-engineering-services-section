# Alpaca Engineering Services Section

financial-engineering-services-section's app engine for **Alpaca Assist**
(`@red-cup-engineering/alpaca-engineering-services-section`): the
composition root that runs one principal's bounded portfolio through
Alpaca over the venue algebra, and the Alpaca tool set the assistant
engine exposes to a user and to their own agent. It composes sibling
services by exact pin and owns no primitive of its own: mandate
allocation, order intent, execution transport, the pluggable venue
adapter, authority custody, and the independent witness come from
[venue-algebra-services-section](../../../../../../../../../../../../../../../../../financial-engineering-services-section/services/venue-algebra-services-section/README.md);
the kill switch, market-data reader, and BLK accumulation strategy from
this section's siblings; the assistant engine (session, sealing,
providers, analyst loop, SSE, MCP, tool registry) from
[personal-intelligence-systems-services-section](../../../../../../../../../../../../../personal-computer-systems-services-section/services/personal-intelligence-systems-services-section/README.md).

The program carrier is
[561 Group Investment Services Section](../../../../../../../../../../../../../../../../../../../561-group-services-section/services/561-group-operations-services-section/services/561-group-economic-operations-services-section/services/561-group-business-operations-services-section/services/561-group-finance-operations-services-section/services/561-group-investment-services-section/README.md);
the public seat is
[alpaca-assist-services-section](../../../../../../../../../../../../../../../../../../../public-services-section/services/public-computer-services-section/services/public-web-services-section/services/public-web-finance-services-section/services/alpaca-assist-services-section/README.md);
the theory is
[the personal quant platform](../../../../../../../../../../../../../../../../../../../science-services-section/services/social-science-services-section/services/economics-and-business-science-services-section/services/finance-science-services-section/services/investment-science-services-section/content/text/documents/articles/notes/2026/09/05/2026-09-05-note-on-the-personal-quant-platform.md).

## What is here

| Path | Provides |
|---|---|
| `src/alpaca-app.mjs` | `validateAlpacaAppConfiguration`, `createAlpacaApp` — the run loop: observe account and positions, check the kill switch and the envelope, ask the strategy, execute through the venue algebra, record the outcome |
| `src/strategy-engine.mjs` | the multi-strategy rule engine and target allocation |
| `src/blk-strategy.mjs` | the BLK accumulation strategy adapter |
| `src/alpaca-production-adapter.mjs` | the production Alpaca adapter over the pluggable venue adapter |
| `src/file-state.mjs` | file-backed app state (high-water mark, pause, revocation) |
| `src/operator.mjs` | operator verbs: pause, resume, revoke, cancel |
| `src/product.mjs` | `ALPACA_APP_PRODUCT`, the product definition with each capability's state and evidence |
| `scripts/<verb>-alpaca-*.mjs` | one effect per script: run, pause, resume, revoke authority, cancel order, show status, show capabilities |
| `apps/alpaca-app/cli.mjs` | the composed CLI face |

## What is specified and not yet built

[The Alpaca Assist capability specification](content/text/documents/articles/specifications/2026-09-05-alpaca-assist-specification.md)
names the web app, the Alpaca tool set for the assistant engine, the
belief record surface, the wallet login lane, and the priced measures,
with their build order and review gate.
