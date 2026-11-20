import { formIssuerEvidencePacket } from '@red-cup-engineering/issuer-research-media-service';
import { reconcileIssuerRevenueFacts } from '@red-cup-engineering/issuer-research-media-service/revenue-reconciliation';
import { addressContent } from '@red-cup-engineering/computer-content-address-engineering-services-section/content-address';
import { isNiUri } from '@red-cup-engineering/uri-engineering-services-section/ni-uri';

/*
 * Source: issuer-revenue-prepared-cohort, prepared-cohort.work-order.md:1-64,
 * sha256:e63921e5c658aa9e6ac95afdfd041383ac1b8219043ea382434d0bc8e3e594be.
 * Specification: ni:///sha-256;2moJycjlp3Q8p4fL52Ng6iAY4iNKDl1iGIbdCKBY2Qw.
 * Requirements v2 configuration/acquisition-plan/public-request/selector-input/
 * cohort-boundary/configured-cohort/financial-freshness/prepared-packets/
 * return-unchanged and prohibition no-request-override apply throughout.
 * Their common trace is projection jsnode-modules, pure-receiving, and all
 * constraints below. Additional effects also require io-receiving.
 *
 * Normative authority, revision, locator and applicability:
 * source-integrity: Data source custody; raw-carrier RFC6920;
 * https://www.rfc-editor.org/rfc/rfc6920; raw-byte addressing and packet citations.
 * source-demand: Red Cup Engineering; a48f45313af1e7525041d17ac3ff9a7ccdf24580;
 * ./behavior.md; independent issuer owner and prepared supplier. The actual
 * annual AAPL/MSFT operation arises from the received paid stale-tag study;
 * this reusable supplier makes no USD20/day forecast or earned-revenue claim.
 * sec-source: US SEC; current API and fair access docs;
 * https://www.sec.gov/search-filings/edgar-application-programming-interfaces;
 * fixed official acquisition, truthful operator identification and aggregate
 * fair access. Header structure alone establishes none of operator identity,
 * mailbox grammar or deliverability. Local spacing establishes no fleet quota.
 * native-fabrication: Red Cup Engineering; computer-systems-fabrication-engine
 * v0.4.14, jsnode-package v0.5.1-dev.1 source d1e4905;
 * https://github.com/red-cup-engineering/computer-systems-fabrication-engineering-services-section;
 * source-free fullmodule derivation and scoped preassay, without fixture mode.
 * async-contract-1 through async-contract-7: Issuer research Engineering;
 * prepared-cohort design; ./behavior.md; additional async interfaces and
 * independent I/O acceptance. Sources are sequential, fixed-origin, bounded,
 * single-GET, no-retry and no-follow. Raw bytes use the received NI supplier;
 * facts and packet IDs use the original received kernel and constructor.
 * Missing/stale/ambiguous producer results remain explicit. No partial result
 * or cache write occurs here. The ordinary controller owns atomic storage,
 * budget, retry scheduling and single EarningClock coordinator admission.
 * source-module-interfaces/source-supplier-closure/source-pure-effects/
 * source-no-substitutes: Issuer research Engineering; full module source
 * contract; ./design.md; mandatory generated source, outside JSON case assay.
 * Pure exports use explicit freshness inputs, no effects or mutation. No
 * replacement parser, identity, kernel, canonicalizer, broker or rate platform;
 * no credentials, procurement, ranking, prediction, investment instruction,
 * automatic quote conversion, raw facts in cache or reissued paid-path packet.
 * source-request-redirect: Cloudflare; Workers Request runtime API received
 * 2026-10-24, workerd 1.20261024.1;
 * https://developers.cloudflare.com/workers/runtime-apis/request/; actual
 * Workers GET construction uses manual redirects and explicit status 200.
 *
 * Receiving obligations v2, source lines 51-53 remain independent obligations:
 * pure-receiving: positive/negative plan and selector assays, unchanged ready
 * return, invalid config/request, future/expired/mismatched/missing/stale/
 * ambiguous/ancient evidence and packet citation/content counterexamples.
 * io-receiving: real Node AND workerd positive and redirect refusal tests,
 * fixed headers/URL/signal, exactly one GET on 3xx without a second issuer,
 * both successful GETs and spacing, timeout/byte/UTF8/JSON/midnight failures,
 * exact raw NI and native kernel/packet reuse, compact bound/private-byte
 * absence, exact R2 key/count/actual bytes, nonsettled unready cache, ordinary
 * controller atomic storage/budgets/global coordinator, edge/DO CPU/deployment
 * closure and independent outside-customer acceptance before promotion.
 * JSON preassay and this source do not discharge those effects or acceptance.
 */

