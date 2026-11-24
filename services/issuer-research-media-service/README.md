# issuer-research-media-service

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Source-backed issuer evidence and fiscal-period/revision reconciliation.

The `./issuer-concept-coherence` surface runs the distal bypass over one
issuer's SEC filings for one XBRL concept. Each filing is a record, each period
it reports is a cell, and Metrologic's settling cohomology decides where the
filings disagree. A later filing that reports a different value is a border: the
issuer revised its own account, and both values are kept. A filing that
disagrees with itself, or same-day filings that disagree, is damage with its
least-cost repair. Every obstruction is a certificate, and the sheet is
content-addressed.

- `issuerConceptCoherence(document)` decides over a received SEC
  companyconcept document;
- `readIssuerConceptCoherence({ ticker | cik, concept, taxonomy })` reads that
  document from data.sec.gov and decides.

The default export surface retains `formIssuerEvidencePacket`. The
`./revenue-reconciliation` surface provides the pure
`reconcileIssuerRevenueFacts` kernel. The `./prepared-cohort` surface provides:

- `planIssuerRevenueAcquisition(configuration)` and
  `validateIssuerRevenueComparisonRequest(body, configuration)`;
- `prepareIssuerRevenueCohort(configuration, adapters)` for bounded sequential
  official SEC acquisition and compact quarter/annual evidence;
- `selectPreparedIssuerRevenueComparison(input)` and
  `readPreparedIssuerRevenueComparison(body, env, configuration)` for unchanged
  current cache selection with source, period, revision and packet checks.

Configuration belongs to the operating instance. Public requests select only
an explicitly offered period kind. The operating owner supplies one global
coordinator and atomic cache storage; this supplier performs no storage writes.
The cache reader accepts the configured binding's bounded body stream.

The source-qualified [work order](specifications/prepared-cohort.work-order.md)
and [behavior](specifications/behavior.md) define the interfaces. The unchanged
generated edge module passed native preassay, 20 independent Node
HTTP/stream/cache cases and three actual workerd cases for preparation,
no-follow redirect refusal and cache-only fulfillment. The dated
[edge receipt](data/records/fabrication-run-records/2026-10-24-prepared-cohort/edge-refinement/receiving.json)
retains the exact source and runtime evidence. One earlier Node-qualified
two-issuer SEC run produced a 7,582-byte
cohort and a 3,726-byte annual comparison; see the dated
[primary-source receipt](data/records/primary-source-receiving-records/2026-10-24-prepared-cohort/receipt.json)
and [output example](data/records/primary-source-receiving-records/2026-10-24-prepared-cohort/annual.json).
The live SEC example is a Node supplier receipt. The later workerd fixture
uses bounded local sources; deployment resource admission and customer delivery
are received by their composing owners.

A separate [full-source workerd receipt](data/records/worker-runtime-test-records/2026-10-24-prepared-cohort-full-source/result.json)
received both retained SEC documents (8,677,207 bytes) through the same native
module in 2.06 seconds of runtime-test duration. It produced the same compact
sizes and retained the stale Microsoft quarter. This fixture performs no SEC
fetch and establishes no fresh source observation or production resource quota.
