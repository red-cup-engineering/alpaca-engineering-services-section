import assert from 'node:assert/strict';
import test from 'node:test';
import { createMandatedPortfolioService, planMandatedPortfolioRebalance } from '../src/portfolio.mjs';

const input = (overrides = {}) => ({
  contract: { type: 'PrincipalBrokerageServiceContract', venue: 'alpaca-trading-paper',
    risk: { concentrationLimit: 1, maximumOrderNotional: 100, maximumAggregateNotional: 100 } },
  account: { equity: 100 }, positions: [], targetWeights: { AAA: 0.5, BBB: 0.5 },
  driftTolerance: 0, turnoverCapFraction: 0.0101, minimumOrderNotional: 0.01, ...overrides,
});
const cents = (plan) => plan.intents.reduce((sum, row) => sum + Math.round(row.notional * 100), 0);

test('cent allocation never rounds the two-target plan above its $1.01 cycle cap', () => {
  const plan = planMandatedPortfolioRebalance(input());
  assert.equal(plan.turnoverLimit, 1.01);
  assert.equal(cents(plan), 101);
  assert.deepEqual(plan.intents.map(({ symbol, notional }) => [symbol, notional]), [['AAA', 0.51], ['BBB', 0.5]]);
});

test('cent allocation respects subcent per-order caps rather than rounding them up', () => {
  const config = input({ targetWeights: { AAA: 1 }, turnoverCapFraction: 1 });
  config.contract.risk.maximumOrderNotional = 1.006;
  const plan = planMandatedPortfolioRebalance(config);
  assert.equal(plan.intents[0].notional, 1);
  assert.ok(plan.intents[0].notional <= config.contract.risk.maximumOrderNotional);
});

test('aggregate and cycle subcent caps are both rounded down to spendable cents', () => {
  for (const cap of [1.005, 1.009, 1.019]) {
    const config = input({ turnoverCapFraction: 1 });
    config.contract.risk.maximumAggregateNotional = cap;
    const plan = planMandatedPortfolioRebalance(config);
    assert.ok(cents(plan) <= Math.floor(cap * 100), `${cap}: emitted ${cents(plan)} cents`);
  }
});

test('equal remainders have deterministic symbol ties independent of target insertion order', () => {
  const first = planMandatedPortfolioRebalance(input({ targetWeights: { AAA: 0.5, BBB: 0.5 } }));
  const second = planMandatedPortfolioRebalance(input({ targetWeights: { BBB: 0.5, AAA: 0.5 } }));
  assert.deepEqual(first.intents, second.intents);
  assert.equal(cents(first), 101);
});

test('mixed buy/sell plans budget gross turnover and retain sell-first order', () => {
  const plan = planMandatedPortfolioRebalance(input({ positions: [{ symbol: 'AAA', market_value: '100' }] }));
  assert.equal(cents(plan), 101);
  assert.deepEqual(plan.intents.map(({ symbol, side, notional }) => [symbol, side, notional]), [['AAA', 'sell', 0.51], ['BBB', 'buy', 0.5]]);
});

test('minimum order filtering remains after cent allocation, with no forced subminimum order', () => {
  const plan = planMandatedPortfolioRebalance(input({ minimumOrderNotional: 0.51 }));
  assert.deepEqual(plan.intents.map(({ symbol, notional }) => [symbol, notional]), [['AAA', 0.51]]);
  const none = planMandatedPortfolioRebalance(input({ minimumOrderNotional: 1 }));
  assert.deepEqual(none.intents, []);
});

test('unscaled integral-cent plans and within-tolerance plans keep their existing behavior', () => {
  const plan = planMandatedPortfolioRebalance(input({ turnoverCapFraction: 1 }));
  assert.deepEqual(plan.intents.map(({ symbol, notional }) => [symbol, notional]), [['AAA', 50], ['BBB', 50]]);
  const quiet = planMandatedPortfolioRebalance(input({ positions: [{ symbol: 'AAA', market_value: 50 }, { symbol: 'BBB', market_value: 50 }] }));
  assert.deepEqual(quiet.intents, []);
});

test('the declared exact decimal cap is retained when Number conversion would round it up', () => {
  const config = input({ turnoverCapFraction: 1 });
  config.contract.risk.maximumAggregateNotional = '1.009999999999999999999999999';
  assert.equal(cents(planMandatedPortfolioRebalance(config)), 100);
  config.contract.risk.maximumOrderNotional = '0.509999999999999999999999999';
  config.contract.risk.maximumAggregateNotional = 100;
  assert.equal(cents(planMandatedPortfolioRebalance(config)), 100);
});