const KINDS = ['quarter', 'annual'];
const DAY = 86400000;
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const positive = x => Number.isSafeInteger(x) && x > 0;
const urlFor = cik => 'https://data.sec.gov/api/xbrl/companyfacts/CIK' + cik + '.json';
function config(c) {
  const bad = () => { throw new TypeError('Invalid issuer revenue configuration'); };
  if (!record(c) || !Number.isInteger(c.maximumIssuers) || c.maximumIssuers < 2 || c.maximumIssuers > 5) bad();
  if (!Array.isArray(c.issuers) || c.issuers.length < 2 || c.issuers.length > c.maximumIssuers) bad();
  const seen = new Set();
  for (const i of c.issuers) {
    if (!record(i) || typeof i.cik !== 'string' || !/^\d{10}$/.test(i.cik) || !text(i.ticker) || seen.has(i.cik)) bad();
    seen.add(i.cik);
  }
  if (!text(c.userAgent) || /[\r\n]/.test(c.userAgent) || !c.userAgent.includes('@')) bad();
  for (const k of ['maximumBytes','timeoutMs','maximumSnapshotAgeMs','maximumCohortBytes']) if (!positive(c[k])) bad();
  if (!record(c.maximumAgeDays) || !KINDS.every(k => positive(c.maximumAgeDays[k]))) bad();
  if (!Number.isInteger(c.minimumIntervalMs) || c.minimumIntervalMs < 100 || !text(c.cacheKey)) bad();
  if (!Array.isArray(c.allowedPeriodKinds) || !c.allowedPeriodKinds.length || !c.allowedPeriodKinds.every(k => KINDS.includes(k)) || new Set(c.allowedPeriodKinds).size !== c.allowedPeriodKinds.length || typeof c.allowAmbiguousEvidence !== 'boolean') bad();
  return c;
}
function instant(v) {
  if (typeof v === 'number') return Number.isInteger(v) && Number.isFinite(v) && Number.isFinite(new Date(v).getTime()) ? v : NaN;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)) return NaN;
  const n = Date.parse(v);
  return Number.isFinite(n) && new Date(n).toISOString() === v ? n : NaN;
}
function day(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return NaN;
  const n = Date.parse(v + 'T00:00:00.000Z');
  return Number.isFinite(n) && new Date(n).toISOString().slice(0,10) === v ? n : NaN;
}
function canonical(v) { return typeof v === 'string' && Number.isFinite(instant(v)); }
function unavailable() { return Object.assign(new Error('Issuer revenue unavailable'), {code:'issuer-revenue-unavailable',status:503,retryable:true}); }
function refused(reason, retryable, retryAfter) {
  const e = Object.assign(new Error('Issuer revenue source unavailable: ' + reason), {code:'issuer-revenue-source-unavailable',status:503,retryable,reason});
  if (retryAfter !== undefined && retryAfter !== null) e.retryAfter = String(retryAfter);
  return e;
}
function need(condition) { if (!condition) throw unavailable(); }
function ni(v) { return text(v) && isNiUri(v); }
function statement(r) {
  return 'Received SEC companyfacts and reconciled ' + r.periodKind + ' USD revenue; status=' + r.status + '; period=' + (r.period ? r.period.start + '..' + r.period.end : 'none') + '; value=' + String(r.value) + '; revision=' + r.revision + '.';
}
function comparability(issuers) {
  if (!issuers.every(i => i.status === 'current')) return 'unresolved';
  const p = issuers[0].period;
  return issuers.every(i => i.period && p && i.period.start === p.start && i.period.end === p.end) ? 'aligned-periods' : 'different-periods';
}

