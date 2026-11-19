/**
 * @packageDocumentation
 *
 * The distal bypass over one issuer's SEC filings for one XBRL concept. Every filing is a record; the
 * periods it reports the concept for are its cells, and the values it reports are its local section.
 * Filings overlap wherever two of them report the same period. Metrologic's settling cohomology
 * decides, overlap by overlap, whether the sections agree; every overlap that fails its cocycle
 * condition is an obstruction. A later filing that reports a different value is a border: the issuer
 * revised its own account, and both values stay on the record. A filing that disagrees with itself, or
 * two filings made the same day that disagree, is damage, repaired at least cost. Every collapse of two
 * values into one is priced in bits, and every obstruction is emitted as a certificate.
 *
 * `issuerConceptCoherence` decides over a received SEC companyconcept document and touches nothing
 * else. `readIssuerConceptCoherence` reads that document from data.sec.gov and then decides.
 */
import { cech1, cocycle, localSection, patch } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/settling-cohomology-h1";
import { cochain } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/settling-associated-sheaf";

export const SHEET_KIND = "org.561-group.issuer.concept-obstruction-sheet.v1";
export const TAXONOMIES = Object.freeze(["us-gaap", "ifrs-full", "dei", "srt"]);
export const SEC_USER_AGENT = "561 Group group@561.group";

const CONCEPT = /^[A-Za-z][A-Za-z0-9]{1,199}$/;
const TICKER = /^[A-Za-z][A-Za-z0-9.-]{0,9}$/;
const lexical = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const cellOf = (unit, fact) => `${unit}|${fact.start ?? ""}..${fact.end}`;
const recordOf = (fact) => `${fact.form} ${fact.accn}`;
const inputError = (message) => Object.assign(new TypeError(message), { status: 400, code: "invalid-request" });

/** One certificate per value change of a cell, in filing order. */
function transitions(facts) {
  const ordered = [...facts].sort((a, b) => lexical(a.filed, b.filed) || lexical(a.accn, b.accn));
  const changes = [];
  for (let i = 1; i < ordered.length; i += 1) {
    if (String(ordered[i].val) !== String(ordered[i - 1].val)) changes.push([ordered[i - 1], ordered[i]]);
  }
  return changes;
}

/**
 * Metrologic decides the overlap: two one-cell sections over the shared cell, and whether they glue. When one filing
 * states the cell twice, each statement is its own patch.
 */
function obstructs(cell, left, right, code) {
  const names = left.accn === right.accn ? [`${recordOf(left)}#1`, `${recordOf(right)}#2`] : [recordOf(left), recordOf(right)];
  const sections = [left, right].map((fact, i) => localSection(names[i], cochain([{ cell, coefficient: code(cell, String(fact.val)) }])));
  const datum = cech1([cell], names.map((name) => patch(name, [cell])), sections);
  return !cocycle(datum);
}

function classify(left, right) {
  if (left.accn === right.accn) {
    return { kind: "damage", repair: "The filing reports two values for one period; the value the issuer reports for this period in its next filing settles it.", erasure: 1 };
  }
  if (left.filed === right.filed) {
    const amendment = [left, right].find((fact) => fact.form.endsWith("/A"));
    return {
      kind: "damage",
      repair: amendment ? `Two filings made the same day disagree; the amendment ${amendment.accn} settles it.` : "Two filings made the same day disagree; the later accession settles it.",
      erasure: 1,
    };
  }
  return { kind: "border", revision: right.form.endsWith("/A") ? "amendment" : "later report", repair: null, erasure: 0 };
}

const relativeChange = (left, right) => (Number(left.val) === 0 ? null : (Number(right.val) - Number(left.val)) / Math.abs(Number(left.val)));

