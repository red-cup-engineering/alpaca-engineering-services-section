import { AsyncLocalStorage } from 'node:async_hooks';
// The system carrier for a principal's Alpaca mandate.  It composes the
// existing custody, observation, planning, and reconciled-execution
// capabilities without accepting broker secrets or a caller-selected mode.
import { formAggressivePortfolioIntent } from '@red-cup-engineering/alpha-portfolio-order-intent-service';
import { allocationsFor } from '@red-cup-engineering/mandate-portfolio-allocation-service/market-game';
import { createBrokerageAuthorityStorage } from "@red-cup-engineering/brokerage-authority-custody-service";
import { createAlpacaAdapter } from "@red-cup-engineering/pluggable-venue-adapter-service/alpaca";
import {
  createLiveExecutionAndReconciliationProvider,
  createPaperExecutionAndReconciliationProvider,
} from "@red-cup-engineering/brokerage-execution-transport-service";
import { createAlpacaPrincipalAccountReadService } from "./principal-account-read.mjs";
import { createMandatedPortfolioService } from "./portfolio.mjs";
import { createStockBrokerageRouteSelector } from '@red-cup-engineering/stock-brokerage-engine';
import { evaluateAccountHalt, haltLimitsOf } from "./account-halt.mjs";

const PRODUCTS = Object.freeze({
  paper: Object.freeze({ product: "alpaca-trading-paper", baseUrl: "https://paper-api.alpaca.markets/" }),
  live: Object.freeze({ product: "alpaca-trading-live", baseUrl: "https://api.alpaca.markets/" }),
});

