# Detailed design and construction order

Predecessors: [requirements](requirements.md), [behavior](behavior.md),
[architecture](architecture.md). These documents are engineering candidates
for independent qualification; headings alone establish no admission.

Separate a pure companyfacts-to-reconciliation function from background
acquisition and foreground cache reading. The pure function receives explicit
complete received SEC objects and dates. Acquisition is only through the
existing single durable coordinator, with its fixed configured cohort. It uses
CIK-derived URIs, redirect:error, AbortSignal timeout, configured User-Agent,
sequential spacing and bounded body reads. Do not trust Content-Length alone.
Check cik consistency against requested CIK. Two complete acquisitions precede
any cache write; one failure preserves the previous complete cohort.

Date parsing first checks exact YYYY-MM-DD and roundtrips to avoid JavaScript
calendar rollover. Duration uses UTC day difference plus one. Grouping keys
contain exact start/end; no fiscal-year or array-index sorting. Deterministic
witness order is concept, filed, accession, numeric value, start and form, all lexical except numeric value. The final form tie-break retains otherwise equal amended/original observations deterministically.
Deduplicate exact equal observations but retain distinct filing/accession
witnesses. Reconciliation preserves finite source numbers; no currency
conversion, decimal rounding, ratio, Q4 arithmetic or unit substitution.

For each concept, retain latest end and count of inspected eligible facts.
For requested-duration candidates select latest end, refuse a unique chosen
period when multiple starts share that end, and preserve exact-period
witnesses. Latest per-concept filed values determine conflict; differing
concept values expose ambiguity. Historical equal/changed reporting labels
are attributable observations, not restatement judgments.

Digest the actual received bytes through an existing Data content-address
supplier; identify its exact raw-octet digest scheme. Source URI and observedAt
are separately retained. Call original formIssuerEvidencePacket
with truthful literal reconciled claims citing exactly that source digest,
asOf equal to request end-of-day, and issuer name from the received source.
The result does not claim a latest filing outside the received companyfacts
coverage.

The pure reconciliation function is separately fabricated first, with one
explicit envelope input and native JSON counterexamples. Public request shape
is only periodKind. The received prepared-cohort unit provides a pure request
validator, trusted background producer and foreground cache reader.
Their cache object is IssuerRevenuePreparedCohort, version one, with observedAt,
asOf and results.quarter/results.annual. Each result is a fully composed
IssuerRevenueComparison retaining both issuer results, source provenance and
original evidence packets. Foreground checks the configured cache key and
binding, cohort/version, date coverage and independent snapshot freshness;
it never requests SEC or recomputes multi-megabyte facts. Field and adapter
contracts are retained in that unit's source-bound admission and receiving receipts.
JSON operation configuration never grants executable adapters or source URLs.
Compact cache receiving also checks latest-per-concept witness values against
the reported current value, while permitting earlier changed-value witnesses.
It preserves genuine conflicts as ambiguity and checks the exact producer
packet statement against structured metadata without rehashing the packet.
The retained first full-module proposal failed independent source review on
these invariants and remains REFUSED under its original source/specification
identities; its bytes must not be hand-edited or activated. The corrected requirements were natively admitted and a whole-unit source
delivery received unchanged through ten native and nineteen independent I/O
checks. The earlier refused bytes remain inactive. Retained-delivery replay
purchases no new inference. The exact source and primary-source Node receipts
are retained under the original owning section's typed data.
The existing issuer package owns new exports and the unchanged live packet;
Alpaca delegates its legacy public face through that independent package.
Package exports and packet relocation are deterministic manifest/source
normalization products alongside source-free semantic derivation. Current
actual source-owner reconciliation and old identity-import refusal are retained
in data/records/fabrication-run-records/2026-10-24-issuer-revenue-kernel/source-owner-reconciliation.json.

Construction must use the actual competent Code jsnode-modules fabrication
entrance and its Data source-bound qualification, with requirements,
behavior, architecture and design identities retained. The current renamed
source owner is red-cup-engineering/computer-systems-fabrication-engineering-services-section;
the old computer-code-development-engine GitHub address redirects there.
No handwritten source or supplied-source materialization certifies semantic
derivation. Source, tests and fixtures need the original native plan and
independent receiver, with one writer for this supplier family.

V-model traceability:

| Demand | Design | Planned native receiving |
| --- | --- | --- |
| R1 | bounded explicit CIK validator | 2/5 issuers; duplicate/1/6 refused |
| R2 | bounded fixed-origin acquisition | UA, redirect, 429, bytes, timeout; no retries |
| R3 | multi-concept latest-end coverage | stale Revenues plus newer successor |
| R4 | exact inclusive start/end duration | quarter vs9M, historical fy2026, annual |
| R5 | source witness sets and conflict | changed/equal rerereport, same-date conflict |
| R6 | original packet constructor | unchanged identity/citation regressions |
| R7 | explicit status/date policy | missing, stale, asOf, ambiguity, no ranking |
| R8 | actual package export and market | native imports/build and public receiving |

Assays must be authored before semantic source generation; hidden independent
cases remain separate from source-provider examples. A local candidate,
source test, integrated main, registry artifact, deployment and paid customer
acceptance are separate observations and must retain those qualifications.