test('subcent budgets and scientific notation do not invent a spendable cent', () => {
  assert.deepEqual(planMandatedPortfolioRebalance(input({ turnoverCapFraction: '9.9e-5', minimumOrderNotional: 0.001 })).intents, []);
  assert.equal(cents(planMandatedPortfolioRebalance(input({ turnoverCapFraction: '1.01e-2' }))), 101);
});

test('the existing portfolio service carries the same bounded intents through injected execution and recording', async () => {
  const config = input();
  const contract = { ...config.contract, id: 'urn:contract:synthetic-cent-plan', principal: 'urn:principal:synthetic',
    capital: { amount: 100, currency: 'USD' }, scopes: ['orders:intent'],
    risk: { ...config.contract.risk, maximumLossAmount: 100 } };
  const authorityGrant = { type: 'RevocableBrokerageAuthorityGrant', id: 'urn:grant:synthetic-cent-plan',
    principalContract: contract.id, venue: contract.venue, adapter: contract.venue, revoked: false, scopes: ['orders:paper'] };
  const executed = [], records = [];
  const packets = ['AAA', 'BBB'].map(ticker => ({ type: 'IssuerEvidencePacket', id: `urn:evidence:${ticker}`, ticker }));
  const service = createMandatedPortfolioService({
    resolveMandate: async ({ mandateReference }) => ({
      ...config, id: mandateReference, contract, authorityGrant,
      evidencePackets: mandateReference === 'incomplete' ? packets.slice(0, 1) : packets,
    }),
    readPrincipalAccount: async () => ({ type: 'PrincipalAlpacaAccountObservationReceipt', id: 'urn:observation:synthetic',
      independentBooksReceipt: 'urn:books:synthetic', venue: contract.venue, authorityGrant: authorityGrant.id,
      observedAt: '2026-10-11T00:00:00Z', account: { payload: { equity: '100', last_equity: '100' } }, positions: { payload: [] } }),
    executeAuthorizedIntent: async ({ intent }) => { executed.push(intent); return { liveVenueEffect: false }; },
    recordCycle: async (record) => { records.push(record); return { id: 'urn:record:synthetic' }; },
    clock: () => '2026-10-11T00:00:00Z',
  });
  await assert.rejects(service.run({ mandateReference: 'incomplete' }), /issuer-evidence-required-for:BBB/);
  assert.equal(executed.length, 0);
  assert.equal(records.length, 0);
  const cycle = await service.run({ mandateReference: 'complete' });
  assert.equal(records[0].mandate, 'complete');
  assert.deepEqual(executed.map(intent => intent.evidence), [['urn:evidence:AAA'], ['urn:evidence:BBB']]);
  assert.deepEqual(executed.map(({ symbol, notional }) => [symbol, notional]), [['AAA', 0.51], ['BBB', 0.5]]);
  assert.equal(cents(cycle.plan), 101);
  assert.equal(records.length, 1);
  assert.equal(records[0].cycle.plan, cycle.plan);
  assert.equal(cycle.liveVenueEffect, false);
});

test('cash baseline exits legacy holdings absent from the selected portfolio', () => {
  const plan = planMandatedPortfolioRebalance(input({
    positions: [{ symbol: 'AAA', market_value: '40' }, { symbol: 'BBB', market_value: '30' }],
    targetWeights: {}, turnoverCapFraction: 1,
  }));
  assert.equal(plan.cashWeight, 1);
  assert.deepEqual(plan.intents.map(({ symbol, side, notional }) => [symbol, side, notional]), [
    ['AAA', 'sell', 40], ['BBB', 'sell', 30],
  ]);
});

test('partial cash and a new target exit stale holdings under the same turnover budget', () => {
  const plan = planMandatedPortfolioRebalance(input({
    positions: [{ symbol: 'AAA', market_value: '40' }, { symbol: 'BBB', market_value: '30' }],
    targetWeights: { AAA: 0.2, CCC: 0.1 }, turnoverCapFraction: 1,
  }));
  assert.equal(plan.cashWeight, 0.7);
  assert.deepEqual(plan.intents.map(({ symbol, side, notional }) => [symbol, side, notional]), [
    ['AAA', 'sell', 20], ['BBB', 'sell', 30], ['CCC', 'buy', 10],
  ]);
});
