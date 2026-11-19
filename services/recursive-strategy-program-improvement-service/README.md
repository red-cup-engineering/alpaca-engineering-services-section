# recursive-strategy-program-improvement-service

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Runs a bounded generate-assay-replay-tournament-review lineage loop that can promote only witnessed paper strategy programs.


## Original Work is the receiving boundary

This is an **upstream paper-strategy program loop**, not a general scientific research engine or a second Work ledger. A synthetic tournament score, static assay, replay and code review may select a *candidate*, but do not establish that the candidate has improved real work. The strategy-service constructor requires a trusted `readStandingOutcomes` provider backed by the original Organizing Work store. The input must identify the existing `originalWork` by its immutable `ni:///sha-256;...` address. The provider receives the selected candidate source, incumbent, acceptance suite and generation; it must read the source-authorized **current standing** using Organizing's `standingOutcomes` and must also independently check the corresponding original Work discharge, rights, source and producer/judge competence before returning it. The provider must not submit a synthetic outcome or a historical row previously voided.

The pure consumer accepts only one standing `organizing.enterprise.outcome` from `work-discharge`, bound by its original `evidence` to the original Work, the source-addressed selected program, the **prior incumbent**, and the **preselected acceptance suite**, with an accepted verdict, an actual `skill-result` rather than `skill-error`, a different judge from the author/provider, and both original receiving witness addresses. Competing judgments, wrong Work, absent evidence, a voided/rejected result, self-judgment, a failed skill and a missing or throwing original Work reader **cannot** advance the lineage. An outcome or lot may be consumed only once during a single bounded invocation; durable replay prevention across processes/restarts remains the upstream authorized Work owner's responsibility, **not** an in-memory Set or invented local log.

When no candidate has been received, `promotion` is `null`, `lineageHead` remains the incumbent, and every failure remains visible among the generation's residues. A received result permits only **paper program promotion**, not live trading/order effects, scientific truth, independently received improvements to the research method, publication or customer outcomes. `scientificImprovementEstablished` is deliberately `null` even after genuine original Work is received: Lenticule Science and Coesite separately qualify held-out comparative findings and operating receipt.

This makes the provider interface intentionally stricter than the original `0.1.2` experimental source. Do not publish or select a new package release until original consumer compatibility, the actual native Work adapter and source/version rights are independently received. The original [AOE research-engine Work #133](https://github.com/red-cup-engineering/agent-organization-engine/issues/133) and [Lenticule AI Science source inquiry #1](https://github.com/lenticule-science/artificial-intelligence-science-services-section/issues/1) remain the receiving owners; this library neither bypasses AOE Work nor creates another control plane.

Use `npm run verify` to execute the original no-dependency native Node syntax and test suite. The fixtures are **interface tests with simulated source-native Work rows**, not authenticated live Work or evidence that the organization has already improved its scientific yield. GitHub Actions invokes that same command on the original source. Do not count generated paper programs as independently validated research.
