import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openProductionAlpacaBrokerage } from '../src/runtime.mjs';

async function seed(root, kind, record) {
  const directory = join(root, kind);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const name = createHash('sha256').update(record.id).digest('hex');
  await writeFile(join(directory, name + '.json'), JSON.stringify(record), { mode: 0o600 });
}

test('resolves each principal and venue from a referenced mandate and records the cycle', async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'alpaca-mandates-'));
  try {
    const seen = [];
    const credentials = new Map();
    const time = '2026-10-11T00:00:00Z';
    const runtime = openProductionAlpacaBrokerage({
      stateRoot,
      authorityCustody: {
        retrieve: async id => credentials.get(id),
        store: async () => assert.fail('A mandate cannot create a credential'),
        revoke: async () => assert.fail('A mandate cannot revoke a credential'),
      },
      clock: () => time,
      fetchImpl: async (url, { method }) => {
        const { hostname, pathname } = new URL(url);
        assert.equal(method, 'GET');
        seen.push({ hostname, pathname });
        return Response.json(pathname === '/v2/positions'
          ? [{ symbol: 'AAA', qty: '1', market_value: '100' }]
          : { id: new URL(url).hostname === 'api.alpaca.markets' ? 'account-live' : 'account-paper', equity: '100', last_equity: '100' });
      },
    });
    await assert.rejects(runtime.runMandatedPortfolio({ mandateReference: 'missing' }), { code: 'ENOENT' });
    assert.equal(seen.length, 0);

    for (const mode of ['paper', 'live']) {
      const id = `mandate-${mode}`;
      const venue = `alpaca-trading-${mode}`;
      const principal = `urn:principal:${mode}-fixture`;
      const accountReference = `account-${mode}`;
      const contract = {
        id: `contract-${mode}`, type: 'PrincipalBrokerageServiceContract', venue,
        principal, accountReference, capital: { amount: 100, currency: 'USD' },
        scopes: ['orders:intent'],
        risk: { maximumOrderNotional: 100, maximumAggregateNotional: 100, maximumLossAmount: 100, concentrationLimit: 1 },
      };
      const grant = {
        id: `grant-${mode}`, type: 'RevocableBrokerageAuthorityGrant', venue, adapter: venue,
        principal, accountReference, principalContract: contract.id, revoked: false,
        scopes: ['account:read', 'positions:read', `orders:${mode}`],
        credentialReference: `opaque-${mode}`, validUntil: '2026-10-12T00:00:00Z',
      };
      credentials.set(grant.credentialReference, {
        kind: mode === 'paper' ? 'alpaca-trading-api-key' : 'alpaca-trading-api-key-live',
        environment: mode, venue, principal, accountReference,
        credential: { apiKeyId: 'fixture', apiSecret: 'fixture' },
      });
      const evidence = { id: 'evidence-AAA', type: 'IssuerEvidencePacket', ticker: 'AAA' };
      await seed(stateRoot, 'contracts', contract);
      await seed(stateRoot, 'authority-grants', grant);
      await seed(stateRoot, 'evidence-packets', evidence);
      await seed(stateRoot, 'mandates', {
        id, contractReference: contract.id, authorityGrantReference: grant.id, evidencePacketReferences: [evidence.id],
        targetWeights: { AAA: 1 }, driftTolerance: 0.02, turnoverCapFraction: 0.1,
      });
      const result = await runtime.runMandatedPortfolio({ mandateReference: id });
      assert.equal(result.mode, mode);
      assert.equal(result.disposition, 'within-rebalance-policy');
      assert.deepEqual(result.executions, []);
      const record = await runtime.readRecord('portfolio-cycles', result.recordReceipt.id);
      assert.equal(record.mandate, id);
      assert.equal(record.cycle.mode, mode);
    }
    assert.deepEqual(seen.map(entry => entry.hostname).sort(), [
      'api.alpaca.markets', 'api.alpaca.markets', 'paper-api.alpaca.markets', 'paper-api.alpaca.markets',
    ]);
    assert.deepEqual(seen.map(entry => entry.pathname).sort(), [
      '/v2/account', '/v2/account', '/v2/positions', '/v2/positions',
    ]);
  } finally {
    await rm(stateRoot, { recursive: true, force: true });
  }
});
