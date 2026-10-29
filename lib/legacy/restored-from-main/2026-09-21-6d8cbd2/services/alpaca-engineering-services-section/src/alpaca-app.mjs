import { createHash } from "node:crypto";
import { evaluateKillSwitch } from "@red-cup-engineering/alpaca-account-kill-switch-service";
import { formAggressivePortfolioIntent } from "@red-cup-engineering/alpha-portfolio-order-intent-service";
import {
  createLiveExecutionAndReconciliationProvider,
  createPaperExecutionAndReconciliationProvider,
} from "@red-cup-engineering/brokerage-execution-transport-service";

const TERMINAL = new Set(["filled", "canceled", "expired", "rejected"]);
const requiredAdapterMethods = ["readAccount", "listPositions", "getOrderByClientOrderId", "placeOrder", "listActivities"];
const finite = (value, label) => { const number = Number(value); if (!Number.isFinite(number)) throw new TypeError(`${label}-invalid`); return number; };
const positive = (value, label) => { const number = finite(value, label); if (number <= 0) throw new TypeError(`${label}-invalid`); return number; };
const text = (value, label) => { if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label}-required`); return value.trim(); };
const digest = (value) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

export function validateAlpacaAppConfiguration(configuration) {
  const principal = text(configuration?.principal, "principal");
  const accountReference = text(configuration?.accountReference, "account-reference");
  const mode = configuration?.mode;
  if (!['paper', 'bounded-live'].includes(mode)) throw new TypeError("explicit-paper-or-bounded-live-mode-required");
  const venue = mode === "paper" ? "alpaca-trading-paper" : "alpaca-trading-live";
  const contract = configuration?.contract, authorityGrant = configuration?.authorityGrant, envelope = configuration?.envelope;
  if (contract?.type !== "PrincipalBrokerageServiceContract" || authorityGrant?.type !== "RevocableBrokerageAuthorityGrant") throw new TypeError("contract-and-authority-grant-required");
  if (contract.principal !== principal || authorityGrant.principal !== principal || contract.accountReference !== accountReference || authorityGrant.accountReference !== accountReference) throw new TypeError("principal-account-binding-mismatch");
  if (contract.venue !== venue || authorityGrant.venue !== venue || authorityGrant.adapter !== venue || authorityGrant.principalContract !== contract.id) throw new TypeError("venue-binding-mismatch");
  if (authorityGrant.revoked !== false) throw new TypeError("current-authority-grant-required");
  if (configuration.armed !== true) throw new TypeError("alpaca-app-not-armed");
  if (mode === "bounded-live" && text(configuration.liveArmingReference, "live-arming-reference") === contract.id) throw new TypeError("independent-live-arming-reference-required");
  const capital = positive(envelope?.capital, "capital");
  const maximumOrderNotional = positive(envelope?.maximumOrderNotional, "maximum-order-notional");
  const maximumGrossExposure = positive(envelope?.maximumGrossExposure, "maximum-gross-exposure");
  const maximumDailyLossFraction = positive(envelope?.maximumDailyLossFraction, "maximum-daily-loss-fraction");
  const maximumDrawdownFraction = positive(envelope?.maximumDrawdownFraction, "maximum-drawdown-fraction");
  if (maximumOrderNotional > capital || maximumGrossExposure > capital || maximumDailyLossFraction > 0.03 || maximumDrawdownFraction > 0.10) throw new RangeError("capital-envelope-too-wide");
  if (!Array.isArray(envelope.symbols) || envelope.symbols.length === 0 || envelope.symbols.some((symbol) => typeof symbol !== "string" || !symbol.trim())) throw new TypeError("symbol-allowlist-required");
  if (!Array.isArray(envelope.tradingWindows) || envelope.tradingWindows.length === 0) throw new TypeError("trading-window-required");
  return Object.freeze({ ...configuration, principal, accountReference, mode, venue, contract, authorityGrant,
    envelope: Object.freeze({ ...envelope, capital, maximumOrderNotional, maximumGrossExposure, maximumDailyLossFraction, maximumDrawdownFraction, symbols: envelope.symbols.map((symbol) => symbol.toUpperCase()) }) });
}

function inTradingWindow(at, windows) {
  const date = new Date(at); if (!Number.isFinite(date.valueOf())) throw new TypeError("current-time-invalid");
  const day = date.getUTCDay(), minute = date.getUTCHours() * 60 + date.getUTCMinutes();
  return windows.some(({ days, startMinuteUtc, endMinuteUtc }) => Array.isArray(days) && days.includes(day) && Number.isInteger(startMinuteUtc) && Number.isInteger(endMinuteUtc) && minute >= startMinuteUtc && minute < endMinuteUtc);
}

function publicAccountPayload(receipt) { return receipt?.payload ?? receipt?.body ?? receipt; }
function accountNumber(payload, name) { return finite(payload?.[name], `account-${name}`); }
function grossExposure(positions) { return positions.reduce((sum, position) => sum + Math.abs(finite(position.market_value ?? 0, "position-market-value")), 0); }

export function createAlpacaApp({ configuration, adapter, strategy, state, recordOutcome = async () => null, clock = () => new Date().toISOString() }) {
  const config = validateAlpacaAppConfiguration(configuration);
  if (requiredAdapterMethods.some((method) => typeof adapter?.[method] !== "function")) throw new TypeError("complete-alpaca-adapter-required");
  if (typeof strategy !== "function" || typeof state?.load !== "function" || typeof state?.save !== "function" || typeof recordOutcome !== "function") throw new TypeError("strategy-state-and-recorder-required");
  const records = new Map([[config.contract.id, config.contract], [config.authorityGrant.id, config.authorityGrant]]);
  const resolveRecords = async ({ contractReference, authorityGrantReference, intentReference }) => ({ contract: records.get(contractReference), authorityGrant: records.get(authorityGrantReference), intent: records.get(intentReference), revocation: state.load().revocation ?? null });
  const execute = config.mode === "paper"
    ? createPaperExecutionAndReconciliationProvider({ resolvePaperExecutionRecords: resolveRecords, adapter, clock })
    : createLiveExecutionAndReconciliationProvider({ resolveLiveExecutionRecords: resolveRecords, adapter, clock });

  async function observe() {
    const at = clock(), [accountReceipt, positionsReceipt] = await Promise.all([adapter.readAccount({ grant: config.authorityGrant, now: at }), adapter.listPositions({ grant: config.authorityGrant, now: at })]);
    const account = publicAccountPayload(accountReceipt), positions = publicAccountPayload(positionsReceipt);
    if (account?.id !== config.accountReference) throw new TypeError("returned-account-identity-mismatch");
    if (!Array.isArray(positions)) throw new TypeError("positions-response-invalid");
    return { at, account, positions, accountReceipt, positionsReceipt };
  }

  async function run() {
    const before = state.load();
    if (before.revocation?.effective === true) throw new Error("alpaca-app-revoked");
    if (before.paused === true) throw new Error("alpaca-app-paused");
    const observation = await observe();
    if (!inTradingWindow(observation.at, config.envelope.tradingWindows)) return Object.freeze({ disposition: "outside-trading-window", observedAt: observation.at });
    const equity = accountNumber(observation.account, "equity"), lastEquity = accountNumber(observation.account, "last_equity");
    const houseRisk = evaluateKillSwitch({ equity, lastEquity, priorHighWaterMark: before.highWaterMark });
    const drawdownTripped = houseRisk.drawdownPct > config.envelope.maximumDrawdownFraction;
    const dailyLossTripped = houseRisk.dailyLossPct > config.envelope.maximumDailyLossFraction;
    if (houseRisk.tripped || drawdownTripped || dailyLossTripped) {
      state.save({ ...before, paused: true, highWaterMark: houseRisk.highWaterMark, lastRisk: houseRisk, pauseReason: "risk-limit-tripped", updatedAt: observation.at });
      return Object.freeze({ disposition: "risk-paused", risk: houseRisk, observedAt: observation.at });
    }
    const decision = await strategy({ principal: config.principal, accountReference: config.accountReference, venue: config.venue, observedAt: observation.at, account: observation.account, positions: observation.positions, envelope: config.envelope });
    if (decision?.disposition === "portfolio") {
      if (!Array.isArray(decision.orders) || decision.orders.length === 0) throw new TypeError("portfolio-orders-required");
      const outcomes = [];
      let projectedGross = grossExposure(observation.positions);
      for (const order of decision.orders) {
        const notional = positive(order.notional, "decision-notional");
        projectedGross = order.side === "sell" ? Math.max(0, projectedGross - notional) : projectedGross + notional;
        if (projectedGross > config.envelope.maximumGrossExposure) throw new RangeError("gross-exposure-cap-exceeded");
        outcomes.push(await executeDecision(order, observation, before, houseRisk));
      }
      const outcome = Object.freeze({ type: "AlpacaAppPortfolioOutcome", disposition: "portfolio-executed", mode: config.mode, venue: config.venue, principal: config.principal, target: decision.target, outcomes: Object.freeze(outcomes), observedAt: outcomes.at(-1)?.observedAt ?? observation.at });
      await recordOutcome(outcome);
      state.save({ ...before, highWaterMark: houseRisk.highWaterMark, lastRisk: houseRisk, lastDecision: decision, lastOutcome: outcome, updatedAt: outcome.observedAt });
      return outcome;
    }
    if (decision?.disposition !== "order") {
      state.save({ ...before, highWaterMark: houseRisk.highWaterMark, lastRisk: houseRisk, lastDecision: decision ?? { disposition: "hold" }, updatedAt: observation.at });
      return Object.freeze({ disposition: decision?.disposition ?? "hold", risk: houseRisk, observedAt: observation.at });
    }
    return executeDecision(decision, observation, before, houseRisk);
  }

  async function executeDecision(decision, observation, before, houseRisk) {
    const symbol = text(decision.symbol, "decision-symbol").toUpperCase(), notional = positive(decision.notional, "decision-notional");
    if (!config.envelope.symbols.includes(symbol)) throw new RangeError("symbol-not-allowed");
    if (notional > config.envelope.maximumOrderNotional) throw new RangeError("per-order-cap-exceeded");
    const existingGross = grossExposure(observation.positions);
    if (existingGross + notional > config.envelope.maximumGrossExposure) throw new RangeError("gross-exposure-cap-exceeded");
    const evidencePackets = decision.evidencePackets ?? [{ id: digest({ strategy: decision.strategy ?? "operator", observedAt: observation.at, symbol }), type: "IssuerEvidencePacket" }];
    const intent = formAggressivePortfolioIntent({ contract: config.contract, evidencePackets, symbol, side: decision.side ?? "buy", notional,
      maximumLoss: positive(decision.maximumLoss, "decision-maximum-loss"), thesis: text(decision.thesis, "decision-thesis"), falsifier: text(decision.falsifier, "decision-falsifier"),
      liquidityPremise: text(decision.liquidityPremise, "decision-liquidity-premise"), executionPremise: text(decision.executionPremise, "decision-execution-premise"),
      scenarios: decision.scenarios });
    records.set(intent.id, intent);
    if (typeof adapter.registerExecutionRecords === "function") adapter.registerExecutionRecords({ contract: config.contract, authorityGrant: config.authorityGrant, intent, revocation: before.revocation ?? null });
    const request = { contractReference: config.contract.id, authorityGrantReference: config.authorityGrant.id, intentReference: intent.id };
    const receipt = await execute(request);
    const orderStatus = String(receipt.orderVenueStatus ?? "unknown").toLowerCase();
    const outcome = { type: "AlpacaAppOrderOutcome", id: digest({ intent: intent.id, receipt: receipt.id }), principal: config.principal, accountReference: config.accountReference, venue: config.venue, mode: config.mode, intent, receipt,
      lifecycle: TERMINAL.has(orderStatus) ? orderStatus : "pending", observedAt: receipt.observedAt };
    await recordOutcome(outcome);
    state.save({ ...before, highWaterMark: houseRisk.highWaterMark, lastRisk: houseRisk, lastOutcome: outcome, updatedAt: receipt.observedAt });
    return Object.freeze(outcome);
  }

  async function cancel(clientOrderId) {
    if (typeof adapter.cancelOrderByClientOrderId !== "function") throw new TypeError("cancel-operation-unavailable");
    const before = state.load(); if (before.revocation?.effective === true) throw new Error("alpaca-app-revoked");
    const at = clock(), cancellation = await adapter.cancelOrderByClientOrderId({ grant: config.authorityGrant, clientOrderId: text(clientOrderId, "client-order-id"), now: at });
    const observed = await adapter.getOrderByClientOrderId({ grant: config.authorityGrant, clientOrderId, now: at });
    const outcome = { type: "AlpacaAppCancellationOutcome", id: digest({ clientOrderId, cancellation, observed }), clientOrderId, cancellation, observed, observedAt: at };
    await recordOutcome(outcome); state.save({ ...before, lastCancellation: outcome, updatedAt: at }); return Object.freeze(outcome);
  }

  const status = async () => {
    const observation = await observe(), equity = accountNumber(observation.account, "equity"), lastEquity = accountNumber(observation.account, "last_equity");
    const unrealizedPnl = observation.positions.reduce((sum, position) => sum + finite(position.unrealized_pl ?? 0, "position-unrealized-pnl"), 0);
    return Object.freeze({ principal: config.principal, accountReference: config.accountReference, venue: config.venue, mode: config.mode, armed: true, state: state.load(), account: observation.account, positions: observation.positions,
      pnl: { equity, lastEquity, daily: equity - lastEquity, dailyFraction: lastEquity > 0 ? (equity - lastEquity) / lastEquity : null, unrealized: unrealizedPnl, grossExposure: grossExposure(observation.positions) }, observedAt: observation.at });
  };
  const pause = (reason = "operator-paused") => state.save({ ...state.load(), paused: true, pauseReason: text(reason, "pause-reason"), updatedAt: clock() });
  const resume = () => { const current = state.load(); if (current.revocation?.effective === true) throw new Error("alpaca-app-revoked"); return state.save({ ...current, paused: false, pauseReason: null, updatedAt: clock() }); };
  const revoke = (reason = "operator-revoked") => state.save({ ...state.load(), paused: true, revocation: { effective: true, reason: text(reason, "revocation-reason"), revokedAt: clock(), authorityGrant: config.authorityGrant.id }, updatedAt: clock() });
  return Object.freeze({ run, status, cancel, pause, resume, revoke });
}
