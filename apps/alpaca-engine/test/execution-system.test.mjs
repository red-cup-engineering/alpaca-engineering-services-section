import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPosition } from '@red-cup-engineering/gaming/running/rules';
import { createPrincipalAlpacaBrokerageSystem } from '../src/system.mjs';

const now = '2096-01-01T00:00:00Z';

function fixture(mode, { revokeAfterCapacity = false, accountStatus = 200, accountId = 'account' } = {}) {
  const venue = `alpaca-trading-${mode}`;
  const scopes = ['account:read', 'positions:read', 'orders:read', `orders:${mode}`, 'activities:read'];
  const contract = { id: 'contract', type: 'PrincipalBrokerageServiceContract', principal: 'principal', accountReference: 'account', venue,
    scopes, validUntil: '2097-01-01', capital: { amount: 100, currency: 'USD' },
    risk: { maximumOrderNotional: 60, maximumLossAmount: 60, maximumAggregateNotional: 75, concentrationLimit: 1 } };
  const authorityGrant = { id: 'grant', type: 'RevocableBrokerageAuthorityGrant', principal: contract.principal, accountReference: 'account',
    principalContract: contract.id, venue, adapter: venue, scopes, revoked: false, credentialReference: 'credential', validUntil: contract.validUntil };
  // Synthetic funding exercises transport and custody; it is not investment evidence.
  const body = { type: 'MarketGameDecision', effect: 'intent-only', principal: contract.principal, at: now, horizon: '2096-01-02T00:00:00Z',
    orders: [{ id: 'allocation', venue: 'alpaca', instrument: 'SPY', side: 'long', carrier: 'asset', assetClass: 'us_equity',
      capitalCents: 1000, units: 1, entryPrice: 10, unitStep: 0.1 }] };
  const marketDecision = { id: hashPosition(body), ...body };
  const intent = { id: 'intent', type: 'AggressiveBrokerageOrderIntent', contract: contract.id, symbol: 'SPY', side: 'buy',
    notional: 10, maximumLoss: 10, marketDecision };
  const current = { contract, authorityGrant, intent };
  const requests = [], records = [], orders = [];
  const account = { id: accountId, status: 'ACTIVE', currency: 'USD', equity: '100', cash: '100', buying_power: '100',
    non_marginable_buying_power: '100', multiplier: '1', shorting_enabled: false };
  const system = createPrincipalAlpacaBrokerageSystem({
    authorityCustody: { store() {}, revoke() {}, async retrieve() {
      return { kind: mode === 'paper' ? 'alpaca-trading-api-key' : 'alpaca-trading-api-key-live', environment: mode, venue,
        principal: contract.principal, accountReference: 'account', credential: { apiKeyId: 'fixture-key', apiSecret: 'fixture-secret' } };
    } },
    clock: () => now,
    resolveAuthorityGrant: async () => structuredClone(current.authorityGrant),
    resolveExecutionRecords: async () => structuredClone(current),
    recordObservation: async value => { records.push(value); return { id: 'observation-record' }; },
    recordExecution: async value => { records.push(value); return { id: 'execution-record' }; },
    transport: async request => {
      requests.push(request);
      const url = new URL(request.url);
      let status = 200, response;
      if (request.method === 'POST') {
        const order = { ...request.body, id: '11111111-1111-1111-1111-111111111111', status: 'new', filled_qty: '0' };
        orders.push(order); response = order;
      } else if (url.pathname === '/v2/account') { status = accountStatus; response = account; }
      else if (url.pathname === '/v2/orders:by_client_order_id') {
        response = orders.find(order => order.client_order_id === url.searchParams.get('client_order_id'));
        if (!response) status = 404;
      } else if (url.pathname === '/v2/orders') {
        response = [...orders];
        if (revokeAfterCapacity) current.authorityGrant.revoked = true;
      } else response = [];
      return { status, headers: {}, body: response ?? null };
    },
  });
  return { system, current, requests, records, orders,
    references: { contractReference: contract.id, authorityGrantReference: authorityGrant.id, intentReference: intent.id } };
}

for (const mode of ['paper', 'live']) {
  test(`${mode} funded limit order crosses custody and retries reconcile the same order`, async () => {
    const { system, references, requests, orders, records } = fixture(mode);
    const first = await system.execute(references);
    assert.equal(first.placementStatus, 200);
    assert.equal(first.accountReconciliationDisposition, 'pending');
    const second = await system.execute(references);
    assert.equal(second.idempotent, true);
    assert.equal(second.clientOrderId, first.clientOrderId);
    assert.equal(orders.length, 1);
    assert.equal(orders[0].type, 'limit');
    assert.equal(orders[0].limit_price, '10');
    assert.equal(orders[0].qty, '1.000000000');
    assert.ok(requests.every(request => new URL(request.url).hostname === (mode === 'paper' ? 'paper-api.alpaca.markets' : 'api.alpaca.markets')));
    assert.equal(records.filter(record => record.type === 'principal-alpaca-execution-reconciled').length, 2);
    assert.ok(!JSON.stringify(records).includes('fixture-secret'));
  });

  test(`${mode} mandate order retains its notional market body`, async () => {
    const { system, references, current, orders } = fixture(mode);
    delete current.intent.marketDecision;
    await system.execute(references);
    assert.equal(orders.length, 1);
    assert.equal(orders[0].type, 'market');
    assert.equal(orders[0].notional, 10);
    assert.equal(orders[0].qty, undefined);
  });
}

test('expired funding and a different principal cannot authorize a new limit order', async () => {
  for (const change of [{ at: '2095-12-31T23:00:00Z' }, { principal: 'another-principal' }]) {
    const { system, references, current, orders } = fixture('live');
    const { id, ...body } = current.intent.marketDecision;
    Object.assign(body, change);
    current.intent.marketDecision = { id: hashPosition(body), ...body };
    await assert.rejects(system.execute(references), /stale|another principal/);
    assert.equal(orders.length, 0);
  }
});

test('custody rechecks revoked authority after capacity reads and sends no order', async () => {
  const { system, references, orders } = fixture('live', { revokeAfterCapacity: true });
  const result = await system.execute(references);
  assert.equal(orders.length, 0);
  assert.equal(result.orderObservationDisposition, 'pending');
  assert.equal(result.pendingReason, 'post-effect-authority-unavailable');
});

test('failed or foreign-account observations cannot become recorded account evidence', async () => {
  for (const options of [{ accountStatus: 403 }, { accountId: 'another-account' }]) {
    const { system, records, orders } = fixture('live', options);
    await assert.rejects(system.observe({ authorityGrantReference: 'grant' }), /observation/);
    assert.equal(records.length, 0);
    assert.equal(orders.length, 0);
  }
});