/** Validate trusted supplier configuration and return the pure official-source plan.
 * @param {object} configuration Host-owned configuration.
 * @returns {object} IssuerRevenueAcquisitionPlan; no execution or quota grant.
 */
export function planIssuerRevenueAcquisition(configuration) {
  const c = config(configuration);
  return {type:'IssuerRevenueAcquisitionPlan',version:1,minimumIntervalMs:c.minimumIntervalMs,maximumCohortBytes:c.maximumCohortBytes,requests:c.issuers.map(i => ({cik:i.cik,ticker:i.ticker,url:urlFor(i.cik),headers:{'User-Agent':c.userAgent,Accept:'application/json'},timeoutMs:c.timeoutMs,maximumBytes:c.maximumBytes}))};
}

/** Admit only the configured public period selector, without effects.
 * @param {object} body Public request record containing only periodKind.
 * @param {object} configuration Trusted supplier configuration.
 * @returns {{periodKind:string}} Fresh validated request.
 */
export function validateIssuerRevenueComparisonRequest(body, configuration) {
  const c = config(configuration);
  if (!record(body) || Reflect.ownKeys(body).length !== 1 || !Object.hasOwn(body,'periodKind') || !c.allowedPeriodKinds.includes(body.periodKind)) throw new TypeError('Invalid issuer revenue comparison request');
  return {periodKind:body.periodKind};
}
function periodValid(p, kind, asOf, nowDay, maxAge) {
  if (!record(p)) return false;
  const start = day(p.start), end = day(p.end);
  const length = (end - start) / DAY + 1;
  const [lo,hi] = kind === 'quarter' ? [70,110] : [330,380];
  return Number.isFinite(start) && Number.isFinite(end) && start <= end && end <= day(asOf) && length === p.durationDays && length >= lo && length <= hi && (nowDay - end) / DAY <= maxAge;
}
function financial(r, kind, c, asOf, today) {
  need(r.status === 'current' || (c.allowAmbiguousEvidence && r.status === 'ambiguous'));
  need(Array.isArray(r.witnesses) && r.witnesses.length > 0);
  const latest = new Map();
  for (const w of r.witnesses) {
    need(record(w) && periodValid(w,kind,asOf,today,c.maximumAgeDays[kind]));
    need(Number.isFinite(w.value) && w.unit === 'USD' && ['10-Q','10-Q/A','10-K','10-K/A'].includes(w.form) && Number.isFinite(day(w.filed)) && w.filed <= asOf && text(w.accession) && text(w.concept));
    const old = latest.get(w.concept);
    if (!old || w.filed > old.filed) latest.set(w.concept,{filed:w.filed,values:[w.value]});
    else if (w.filed === old.filed) old.values.push(w.value);
  }
  const values = [...latest.values()].flatMap(x => x.values);
  if (r.period !== null) {
    need(periodValid(r.period,kind,asOf,today,c.maximumAgeDays[kind]));
    need(r.witnesses.every(w => w.start === r.period.start && w.end === r.period.end && w.durationDays === r.period.durationDays));
  }
  if (r.status === 'current') {
    need(r.period !== null && Number.isFinite(r.value) && text(r.revision) && r.revision !== 'ambiguous');
    need(values.every(v => v === r.value));
  } else {
    need(r.value === null && r.revision === 'ambiguous');
    if (r.period === null) {
      need(new Set(r.witnesses.map(w => w.end)).size === 1 && new Set(r.witnesses.map(w => w.start)).size > 1);
    } else need(new Set(values).size > 1);
  }
}

/** Validate a prepared cache boundary and return the identical selected result.
 * @param {object} input Explicit body, configuration, cohort and now.
 * @returns {object} Original ready IssuerRevenueComparison, or throws unavailable.
 */
