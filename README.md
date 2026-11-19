# Alpaca Engineering

Alpaca execution and research live in this repository. The executable is
[apps/alpaca-engine](apps/alpaca-engine/README.md). Provider libraries are
ordinary directories under `services/`; there are no nested source repositories.

| Location | Responsibility |
| --- | --- |
| `apps/alpaca-engine/` | Account observation, portfolio mandates, custody-bound order execution, MCP, CLI, and the systemd unit |
| `apps/alpaca-assist/` | Authenticated ASSIST application over that same engine, with per-person brokerage bindings |
| `src/` | Brokerage service composition and metered research products |
| `scripts/` | Market data, feature formation, simulation, research assays, and settlement |
| `services/` | Research measurement, synthesis, evidence, and contract providers |
| `test/` | Tests of the shared research entry points |
| `content/` | Specifications and research provenance |

The source workspace requires Node 24 or later. Install its declared workspace
and registry dependencies through the checkout's `make pnpm` entry on the
selected build host. From this directory, `pnpm test` runs the JavaScript tests;
`pnpm --filter @red-cup-engineering/alpaca-engine test` runs the account and
execution suite. `pnpm run check` checks JavaScript syntax.

The root package exposes the metered research providers. Workspace dependencies
select their source directories directly. Published packages use the same
source and package exports. Changes to a provider, its consumer, and its tests
belong in one ordinary commit here.

Alpaca ASSIST is a downstream application of the shared ASSIST/TUFTE engine.
Its public record lives in `red-cup-engineering/assist`; its product owner is
`causeway-services/public-financial-services-section`. Account connections and
trading controls resolve the signed-in Person's current brokerage binding through
`apps/alpaca-assist`. The host configures admission and binds each Person to an
existing contract and revocable grant with `alpaca-engine --bind-person`.
The public catalogue supplies no account or order authority.

Actual orders pass through `alpaca-engine` and the shared brokerage custody,
execution, and venue providers. Current private contract, grant, and intent
records select the account and paper or live venue. Credentials in a process
environment do not select an execution mode. Stable client order IDs preserve
retry identity; uncertain effects remain pending until reconciled.

The former paper guards, kill-switch package, credential-based transports, and
duplicate account readers are removed. Market-data, feature-frame, learning,
payment, and settlement implementations each have one maintained source in
`scripts/`. Generic market allocation and brokerage infrastructure remain in
their shared upstream repositories.

Git uses `main` and ordinary commits. This consolidation starts a new compact
history; previous per-provider repositories and their source Gitlinks are
retired after source verification. Tags, agent branches, generated state,
package caches, and old Git object databases do not belong in this repository.