async function contentAddress(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return `ni:///sha-256;${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

/**
 * The obstruction sheet of one SEC companyconcept document.
 * @param {{cik: number|string, taxonomy: string, tag: string, label?: string, entityName?: string, units: Record<string, Array<{start?: string, end: string, val: number, accn: string, form: string, filed: string, fy?: number, fp?: string}>>}} document
 * @param {{observedAt?: string, source?: string}} [context]
 */
export async function issuerConceptCoherence(document, { observedAt, source } = {}) {
  if (document === null || typeof document !== "object" || typeof document.units !== "object") throw inputError("a SEC companyconcept document is required");
  const codes = new Map();
  const code = (cell, value) => {
    if (!codes.has(cell)) codes.set(cell, new Map());
    const values = codes.get(cell);
    if (!values.has(value)) values.set(value, values.size + 1);
    return values.get(value);
  };
  const cells = new Map();
  const records = new Set();
  for (const [unit, facts] of Object.entries(document.units)) {
    for (const fact of facts) {
      records.add(recordOf(fact));
      const cell = cellOf(unit, fact);
      if (!cells.has(cell)) cells.set(cell, []);
      cells.get(cell).push(fact);
    }
  }
  const certificates = [];
  let sharedCells = 0;
  for (const [cell, facts] of [...cells].sort(([a], [b]) => lexical(a, b))) {
    if (new Set(facts.map((fact) => fact.accn)).size > 1) sharedCells += 1;
    for (const [left, right] of transitions(facts)) {
      if (!obstructs(cell, left, right, code)) continue;
      certificates.push({
        cell,
        left: { record: recordOf(left), accn: left.accn, form: left.form, filed: left.filed, value: left.val },
        right: { record: recordOf(right), accn: right.accn, form: right.form, filed: right.filed, value: right.val },
        change: Number(right.val) - Number(left.val),
        relativeChange: relativeChange(left, right),
        ...classify(left, right),
      });
    }
  }
  const damage = certificates.filter((certificate) => certificate.kind === "damage");
  const borders = certificates.filter((certificate) => certificate.kind === "border");
  const largest = [...borders]
    .filter((certificate) => certificate.relativeChange !== null)
    .sort((a, b) => Math.abs(b.relativeChange) - Math.abs(a.relativeChange) || lexical(a.cell, b.cell))
    .slice(0, 5)
    .map(({ cell, left, right, relativeChange: change }) => ({ cell, from: left.value, to: right.value, relativeChange: change, revisedBy: right.record }));
  const sheet = {
    kind: SHEET_KIND,
    issuer: { cik: String(document.cik).padStart(10, "0"), name: document.entityName ?? null },
    concept: { taxonomy: document.taxonomy, tag: document.tag, label: document.label ?? null, units: Object.keys(document.units) },
    observedAt: observedAt ?? null,
    source: source ?? null,
    records: records.size,
    cells: cells.size,
    sharedCells,
    obstructions: certificates.length,
    damage: damage.length,
    borders: borders.length,
    erasureCost: damage.reduce((sum, certificate) => sum + certificate.erasure, 0),
    erasureIfCollapsed: certificates.length,
    largestRevisions: largest,
    certificates,
  };
  return { ...sheet, id: await contentAddress(sheet) };
}

const tickers = new Map();

/** Resolve a ticker to its CIK from SEC's published ticker list, read once per isolate. */
async function cikOf(ticker, fetchImpl) {
  if (tickers.size === 0) {
    const response = await fetchImpl("https://www.sec.gov/files/company_tickers.json", { headers: { "user-agent": SEC_USER_AGENT, accept: "application/json" } });
    if (!response.ok) throw Object.assign(new Error(`SEC ticker list answered ${response.status}`), { status: 502, code: "sec-unavailable" });
    for (const entry of Object.values(await response.json())) tickers.set(String(entry.ticker).toUpperCase(), entry.cik_str);
  }
  const cik = tickers.get(ticker.toUpperCase());
  if (cik === undefined) throw Object.assign(new Error(`SEC lists no issuer with ticker ${ticker}`), { status: 404, code: "unknown-ticker" });
  return cik;
}

/**
 * Read one issuer's SEC companyconcept document and return its obstruction sheet.
 * @param {{ticker?: string, cik?: number|string, concept: string, taxonomy?: string, fetch?: typeof fetch}} request
 */
export async function readIssuerConceptCoherence({ ticker, cik, concept, taxonomy = "us-gaap", fetch: fetchImpl = globalThis.fetch } = {}) {
  if (typeof concept !== "string" || !CONCEPT.test(concept)) throw inputError("concept is an XBRL element name such as Revenues");
  if (!TAXONOMIES.includes(taxonomy)) throw inputError(`taxonomy is one of ${TAXONOMIES.join(", ")}`);
  let resolved = cik;
  if (resolved === undefined || resolved === null || resolved === "") {
    if (typeof ticker !== "string" || !TICKER.test(ticker)) throw inputError("ticker or cik is required");
    resolved = await cikOf(ticker, fetchImpl);
  } else if (!/^\d{1,10}$/.test(String(resolved))) {
    throw inputError("cik is up to ten digits");
  }
  const source = `https://data.sec.gov/api/xbrl/companyconcept/CIK${String(resolved).padStart(10, "0")}/${taxonomy}/${concept}.json`;
  const response = await fetchImpl(source, { headers: { "user-agent": SEC_USER_AGENT, accept: "application/json" } });
  if (response.status === 404) throw Object.assign(new Error(`The issuer reports no ${taxonomy}:${concept} in XBRL`), { status: 404, code: "concept-not-reported" });
  if (!response.ok) throw Object.assign(new Error(`SEC answered ${response.status}`), { status: 502, code: "sec-unavailable" });
  return issuerConceptCoherence(await response.json(), { observedAt: new Date().toISOString(), source });
}