export function selectPreparedIssuerRevenueComparison(input) {
  const {body,configuration,cohort,now} = input ?? {};
  const {periodKind} = validateIssuerRevenueComparisonRequest(body,configuration);
  const n = instant(now);
  if (!Number.isFinite(n)) throw new TypeError('Invalid explicit now');
  const c = configuration;
  try {
    need(record(cohort) && cohort.type === 'IssuerRevenuePreparedCohort' && cohort.version === 1 && canonical(cohort.observedAt));
    const observed = instant(cohort.observedAt);
    need(Number.isFinite(day(cohort.asOf)) && cohort.asOf === cohort.observedAt.slice(0,10) && observed <= n && n - observed <= c.maximumSnapshotAgeMs);
    need(record(cohort.results) && Object.hasOwn(cohort.results,'quarter') && Object.hasOwn(cohort.results,'annual'));
    const r = cohort.results[periodKind];
    need(record(r) && r.type === 'IssuerRevenueComparison' && r.version === 1 && r.observedAt === cohort.observedAt && r.asOf === cohort.asOf && r.periodKind === periodKind && r.datePolicy === 'filing-date-cutoff-on-received-sources');
    need(Array.isArray(r.issuers) && Array.isArray(r.evidencePackets) && r.issuers.length === c.issuers.length && r.evidencePackets.length === c.issuers.length);
    const today = day(new Date(n).toISOString().slice(0,10));
    for (let j=0;j<c.issuers.length;j++) {
      const i = r.issuers[j], expected = c.issuers[j], p = r.evidencePackets[j];
      need(record(i) && i.type === 'IssuerRevenueReconciliation' && i.version === 1 && i.cik === expected.cik && i.ticker === expected.ticker && i.asOf === r.asOf && i.periodKind === periodKind && text(i.issuer) && i.unit === 'USD');
      const s = i.source;
      need(record(s) && s.uri === urlFor(expected.cik) && ni(s.digest) && positive(s.bytes) && s.bytes <= c.maximumBytes && canonical(s.observedAt));
      const sn = instant(s.observedAt);
      need(sn <= observed && n-sn <= c.maximumSnapshotAgeMs);
      financial(i,periodKind,c,r.asOf,today);
      need(record(p) && p.type === 'IssuerEvidencePacket' && p.version === 1 && p.ticker === String(expected.ticker).toUpperCase() && p.issuer === i.issuer && p.asOf === r.asOf && ni(p.id) && p.brokerageEffect === false);
      need(Array.isArray(p.sources) && p.sources.length === 1 && record(p.sources[0]));
      need(p.sources[0].uri === s.uri && p.sources[0].digest === s.digest && p.sources[0].observedAt === s.observedAt);
      need(Array.isArray(p.claims) && p.claims.length === 1 && record(p.claims[0]));
      const claim = p.claims[0];
      need(Array.isArray(claim.sourceDigests) && claim.sourceDigests.length === 1 && claim.sourceDigests[0] === s.digest && claim.statement === statement(i));
    }
    need(r.comparability === comparability(r.issuers));
    return r;
  } catch { throw unavailable(); }
}

