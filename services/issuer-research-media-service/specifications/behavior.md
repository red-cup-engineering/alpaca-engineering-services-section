# Behavioral specification

Predecessor: [requirements](requirements.md), R1–R8. Source construction and
receiving are per unit: the kernel and prepared supplier have native and
independent Node receipts; the prepared supplier also has actual workerd
preparation, redirect-refusal and cache-reader receipts. Controller and public customer
delivery remain obligations of the complete operating composition.

## Pure fiscal-period kernel

The issuer-research-media-service export `./revenue-reconciliation` exposes
`reconcileIssuerRevenueFacts({cik,asOf,periodKind,maximumAgeDays,companyfacts})`.
The source-qualified `issuer-revenue-kernel.work-order.md` gives its complete
input/output/refusal and witness ordering contract. No effect, implicit clock,
packet identity, fy/fp date inference or missing-quarter arithmetic is permitted.

## Operation configuration and prepared source

Configuration is independently supplied Coesite/Group/Public data:
`issuers:[{cik,ticker}]`, `userAgent`, `maximumIssuers`, `maximumBytes`,
`timeoutMs`, `minimumIntervalMs`, `maximumAgeDays:{quarter,annual}`,
`cacheKey`, `maximumSnapshotAgeMs`, `maximumCohortBytes`,
`allowedPeriodKinds`, `allowAmbiguousEvidence`.
The first business instance selects Apple/Microsoft, annual sale, quarterly
research readiness, a quarter-hour refresh and no paid procurement. Thresholds
are explicitly experimental operating policy, not claimed SEC requirements.

`prepareIssuerRevenueCohort(configuration,adapters)` is a trusted background
supplier, never customer input. Adapters supply fetch, now and sleep; ordinary
platform defaults may be used. Receive exactly the configured bounded unique
CIKs. Fixed URLs are HTTPS data.sec.gov companyfacts derived from validated
CIKs; no customer source URL, redirect or arbitrary hostname is permitted.
Require a self-identifying configured User-Agent. Issue acquisitions sequentially
with configured spacing and timeout, count actual response bytes against the
maximum, and perform no automatic retry. Non-200, unavailable source, oversized
response, malformed JSON or CIK mismatch refuses before producing a new cohort;
rate/temporary failure retains retryability and Retry-After. One source failure
never yields a partially refreshed comparison.

Retry-After preservation applies to transport/rate/temporary source refusal.
It is retained literally without a supplier scheduling policy. A successful
HTTP200 response followed by a semantic CIK mismatch currently refuses with no
retryAfter field; the dated edge receiving diagnostic records that boundary.

The structural User-Agent predicate is trim-nonempty text, no CR/LF and a
literal @. It proves no mailbox grammar, deliverability or operator identity;
the actual operator independently receives that identity. Extra trusted host
control metadata is ignored by this supplier. The controller owns activation
and resource admission.

For each received source retain exact raw-octet content address, source URI and
observation instant. Derive quarter and annual kernel results using the actual
observed UTC day as asOf and their separately configured period-age bounds.
Compose literal evidence claims with the existing formIssuerEvidencePacket;
retain explicit selected period, units, concept coverage and every revision
witness, including ambiguity. No second identity or canonical JSON algorithm.

Return one compact object:
`{type:"IssuerRevenuePreparedCohort",version:1,observedAt,asOf,results:{quarter,annual}}`.
Each result is an `IssuerRevenueComparison` carrying version, observedAt,
asOf, periodKind, issuer reconciliations with original provenance, original
evidencePackets and explicit comparability. Aligned actual dates may be
`aligned-periods`; different actual dates are `different-periods`; unresolved
or missing evidence is `unresolved`. These labels rank no companies and make
no claim that equal duration kinds imply identical fiscal calendars.

The caller, the existing single EarningClock durable coordinator, persists the
compact cohort atomically only after complete bounded preparation. The supplier
performs no cache write. The Group instance selects its existing DurableObject
SQLite storage and supplies the market ISSUER_EVIDENCE body-stream adapter;
application receiving establishes that adapter. Single-cohort traffic admission
remains the coordinator's duty, never a claim established by local sleeping.

## Paid cache reader

Public input is exactly `{periodKind:"annual"}` in the first instance. The
reusable `validateIssuerRevenueComparisonRequest(body,configuration)` accepts
only an object with a single periodKind allowed by the instance's explicit
allowedPeriodKinds; it performs no effects. Unknown fields, arbitrary issuer,
source URI, cache key, bucket, dates or unsupported period kind refuse.

`readPreparedIssuerRevenueComparison(body,env,configuration)` validates first,
reads only env.ISSUER_EVIDENCE.get(configuration.cacheKey), bounds actual cached
bytes and parses one compact cohort. It performs no SEC request, raw companyfacts
parse, inference or paid purchase. A pure
`selectPreparedIssuerRevenueComparison({body,configuration,cohort,now})`
performs the same object/version/cohort/date/freshness and result readiness
checks over explicitly provided values for native independent counterexamples.

Missing/malformed, future-dated or expired snapshot refuses as unavailable.
Reject missing/stale selected issuer results and mismatched configured cohort,
source citations or dates. A complete ambiguous result may be returned only
when allowAmbiguousEvidence is explicitly true and its current-period witnesses
satisfy the same financial-period-age bound; ambiguity precedence in the kernel
must not make ancient conflicting evidence saleable. Snapshot age and financial
period age are separate. Return the selected prepared comparison unchanged;
no original source or packet identity can be silently recertified at read time.

Current value metadata must agree with every latest-filed witness within each
concept. Conflicting latest values cannot be labeled current. Earlier witnesses
may differ after a legitimate changed-value rereport and must remain retained.
A same-period ambiguous report needs conflicting latest values; a null-period
ambiguous report needs multiple starts sharing its selected end. The single
packet claim must exactly match the producer's declared literal status, period,
value and revision statement and cite that issuer's source. These are compact
consistency checks, without raw-facts recomputation or identity recertification.

Unavailability is an Error with code issuer-revenue-unavailable and status503;
malformed caller/configuration uses TypeError before egress. Source acquisition
refusals include stable code and retryable metadata. The market/controller must
map these to a nonsettled unavailable response. Pure-kernel/prepared-object tests
do not certify that settlement lifecycle; native integration and actual public
receiving must independently establish it before commercial promotion.
