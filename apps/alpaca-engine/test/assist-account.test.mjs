import test from 'node:test';
import assert from 'node:assert/strict';
import { alpacaAssistAccount } from '../src/assist-account.mjs';

const person = { id: 'person', subject: 'google-subject', verifiedIdentity: {
  issuer: 'https://accounts.google.com', subject: 'google-subject', emailVerified: true,
} };
function fixture() {
  const records = {
    'assist-bindings': { type: 'AlpacaAssistBinding', personIssuer: person.verifiedIdentity.issuer,
      personSubject: person.subject, principal: 'brokerage-principal', authorityGrantReference: 'grant', contractReference: 'contract' },
    'authority-grants': { principal: 'brokerage-principal', venue: 'alpaca-trading-paper', revoked: false, validUntil: '2099-01-01' },
    contracts: { principal: 'brokerage-principal' },
  };
  const calls = [];
  const brokerage = {
    async readRecord(kind, id) { if (!records[kind]) throw Object.assign(new Error('missing'), { code: 'ENOENT' }); return { id, ...records[kind] }; },
    async observe(input) { calls.push(['observe', input]); return { orderEffect: false }; },
    async preflight(input) { calls.push(['preflight', input]); return { mode: 'paper' }; },
    async execute(input) { calls.push(['execute', input]); return { pending: true }; },
  };
  return { records, calls, account: alpacaAssistAccount({ brokerage, principal: person }) };
}

test('a verified Person selects only the host-bound account and exact recorded intent', async () => {
  const { account, calls } = fixture();
  assert.equal((await account.connection()).configured, true);
  await account.observe();
  await account.readiness({ intentReference: 'intent' });
  await account.execute({ intentReference: 'intent' });
  assert.deepEqual(calls, [ ['observe', { authorityGrantReference: 'grant' }],
    ['preflight', { contractReference: 'contract', authorityGrantReference: 'grant', intentReference: 'intent' }],
    ['execute', { contractReference: 'contract', authorityGrantReference: 'grant', intentReference: 'intent' }] ]);
});

test('no binding is an explicit disconnected state and cannot query an account', async () => {
  const { account, records, calls } = fixture(); delete records['assist-bindings'];
  assert.equal((await account.connection()).configured, false);
  await assert.rejects(account.observe(), { code: 'ENOENT' }); assert.equal(calls.length, 0);
});

test('unverified, relabelled, and cross-person identities cannot select authority', async () => {
  for (const identity of [{ ...person.verifiedIdentity, emailVerified: false }, { ...person.verifiedIdentity, subject: 'other' }]) {
    assert.throws(() => alpacaAssistAccount({ principal: { ...person, verifiedIdentity: identity } }), /verified/);
  }
  const { account, records, calls } = fixture(); records['assist-bindings'].personSubject = 'other';
  await assert.rejects(account.execute({ intentReference: 'intent' }), /binding/); assert.equal(calls.length, 0);
});

test('authority and contract ownership are checked again for each operation', async () => {
  const { account, records, calls } = fixture();
  await account.readiness({ intentReference: 'intent' });
  records['authority-grants'].principal = 'another-account-owner';
  await assert.rejects(account.execute({ intentReference: 'intent' }), /authority-mismatch/);
  records['authority-grants'].principal = 'brokerage-principal'; records.contracts.principal = 'another-account-owner';
  await assert.rejects(account.execute({ intentReference: 'intent' }), /contract-mismatch/);
  assert.equal(calls.length, 1);
});