function abortable(promise, signal) {
  if (!signal) return Promise.resolve(promise);
  return new Promise((resolve,reject) => {
    const stop = () => reject(signal.reason ?? new Error('Acquisition timeout'));
    if (signal.aborted) { stop(); return; }
    signal.addEventListener('abort',stop,{once:true});
    Promise.resolve(promise).then(resolve,reject).finally(() => signal.removeEventListener('abort',stop));
  });
}
async function boundedBody(stream, limit, signal) {
  if (!stream || typeof stream.getReader !== 'function') throw new Error('invalid-stream');
  const reader = stream.getReader();
  const chunks = [];
  let total = 0, complete = false;
  try {
    for (;;) {
      const part = await abortable(reader.read(),signal);
      if (!record(part)) throw new Error('invalid-stream');
      if (part.done) { complete = true; break; }
      if (!(part.value instanceof Uint8Array)) throw new Error('invalid-stream');
      total += part.value.byteLength;
      if (total > limit) throw new Error('byte-overflow');
      chunks.push(part.value.slice());
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
    return bytes;
  } finally {
    if (!complete) { try { Promise.resolve(reader.cancel()).catch(() => {}); } catch {} }
    try { reader.releaseLock(); } catch {}
  }
}
function parseBytes(bytes) { return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
async function platformSleep(ms) {
  let remaining = ms;
  while (remaining > 0) {
    const chunk = Math.min(remaining,2147483647);
    await new Promise(resolve => setTimeout(resolve,chunk));
    remaining -= chunk;
  }
}
async function acquire(request, fetcher, clock, fixedDay) {
  let signal;
  try { signal = AbortSignal.timeout(request.timeoutMs); }
  catch { throw refused('timeout-configuration',false); }
  let response;
  try { response = await abortable(fetcher(request.url,{method:'GET',headers:request.headers,redirect:'manual',signal}),signal); }
  catch { throw refused('network-or-timeout',true); }
  const retryAfter = response?.headers?.get?.('Retry-After');
  if (response?.status !== 200) {
    try { Promise.resolve(response?.body?.cancel?.()).catch(() => {}); } catch {}
    const status = response?.status;
    throw refused('http-' + String(status),status === 429 || (status >= 500 && status <= 599),retryAfter);
  }
  let bytes;
  try {
    const length = response.headers?.get?.('Content-Length');
    if (length !== null && length !== undefined && /^\d+$/.test(length) && Number(length) > request.maximumBytes) {
      try { Promise.resolve(response.body?.cancel?.()).catch(() => {}); } catch {}
      throw new Error('byte-overflow');
    }
    bytes = await boundedBody(response.body,request.maximumBytes,signal);
  } catch (e) {
    throw refused(signal.aborted ? 'network-or-timeout' : (e?.message === 'byte-overflow' ? 'byte-overflow' : 'body-unavailable'),signal.aborted || e?.message !== 'byte-overflow' && e?.message !== 'invalid-stream',retryAfter);
  }
  const observed = instant(clock());
  if (!Number.isFinite(observed)) throw refused('invalid-clock',false);
  const observedAt = new Date(observed).toISOString();
  if (observedAt.slice(0,10) !== fixedDay) throw refused('utc-day-changed',true);
  try {
    const companyfacts = parseBytes(bytes);
    const address = await addressContent(bytes,{mediaType:'application/json'});
    if (!record(address) || address.kind !== 'semiotic-content.raw-carrier-address' || address.version !== 1 || address.algorithm !== 'sha-256' || address.size !== bytes.length || address.mediaType !== 'application/json' || !ni(address.ni) || !positive(address.size)) throw new Error('Invalid raw address');
    return {companyfacts,source:{uri:request.url,digest:address.ni,bytes:address.size,observedAt}};
  } catch { throw refused('invalid-source',false,retryAfter); }
}
async function compactIssuer(request, c, fetcher, clock, asOf) {
  const {companyfacts,source} = await acquire(request,fetcher,clock,asOf);
  const compact = {};
  for (const periodKind of KINDS) {
    let result;
    try { result = {...reconcileIssuerRevenueFacts({cik:request.cik,asOf,periodKind,maximumAgeDays:c.maximumAgeDays[periodKind],companyfacts}),ticker:request.ticker,source:{...source}}; }
    catch { throw refused('invalid-source-identity',false); }
    let packet;
    try {
      packet = await formIssuerEvidencePacket({ticker:request.ticker,issuer:result.issuer,asOf,sources:[{uri:source.uri,observedAt:source.observedAt,digest:source.digest}],claims:[{statement:statement(result),sourceDigests:[source.digest]}]});
    } catch { throw refused('packet-construction',false); }
    compact[periodKind] = {result,packet};
  }
  return compact;
}

/** Prepare a bounded complete cohort in a trusted background coordinator.
 * @param {object} configuration Host-owned supplier configuration.
 * @param {object} [adapters={}] Trusted fetch, now and sleep functions.
 * @returns {Promise<object>} Complete prepared cohort; never writes storage.
 */
export async function prepareIssuerRevenueCohort(configuration, adapters = {}) {
  const plan = planIssuerRevenueAcquisition(configuration);
  if (!record(adapters)) throw new TypeError('Invalid adapters');
  const clock = adapters.now === undefined ? Date.now : adapters.now;
  const fetcher = adapters.fetch === undefined ? globalThis.fetch : adapters.fetch;
  const sleep = adapters.sleep === undefined ? platformSleep : adapters.sleep;
  if (typeof clock !== 'function' || typeof fetcher !== 'function' || typeof sleep !== 'function') throw new TypeError('Invalid adapters');
  const start = instant(clock());
  if (!Number.isFinite(start)) throw new TypeError('Invalid preparation clock');
  const asOf = new Date(start).toISOString().slice(0,10);
  const parts = {quarter:{issuers:[],evidencePackets:[]},annual:{issuers:[],evidencePackets:[]}};
  for (let j=0;j<plan.requests.length;j++) {
    if (j) {
      try { await sleep(plan.minimumIntervalMs); } catch { throw refused('spacing-unavailable',true); }
    }
    const compact = await compactIssuer(plan.requests[j],configuration,fetcher,clock,asOf);
    for (const k of KINDS) { parts[k].issuers.push(compact[k].result); parts[k].evidencePackets.push(compact[k].packet); }
  }
  let completion;
  try { completion = instant(clock()); } catch { throw refused('invalid-clock',false); }
  if (!Number.isFinite(completion)) throw refused('invalid-clock',false);
  const observedAt = new Date(completion).toISOString();
  if (observedAt.slice(0,10) !== asOf) throw refused('utc-day-changed',true);
  if (completion < start || KINDS.some(k => parts[k].issuers.some(i => instant(i.source.observedAt) > completion))) throw refused('invalid-clock',false);
  const results = {};
  for (const k of KINDS) results[k] = {type:'IssuerRevenueComparison',version:1,observedAt,asOf,periodKind:k,datePolicy:'filing-date-cutoff-on-received-sources',comparability:comparability(parts[k].issuers),issuers:parts[k].issuers,evidencePackets:parts[k].evidencePackets};
  const cohort = {type:'IssuerRevenuePreparedCohort',version:1,observedAt,asOf,results};
  try {
    if (new TextEncoder().encode(JSON.stringify(cohort)).byteLength > configuration.maximumCohortBytes) throw new Error('overflow');
  } catch { throw refused('compact-output-overflow',false); }
  return cohort;
}

/** Read exactly one trusted R2 key and admit its prepared selected comparison.
 * @param {object} body Public period request.
 * @param {object} env Host-owned ISSUER_EVIDENCE binding.
 * @param {object} configuration Trusted supplier configuration.
 * @returns {Promise<object>} Unchanged ready comparison or retryable unavailable.
 */
export async function readPreparedIssuerRevenueComparison(body, env, configuration) {
  validateIssuerRevenueComparisonRequest(body,configuration);
  let cohort;
  try {
    const bucket = env?.ISSUER_EVIDENCE;
    if (!bucket || typeof bucket.get !== 'function') throw unavailable();
    const object = await bucket.get(configuration.cacheKey);
    if (!object || (object.size !== undefined && (!Number.isSafeInteger(object.size) || object.size < 0 || object.size > configuration.maximumCohortBytes))) {
      try { Promise.resolve(object?.body?.cancel?.()).catch(() => {}); } catch {}
      throw unavailable();
    }
    cohort = parseBytes(await boundedBody(object.body,configuration.maximumCohortBytes));
  } catch { throw unavailable(); }
  return selectPreparedIssuerRevenueComparison({body,configuration,cohort,now:Date.now()});
}
