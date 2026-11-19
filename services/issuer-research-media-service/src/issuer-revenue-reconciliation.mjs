/*
 * issuer-revenue-period-reconciliation; selected module: src/issuer-revenue-reconciliation.mjs.
 * Source: issuer-research-media-service/specifications/issuer-revenue-kernel.work-order.md,
 * lines 1–55; sha256:9ca966e325cc885ef3b08993a9a1609a8a86fc3ff8f7f86cf607c7c2a0784e65.
 * Specification: ni:///sha-256;kIcXlfmaNu4HYEf4YKlKrIk6x6hjvdfqfE4uA0KJI5s.
 * Normative requirements v2, lines 3–14: input-envelope, date-domain, concept-domain,
 * duration-domain, selection, witnesses, conflict, revision, staleness, coverage, output, api.
 * Prohibitions v2, lines 16–18: no-effects, no-guesses, no-identity-duplication.
 * Each traces through projection jsnode-modules to kernel-receiving and these constraints:
 * - period-law (law; SEC; revision: companyfacts and primary observations;
 *   https://www.sec.gov/search-filings/edgar-application-programming-interfaces): applies
 *   to source fiscal-period interpretation. Actual start/end and filing context are separate;
 *   filing fiscal year does not identify every comparative fact's actual year.
 * - source-design (standard; Red Cup Engineering; revision 2026-10-24; ./requirements.md):
 *   applies to this bounded pure kernel, not full product acceptance. Requirements, behavior,
 *   architecture and design retain complete supplier/business boundaries. Science's
 *   2026-10-24 autonomous-agent-service-demand literature measurement carries the AAPL/MSFT
 *   primary observations and real paid stale-tag buyer study.
 * - node-esm (standard; Node.js; revision v24; https://nodejs.org/api/esm.html): applies
 *   to named module consumers; ordinary ESM, no dependencies or implicit ambient effects.
 * Derived claims bounded-product-contract and quarter/annual minimum/maximum-days
 * (lines 27–31) select bounded comparisons, not universal accounting periods: quarter
 * 70–110 inclusive days, annual 330–380. Excluded, missing and ambiguous evidence remains
 * explicit; implementation implies neither market demand nor income.
 * kernel-receiving (assay v2, lines 37–39) remains a distinct receiver's obligation:
 * exercise legacy/successor tags, historical fy, quarter/YTD/annual, equal/changed
 * rereports, same-date/crossconcept conflicts, stale/missing facts, cutoffs and invalid
 * input; inspect exact witnesses, absence of effects and absence of ranking.
 * operation-receiving (review v2, lines 37–39) remains separately required: actual SEC
 * quota/bytes/time/UA/refusals, original packet identity, native app build/mainline
 * integration, public paid acceptance and cost. No kernel preassay certifies these.
 * No network, clock, filesystem, process, credentials, inference, broker, payment,
 * environment access or retained writes. No fabricated facts, fiscal-context date
 * guesses, tag precedence, averaging, missing-quarter derivation or currency conversion.
 * No packet identity, canonical JSON, generic parser or formIssuerEvidencePacket
 * implementation. Procurement, market binding, commercial receiving and deployment
 * remain separate original Work obligations. Revision labels assert no audited restatement;
 * coverage describes only inspected USD concepts and cutoff, not exhaustive SEC filings.
 */

const CONCEPTS = Object.freeze(['Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerExcludingAssessedTax']);
const DAY = 86400000;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function calendarDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const milliseconds = Date.parse(value + 'T00:00:00.000Z');
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 10) !== value) return null;
  return milliseconds / DAY;
}

function validIdentity(value, requested) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 && value === Number(requested);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value) === BigInt(requested);
  return false;
}

function compareWitnesses(a, b) {
  return lexical(a.concept, b.concept) || lexical(a.filed, b.filed) ||
    lexical(a.accession, b.accession) || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0) ||
    lexical(a.start, b.start) || lexical(a.form, b.form);
}

function equalWitness(a, b) {
  return a.concept === b.concept && a.start === b.start && a.end === b.end &&
    a.durationDays === b.durationDays && Object.is(a.value, b.value) &&
    a.unit === b.unit && a.form === b.form && a.filed === b.filed && a.accession === b.accession;
}

/**
 * Reconcile received SEC USD revenue observations using actual calendar periods,
 * bounded durations, complete witnesses, per-concept latest filings and explicit
 * ambiguity, revision and staleness. Does not mutate input or perform external effects.
 * @param {unknown} input Envelope {cik, asOf, periodKind, maximumAgeDays, companyfacts}.
 * @returns {object} Exact IssuerRevenueReconciliation version 1 factual result.
 * @throws {TypeError} If the envelope or issuer identity is invalid.
 */
