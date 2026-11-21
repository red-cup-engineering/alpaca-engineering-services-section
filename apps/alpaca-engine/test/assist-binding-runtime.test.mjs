import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openProductionAlpacaBrokerage } from '../src/runtime.mjs';
import { alpacaAssistAccount } from '../src/assist-account.mjs';

test('host configuration switches one Person without granting authority or changing another Person', async t => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'alpaca-binding-'));
  t.after(() => rm(stateRoot, { recursive: true, force: true }));
  const brokerage = openProductionAlpacaBrokerage({ stateRoot, authorityCustody: {
    retrieve() { assert.fail('configuration must not read credentials'); },
    store() { assert.fail('configuration must not create credentials'); }, revoke() {},
  }, fetchImpl() { assert.fail('configuration must not contact a broker'); } });
  async function seed(kind, record) {
    await mkdir(join(stateRoot, kind), { recursive: true, mode: 0o700 });
    const id = createHash('sha256').update(record.id).digest('hex');
    await writeFile(join(stateRoot, kind, id + '.json'), JSON.stringify(record), { mode: 0o600 });
  }
  for (const mode of ['paper', 'live']) {
    await seed('contracts', { id: 'contract-' + mode, principal: mode });
    await seed('authority-grants', { id: 'grant-' + mode, principal: mode,
      venue: 'alpaca-trading-' + mode, validUntil: '2099-01-01', revoked: false });
  }
  const bind = (personSubject, mode) => brokerage.bindAssistPerson({ personSubject,
    contractReference: 'contract-' + mode, authorityGrantReference: 'grant-' + mode });
  const account = subject => alpacaAssistAccount({ brokerage, principal: { id: subject, subject,
    verifiedIdentity: { issuer: 'https://accounts.google.com', subject, emailVerified: true } } });
  assert.equal((await bind('first-person', 'paper')).authorityCreated, false);
  await bind('second-person', 'paper');
  await bind('first-person', 'live');
  assert.equal((await account('first-person').connection()).venue, 'alpaca-trading-live');
  assert.equal((await account('second-person').connection()).venue, 'alpaca-trading-paper');
  await assert.rejects(brokerage.bindAssistPerson({ personSubject: 'first-person',
    contractReference: 'contract-paper', authorityGrantReference: 'grant-live' }), /mismatch/);
  assert.equal((await account('first-person').connection()).venue, 'alpaca-trading-live');
});
