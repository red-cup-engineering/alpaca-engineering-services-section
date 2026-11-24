import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAccountHalt, haltLimitsOf, DEFAULT_HALT_LIMITS } from '../src/account-halt.mjs';
import { runMandatedPortfolioCycle } from '../src/portfolio.mjs';

test('the contract declares the halt limits; undeclared ones are the retired kill switch\'s', () => {
  assert.deepEqual({ ...haltLimitsOf({ risk: {} }) }, { ...DEFAULT_HALT_LIMITS });
  assert.deepEqual({ ...haltLimitsOf({ risk: { maximumDrawdownFraction: 0.2, maximumDailyLossFraction: 0.05, equityFloorAmount: 500 } }) },
    { maximumDrawdownFraction: 0.2, maximumDailyLossFraction: 0.05, equityFloorAmount: 500 });
  for (const risk of [{ maximumDrawdownFraction: 0 }, { maximumDrawdownFraction: 1 }, { maximumDailyLossFraction: -0.1 }, { equityFloorAmount: -1 }, { equityFloorAmount: '5' }])
    assert.throws(() => haltLimitsOf({ risk }), /out-of-range/u);
});

test('drawdown from the recorded high-water mark, the day\'s loss and the floor each halt', () => {
  const calm = evaluateAccountHalt({ account: { equity: '1000', last_equity: '1010' }, priorHighWaterMark: 1050, mode: 'live' });
  assert.equal(calm.halted, false); assert.equal(calm.highWaterMark, 1050); assert.equal(calm.highWaterMarkSource, 'recorded');
  const drawn = evaluateAccountHalt({ account: { equity: '890', last_equity: '895' }, priorHighWaterMark: 1000, mode: 'live' });
  assert.equal(drawn.halted, true); assert.ok(Math.abs(drawn.drawdownFraction - 0.11) < 1e-12); assert.match(drawn.reasons[0], /^drawdown 11\.000%/u);
  const daily = evaluateAccountHalt({ account: { equity: '960', last_equity: '1000' }, priorHighWaterMark: 1000, mode: 'live' });
  assert.equal(daily.halted, true); assert.deepEqual(daily.reasons.map((r) => r.split(' ')[0]), ['daily']);
  const floor = evaluateAccountHalt({ account: { equity: '400', last_equity: '400' }, priorHighWaterMark: 400, mode: 'live', limits: haltLimitsOf({ risk: { equityFloorAmount: 500 } }) });
  assert.equal(floor.halted, true); assert.match(floor.reasons[0], /under the floor 500\.00/u);
});

test('the mark only rises, and a first reading is its own mark', () => {
  const up = evaluateAccountHalt({ account: { equity: 1200 }, priorHighWaterMark: 1000, mode: 'live' });
  assert.equal(up.highWaterMark, 1200); assert.equal(up.drawdownFraction, 0); assert.equal(up.lastEquity, null);
  const first = evaluateAccountHalt({ account: { equity: 1000, last_equity: 1000 }, mode: 'paper' });
  assert.equal(first.highWaterMark, 1000); assert.equal(first.highWaterMarkSource, 'this-reading'); assert.equal(first.halted, false);
});

test('a paper account reset rebaselines instead of tripping (the 2026-07-23 false trip); a live account never does', () => {
  const reset = { account: { equity: '100014.23', last_equity: '200000' }, priorHighWaterMark: 200000 };
  const paper = evaluateAccountHalt({ ...reset, mode: 'paper' });
  assert.equal(paper.resetDetected, true); assert.equal(paper.halted, false); assert.equal(paper.highWaterMark, 100014.23);
  const live = evaluateAccountHalt({ ...reset, mode: 'live' });
  assert.equal(live.resetDetected, false); assert.equal(live.halted, true); assert.equal(live.reasons.length, 2);
});

test('an unreadable account or mode halts nothing silently: it refuses', () => {
  for (const account of [{}, { equity: '' }, { equity: '0' }, { equity: 'NaN' }, null]) assert.throws(() => evaluateAccountHalt({ account, mode: 'live' }), /broker-account-equity-required/u);
  assert.throws(() => evaluateAccountHalt({ account: { equity: 1 }, mode: 'margin' }), /alpaca-mode-required/u);
});

test('a halted portfolio cycle plans but places nothing and carries the mark forward', async () => {
  const contract = { id: 'c', type: 'PrincipalBrokerageServiceContract', venue: 'alpaca-trading-paper', principal: 'p', scopes: ['orders:intent'],
    risk: { maximumLossAmount: 100, concentrationLimit: 1, maximumOrderNotional: 1000, maximumAggregateNotional: 1000, maximumDrawdownFraction: 0.1 } };
  const authorityGrant = { id: 'g', type: 'RevocableBrokerageAuthorityGrant', principalContract: 'c', venue: contract.venue, adapter: contract.venue, revoked: false, scopes: ['orders:paper'] };
  const observation = { venue: contract.venue, authorityGrant: 'g', observedAt: '2026-10-10T14:00:00Z', account: { equity: '850', last_equity: '860' }, positions: [] };
  let attempted = 0;
  const cycle = await runMandatedPortfolioCycle({ contract, authorityGrant, observation, targetWeights: { SPY: 1 }, driftTolerance: 0.05, turnoverCapFraction: 1,
    evidencePackets: [{ type: 'IssuerEvidencePacket', id: 'e' }], priorHighWaterMark: 1000, executeIntent: async () => { attempted += 1; } });
  assert.equal(cycle.plan.intents.length, 1, 'the plan offers a buy so the halt is exercised');
  assert.equal(cycle.disposition, 'halted-by-account-limits'); assert.equal(attempted, 0); assert.equal(cycle.executions.length, 0);
  assert.equal(cycle.accountHalt.highWaterMark, 1000); assert.equal(cycle.liveVenueEffect, false);
});
