import {
  prepareIssuerRevenueCohort,
  selectPreparedIssuerRevenueComparison,
  readPreparedIssuerRevenueComparison,
} from "/home/emsenn/info/lib/emsenn/services/561-group/services/engineering-services-section/services/computer-engineering-services-section/services/computer-systems-engineering-services-section/services/computer-web-engineering-services-section/services/web-platform-services-section/services/web2-platform-services-section/services/web2-financial-platform-services-section/services/web2-financial-brokerage-platform-services-section/services/alpaca-engineering-services-section/services/issuer-research-media-service/data/logs/fabrication-logs/2026-10-24-prepared-cohort/edge-refinement/retained-proposal.source.mjs";

function expect(value, message) { if (!value) throw new Error(message); }
function configuration() {
  return {
    issuers: [{ cik: '0000000001', ticker: 'ONE' }, { cik: '0000000002', ticker: 'TWO' }],
    userAgent: 'Independent runtime receiving test@example.invalid', maximumIssuers: 5,
    maximumBytes: 8388608, timeoutMs: 1000, minimumIntervalMs: 1000,
    maximumAgeDays: { quarter: 150, annual: 550 }, cacheKey: 'issuer-research/current.json',
    maximumSnapshotAgeMs: 3600000, maximumCohortBytes: 524288,
    allowedPeriodKinds: ['annual'], allowAmbiguousEvidence: true,
  };
}
function fixtureBody(cik, now) {
  const year = new Date(now).getUTCFullYear();
  return JSON.stringify({ cik: Number(cik), entityName: 'Runtime fixture ' + cik,
    facts: { 'us-gaap': { Revenues: { units: { USD: [{
      start: String(year - 1) + '-01-01', end: String(year - 1) + '-12-31',
      val: Number(cik) * 100, form: '10-K', filed: String(year) + '-01-01', accn: 'runtime-fixture-' + cik,
    }] } } } },
  });
}
async function prepare() {
  const config = configuration(), now = Date.now(), calls = [], sleeps = [];
  const cohort = await prepareIssuerRevenueCohort(config, {
    now: () => now,
    sleep: async ms => { sleeps.push(ms); },
    fetch: async (url, init) => {
      // Construct a REAL workerd Request; a mock accepting unsupported init is insufficient.
      const request = new Request(url, init);
      expect(request.redirect === 'manual', 'Actual Request must preserve manual no-follow');
      expect(request.method === 'GET', 'Only one GET is admitted per configured source');
      expect(request.headers.get('User-Agent') === config.userAgent, 'Configured source identity lost');
      expect(request.headers.get('Accept') === 'application/json', 'JSON source Accept lost');
      const issuer = config.issuers[calls.length];
      expect(request.url === 'https://data.sec.gov/api/xbrl/companyfacts/CIK' + issuer.cik + '.json', 'Source origin/CIK changed');
      calls.push(request.url);
      return new Response(fixtureBody(issuer.cik, now));
    },
  });
  expect(calls.length === 2 && sleeps.length === 1 && sleeps[0] === 1000, 'Bounded sequential acquisition differs');
  return { config, cohort, now };
}
export const manualSourcePreparation = { async test() {
  const { config, cohort, now } = await prepare();
  const selected = selectPreparedIssuerRevenueComparison({ body: { periodKind: 'annual' }, configuration: config, cohort, now });
  expect(selected === cohort.results.annual, 'Selector changed prepared report');
  expect(selected.issuers[0].value === 100 && selected.issuers[1].value === 200, 'Runtime revenue values differ');
  expect(selected.evidencePackets.length === 2 && selected.issuers.every(issuer => issuer.status === 'current'), 'Complete current source report missing');
} };
export const manualRedirectRefusal = { async test() {
  const config = configuration(); let count = 0, refusal;
  try {
    await prepareIssuerRevenueCohort(config, {
      now: Date.now, sleep: async () => {},
      fetch: async (url, init) => {
        const request = new Request(url, init);
        expect(request.redirect === 'manual', 'Redirect mode is not implemented no-follow');
        count++;
        return new Response('', { status: 302, headers: { Location: 'https://unqualified.example.invalid/redirect-target' } });
      },
    });
  } catch (error) { refusal = error; }
  expect(count === 1, 'Redirect or next source was fetched');
  expect(refusal?.code === 'issuer-revenue-source-unavailable' && refusal.status === 503 && refusal.retryable === false && refusal.reason === 'http-302', 'Redirect source refusal differs');
} };
export const cacheOnlyReader = { async test() {
  const { config, cohort } = await prepare(); let gets = 0;
  const selected = await readPreparedIssuerRevenueComparison({ periodKind: 'annual' }, {
    ISSUER_EVIDENCE: { get: async key => {
      expect(key === config.cacheKey, 'Unconfigured cache key'); gets++;
      const bytes = new TextEncoder().encode(JSON.stringify(cohort));
      return { body: new Response(bytes).body, size: bytes.byteLength };
    } },
  }, config);
  expect(gets === 1 && selected.issuers[0].value === 100 && selected.issuers[1].value === 200, 'Cache-only runtime fulfillment differs');
} };

export const retryAfterIdentityObservation={async test(){let refusal;try{await prepareIssuerRevenueCohort(configuration(),{now:Date.now,sleep:async()=>{},fetch:async(url,init)=>{new Request(url,init);return new Response(fixtureBody('0000000099',Date.now()),{headers:{'Retry-After':'9999999'}});}});}catch(error){refusal=error;}expect(refusal?.reason==='invalid-source-identity','Expected source identity refusal');console.log('RETRY_AFTER_IDENTITY_OBSERVATION '+JSON.stringify({code:refusal.code,status:refusal.status,reason:refusal.reason,retryable:refusal.retryable,retryAfter:refusal.retryAfter??null}));}};