const reference = (value, label) => {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${label}-required`);
  return value;
};

const modeFor = createStockBrokerageRouteSelector({
  'alpaca-trading-paper': 'paper',
  'alpaca-trading-live': 'live',
});

function requireRecord(record, label) {
  if (!record?.id && !record?.graph && !record?.recordReceipt) throw new TypeError(`${label}-record-receipt-required`);
  return record;
}

/**
 * Create the sole operational boundary for a principal-owned Alpaca account.
 *
 * The supplied `authorityCustody` is the only component that ever retrieves
 * credential bytes.  A request names a contract, revocable grant, and intent;
 * its mode is recovered from those current records, so a public caller cannot
 * convert a paper authorization into a live order by changing a flag.
 */
export function createPrincipalAlpacaBrokerageSystem({
  authorityCustody: authorityStorage,
  transport,
  resolveAuthorityGrant,
  resolveExecutionRecords,
  resolveMandate,
  recordObservation,
  recordExecution,
  recordIntent,
  resolveFleetRecords,
  recordVenueOperation,
  recordCycle,
  resolveHighWaterMark = async () => null,
  trustedPromotionActorKeys = {},
  fetchImpl = fetch,
  clock = () => new Date().toISOString(),
} = {}) {
  if (typeof transport !== "function" || typeof resolveAuthorityGrant !== "function"
    || typeof resolveExecutionRecords !== "function" || typeof recordObservation !== "function"
    || typeof recordExecution !== "function") {
    throw new TypeError("principal-brokerage-system-boundaries-required");
  }

  // Each invocation carries its exact record references through async venue calls.
  // Custody resolves those records again immediately before using credentials.
  const executionContext = new AsyncLocalStorage();
  const activeAuthorization = mode => async intentReference => {
    const references = executionContext.getStore();
    if (!references || references.intentReference !== intentReference) {
      throw new TypeError(`current-${mode}-intent-authorization-required`);
    }
    return resolveFor(mode)(references);
  };

  const storage = createBrokerageAuthorityStorage({
    authorityCustody: authorityStorage,
    transport,
    resolveAuthorityGrant,
    resolvePaperOperationAuthorization: activeAuthorization("paper"),
    resolveLiveOperationAuthorization: activeAuthorization("live"),
    fetchImpl,
    clock,
  });
  const adapters = new Map();
  const adapterFor = (mode) => {
    let adapter = adapters.get(mode);
    if (!adapter) {
      const product = PRODUCTS[mode];
      adapter = createAlpacaAdapter({ product: product.product, baseUrl: product.baseUrl, authorityClient: storage, recordReceipt: recordVenueOperation });
      adapters.set(mode, adapter);
    }
    return adapter;
  };

  const resolveFor = (mode) => async (references) => {
    const exact = Object.freeze({
      contractReference: reference(references?.contractReference, "contract-reference"),
      authorityGrantReference: reference(references?.authorityGrantReference, "authority-grant-reference"),
      intentReference: reference(references?.intentReference, "intent-reference"),
    });
    const records = await resolveExecutionRecords(exact);
    if (records?.contract?.id !== exact.contractReference || records?.authorityGrant?.id !== exact.authorityGrantReference
      || records?.intent?.id !== exact.intentReference || modeFor(records) !== mode) {
      throw new TypeError(`current-${mode}-execution-records-required`);
    }
    return records;
  };

  const paperExecutor = createPaperExecutionAndReconciliationProvider({
    resolvePaperExecutionRecords: resolveFor("paper"),
    adapter: adapterFor("paper"),
    trustedPromotionActorKeys,
    clock,
  });
  const liveExecutor = createLiveExecutionAndReconciliationProvider({
    resolveLiveExecutionRecords: resolveFor("live"),
    adapter: adapterFor("live"),
    clock,
  });

  const execute = async ({ contractReference, authorityGrantReference, intentReference } = {}) => {
    const references = Object.freeze({
      contractReference: reference(contractReference, "contract-reference"),
      authorityGrantReference: reference(authorityGrantReference, "authority-grant-reference"),
      intentReference: reference(intentReference, "intent-reference"),
    });
    // Select the executor only after a current, exact set of records is read.
    // The provider resolves the same records immediately before venue effects.
    const initial = await resolveExecutionRecords(references);
    const mode = modeFor(initial);
    return executionContext.run(references, async () => {
      const outcome = await (mode === "paper" ? paperExecutor : liveExecutor)(references);
      const executionRecord = await recordExecution({
        type: "principal-alpaca-execution-reconciled",
        contract: references.contractReference,
        authorityGrant: references.authorityGrantReference,
        intent: references.intentReference,
        mode,
        outcome,
        recordedAt: clock(),
      });
      return Object.freeze({ ...outcome, executionRecord: requireRecord(executionRecord, "principal-alpaca-execution") });
    });
  };

  const observe = createAlpacaPrincipalAccountReadService({
    resolveAuthorityGrant,
    authorityCustody: storage,
    recordObservation,
    clock,
  });

  const executeMarketDecision = typeof resolveFleetRecords === 'function' && typeof recordIntent === 'function'
    ? async (references) => {
      const { contract, authorityGrant, decision, evidencePackets } = await resolveFleetRecords(references);
      if (modeFor({contract,authorityGrant}) !== 'live' || contract.id !== references.contractReference
        || authorityGrant.id !== references.authorityGrantReference || decision.id !== references.marketDecisionReference) throw new TypeError('current-live-fleet-bindings-required');
      allocationsFor(decision,{venue:'alpaca',principal:contract.principal,instrument:'__validate_only__',side:'long',at:clock()});
      const orders = decision.orders.filter(order => order.venue === 'alpaca');
      // The account-level breaker (src/account-halt.mjs) reads the account evidence the game sized this decision on
      // (decision.equityCents, from its `account` moves); no new broker read and no new scope. Without account evidence
      // the game makes no decision (planMarket: fresh account readings required), so nothing reaches here to place.
      const accountHalt = orders.length ? evaluateAccountHalt({account:{equity:decision.equityCents/100},priorHighWaterMark:await resolveHighWaterMark({contract,authorityGrant,decision}),limits:haltLimitsOf(contract),mode:'live'}) : null;
      if (accountHalt?.halted) return Object.freeze({type:'AlpacaFleetDecisionExecution',decision:decision.id,executions:Object.freeze([]),accountHalt,
        disposition:'halted-by-account-limits',portfolioCompletionClaimed:false});
      const executions = [];
      for (const order of orders) {
        const funded = allocationsFor(decision,{venue:'alpaca',principal:contract.principal,instrument:order.instrument,side:'long',at:clock()});
        if (funded.length !== 1 || funded[0].id !== order.id || order.carrier !== 'asset') throw new TypeError('one-funded-asset-order-per-instrument-required');
        const notional = Math.floor(Math.min(order.capitalCents / 100, contract.risk.maximumOrderNotional,
          contract.risk.maximumLossAmount, contract.capital.amount * contract.risk.concentrationLimit) * 100) / 100;
        if (!(notional > 0)) continue;
        const intent = formAggressivePortfolioIntent({contract,evidencePackets,symbol:order.instrument,side:'buy',notional,
          maximumLoss:notional,marketDecision:decision,asOf:clock(),thesis:order.thesis,falsifier:order.falsifier,
          liquidityPremise:'The funded quote defines displayed quantity and the maximum limit price.',
          executionPremise:'Current contract, authority, broker account and resting orders admit this funded fleet leg.',
          scenarios:[{name:'loss-of-entire-funded-position',pnl:-notional},{name:'no-fill',pnl:0}]});
        requireRecord(await recordIntent({contract,authorityGrant,intent}), 'fleet-intent');
        try {
          const outcome = await execute({contractReference:contract.id,authorityGrantReference:authorityGrant.id,intentReference:intent.id});
          executions.push({orderId:order.id,intentReference:intent.id,outcome});
        } catch (error) {
          executions.push({orderId:order.id,intentReference:intent.id,error:error instanceof Error?error.message:String(error)});
        }
      }
      return Object.freeze({type:'AlpacaFleetDecisionExecution',decision:decision.id,executions,accountHalt,
        disposition:executions.length?'venue-legs-recorded-reconciliation-required':'no-funded-alpaca-leg',portfolioCompletionClaimed:false});
    } : undefined;

  const portfolio = typeof resolveMandate === "function" && typeof recordCycle === "function"
    ? createMandatedPortfolioService({
      resolveMandate: async references => {
        const mandate = await resolveMandate(references);
        modeFor(mandate);
        return mandate;
      },
      readPrincipalAccount: observe,
      executeAuthorizedIntent: async ({ contract, authorityGrant, intent }) => {
        if (typeof recordIntent !== 'function') throw new TypeError('durable-portfolio-intent-recorder-required');
        requireRecord(await recordIntent({contract,authorityGrant,intent}), 'portfolio-intent');
        return execute({
        contractReference: contract.id,
        authorityGrantReference: authorityGrant.id,
        intentReference: intent.id,
      }); },
      recordCycle,
      resolveHighWaterMark,
      clock,
    })
    : null;

  return Object.freeze({
    observe,
    execute,
    executeMarketDecision,
    runMandatedPortfolio: portfolio?.run,
    // Kept narrow for the public application: it can verify the current grant
    // before presenting an action, but cannot retrieve a credential or choose
    // a venue URL.
    preflight: async (references) => {
      const records = await resolveExecutionRecords(references);
      const mode = modeFor(records);
      await (mode === "paper" ? paperExecutor : liveExecutor).preflight(references);
      return Object.freeze({ mode, contract: records.contract.id, authorityGrant: records.authorityGrant.id, intent: records.intent.id });
    },
  });
}
