import { createAlpacaHistoricalBarsService } from "@red-cup-engineering/brokerage-control-api-federation/historical-bars";
import { createBrokerageMarketEventRecorder } from "@red-cup-engineering/brokerage-independent-witness-and-books";
import { evaluateBlkAccumulationStrategy } from "@red-cup-engineering/brokerage-control-api-federation/strategy";

const required = (value, label) => { if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label}-required`); return value.trim(); };

export async function createStrategy(configuration, dependencies = {}) {
  const strategyConfig = configuration?.strategy;
  if (strategyConfig?.kind !== "obsmetrologia-blk-accumulation") throw new TypeError("blk-strategy-configuration-required");
  const keyName = required(strategyConfig.keyEnvironmentVariable, "market-data-key-environment-variable"), secretName = required(strategyConfig.secretEnvironmentVariable, "market-data-secret-environment-variable");
  const environment = dependencies.environment ?? process.env;
  const marketEnvironment = { ALPACA_ACCOUNT_ESTHER_PAPER_TRADING_KEY: required(environment[keyName], "configured-market-data-key"), ALPACA_ACCOUNT_ESTHER_PAPER_TRADING_SECRET: required(environment[secretName], "configured-market-data-secret") };
  const recordObservation = dependencies.recordObservation ?? createBrokerageMarketEventRecorder({ originatingActor: "urn:ame:alpaca-app-blk-strategy", nodeId: required(configuration?.books?.nodeId, "books-node-id") },
    { BROKERAGE_BOOKS_DATA_ROOT: required(configuration?.books?.dataRoot, "books-data-root") }, { now: dependencies.clock });
  const marketData = createAlpacaHistoricalBarsService(marketEnvironment, { fetchImpl: dependencies.fetchImpl, recordObservation, now: dependencies.clock });
  return async function blkStrategy(context) {
    const lookbackDays = Number(strategyConfig.lookbackDays ?? 400);
    if (!Number.isInteger(lookbackDays) || lookbackDays < 180) throw new RangeError("blk-lookback-days-invalid");
    const start = new Date(Date.parse(context.observedAt) - lookbackDays * 86_400_000).toISOString();
    const observation = await marketData.readDailyBars({ symbols: ["BLK", "SPY"], start, end: context.observedAt, feed: strategyConfig.feed ?? "iex", adjustment: "all" });
    const blkPosition = context.positions.find((position) => position.symbol === "BLK"), cash = Number(context.account.cash), currentBlkMarketValue = Number(blkPosition?.market_value ?? 0);
    const reading = evaluateBlkAccumulationStrategy({ blkBars: observation.bars.BLK, spyBars: observation.bars.SPY, asOf: context.observedAt, cash, currentBlkMarketValue,
      scheduledContribution: Number(strategyConfig.scheduledContribution ?? 0), maximumOrderFraction: Math.min(Number(strategyConfig.maximumOrderFraction ?? 0.1), context.envelope.maximumOrderNotional / Math.max(cash, 1)),
      volatilityTarget: Number(strategyConfig.volatilityTarget ?? 0.18), maximumDrawdown: Number(strategyConfig.strategyMaximumDrawdown ?? 0.30), marketDataObservation: observation.id });
    if (reading.disposition !== "accumulate" || reading.proposedNotional <= 0) return { disposition: reading.disposition, reading, observation: observation.id };
    const notional = Math.min(reading.proposedNotional, context.envelope.maximumOrderNotional), maximumLoss = Math.min(notional, configuration.contract.risk.maximumLossAmount, notional * Number(strategyConfig.maximumLossFraction ?? 0.1));
    return { disposition: "order", strategy: "obsmetrologia-blk-accumulation", symbol: "BLK", side: "buy", notional, maximumLoss,
      evidencePackets: [{ id: observation.id, type: "IssuerEvidencePacket" }], thesis: reading.hypothesis, falsifier: reading.falsifiers.join("; "),
      liquidityPremise: "BLK fractional notional market orders remain available at Alpaca", executionPremise: "the bounded market order is reconciled by client order id",
      scenarios: [{ name: "declared-loss", pnl: -maximumLoss }, { name: "flat", pnl: 0 }, { name: "upside", pnl: maximumLoss }], reading };
  };
}