export function reconcileIssuerRevenueFacts(input) {
  if (!record(input)) throw new TypeError('Invalid input envelope');
  const { cik, asOf, periodKind, maximumAgeDays, companyfacts } = input;
  const asOfDay = calendarDay(asOf);
  if (typeof cik !== 'string' || !/^\d{10}$/.test(cik) || asOfDay === null ||
      (periodKind !== 'quarter' && periodKind !== 'annual') ||
      !Number.isInteger(maximumAgeDays) || maximumAgeDays <= 0 ||
      !record(companyfacts) || !validIdentity(companyfacts.cik, cik) ||
      typeof companyfacts.entityName !== 'string' || companyfacts.entityName.trim().length === 0 ||
      !record(companyfacts.facts)) throw new TypeError('Invalid input envelope or issuer identity');

  const eligible = [];
  const conceptCoverage = [];
  const taxonomy = companyfacts.facts['us-gaap'];
  for (const concept of CONCEPTS) {
    const entry = record(taxonomy) ? taxonomy[concept] : undefined;
    const observations = record(entry) && record(entry.units) && Array.isArray(entry.units.USD) ? entry.units.USD : [];
    const witnesses = [];
    for (const observation of observations) {
      if (!record(observation) || typeof observation.val !== 'number' || !Number.isFinite(observation.val) ||
          typeof observation.accn !== 'string' || observation.accn.trim().length === 0 ||
          !['10-Q', '10-Q/A', '10-K', '10-K/A'].includes(observation.form)) continue;
      const startDay = calendarDay(observation.start);
      const endDay = calendarDay(observation.end);
      const filedDay = calendarDay(observation.filed);
      if (startDay === null || endDay === null || filedDay === null ||
          startDay > endDay || endDay > asOfDay || filedDay > asOfDay) continue;
      const witness = { concept, start: observation.start, end: observation.end,
        durationDays: endDay - startDay + 1, value: observation.val, unit: 'USD',
        form: observation.form, filed: observation.filed, accession: observation.accn };
      if (!witnesses.some(existing => equalWitness(existing, witness))) witnesses.push(witness);
    }
    let latestEnd = null;
    for (const witness of witnesses) {
      if (latestEnd === null || witness.end > latestEnd) latestEnd = witness.end;
      eligible.push(witness);
    }
    conceptCoverage.push({ concept, latestEnd, count: witnesses.length });
  }

  const result = { type: 'IssuerRevenueReconciliation', version: 1, cik,
    issuer: companyfacts.entityName, asOf, periodKind, status: 'missing', unit: 'USD',
    period: null, value: null, witnesses: [], conceptCoverage, revision: 'none' };
  const [minimum, maximum] = periodKind === 'quarter' ? [70, 110] : [330, 380];
  const candidates = eligible.filter(w => w.durationDays >= minimum && w.durationDays <= maximum);
  if (candidates.length === 0) return result;
  let greatestEnd = candidates[0].end;
  for (const witness of candidates) if (witness.end > greatestEnd) greatestEnd = witness.end;
  const selected = candidates.filter(w => w.end === greatestEnd).sort(compareWitnesses);
  result.witnesses = selected;
  if (new Set(selected.map(w => w.start)).size > 1) {
    result.status = 'ambiguous';
    result.revision = 'ambiguous';
    return result;
  }
  const first = selected[0];
  result.period = { start: first.start, end: first.end, durationDays: first.durationDays };
  const latestByConcept = new Map();
  for (const witness of selected) {
    const previous = latestByConcept.get(witness.concept);
    if (previous === undefined || witness.filed > previous) latestByConcept.set(witness.concept, witness.filed);
  }
  const latest = selected.filter(w => w.filed === latestByConcept.get(w.concept));
  const values = new Set(latest.map(w => w.value));
  if (values.size > 1) {
    result.status = 'ambiguous';
    result.revision = 'ambiguous';
    return result;
  }
  result.value = latest[0].value;
  if (selected.some(w => w.filed < latestByConcept.get(w.concept) && w.value !== result.value)) {
    result.revision = 'changed-reported-value';
  } else if (new Set(selected.map(w => w.accession)).size > 1) {
    result.revision = 'equal-value-rereport';
  }
  result.status = asOfDay - calendarDay(greatestEnd) > maximumAgeDays ? 'stale' : 'current';
  return result;
}
