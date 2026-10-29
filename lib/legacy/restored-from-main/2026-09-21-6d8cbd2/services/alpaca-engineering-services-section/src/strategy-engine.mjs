import { allocateMandatePortfolio } from "@red-cup-engineering/mandate-portfolio-allocation-service";

const finite = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label}-invalid`);
  return number;
};
const required = (value, label) => {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label}-required`);
  return value.trim();
};

function validateStrategy(strategy, index) {
  if (!strategy || typeof strategy.evaluate !== "function") throw new TypeError(`strategy-${index}-evaluate-required`);
  return Object.freeze({ ...strategy, id: required(strategy.id, `strategy-${index}-id`) });
}

function currentPortfolio(context) {
  const equity = finite(context.account?.equity, "account-equity");
  if (equity <= 0) throw new RangeError("positive-account-equity-required");
  const notionals = Object.fromEntries(context.positions.map((position) => [required(position.symbol, "position-symbol").toUpperCase(), Math.max(0, finite(position.market_value, "position-market-value"))]));
  return { equity, notionals, weights: Object.fromEntries(Object.entries(notionals).map(([symbol, value]) => [symbol, value / equity])) };
}

function admitProposal(strategy, proposal, rules, context) {
  if (!proposal || ["hold", "no-order", "abstain"].includes(proposal.disposition)) return { admitted: false, strategy: strategy.id, disposition: proposal?.disposition ?? "abstain" };
  const candidate = Object.freeze({
    ...proposal,
    strategy: strategy.id,
    symbol: required(proposal.symbol, `${strategy.id}-symbol`).toUpperCase(),
    score: finite(proposal.score, `${strategy.id}-score`),
    uncertainty: Math.max(0, finite(proposal.uncertainty ?? 0, `${strategy.id}-uncertainty`)),
    confidence: Math.max(0, Math.min(1, finite(proposal.confidence ?? 1, `${strategy.id}-confidence`))),
    thesis: required(proposal.thesis, `${strategy.id}-thesis`),
    falsifier: required(proposal.falsifier, `${strategy.id}-falsifier`),
  });
  for (const rule of rules) {
    const result = rule({ proposal: candidate, context });
    if (result === false || result?.admitted === false) return { admitted: false, strategy: strategy.id, disposition: "rule-rejected", rule: rule.id ?? rule.name ?? "anonymous-rule", reason: result?.reason ?? null };
  }
  return { admitted: true, proposal: candidate };
}

function aggregate(proposals) {
  const bySymbol = new Map();
  for (const proposal of proposals) {
    const current = bySymbol.get(proposal.symbol) ?? { score: 0, uncertainty: 0, strategies: [], evidencePackets: [], theses: [], falsifiers: [] };
    current.score += proposal.score * proposal.confidence;
    current.uncertainty += proposal.uncertainty + (1 - proposal.confidence);
    current.strategies.push(proposal.strategy);
    current.evidencePackets.push(...(proposal.evidencePackets ?? []));
    current.theses.push(proposal.thesis);
    current.falsifiers.push(proposal.falsifier);
    bySymbol.set(proposal.symbol, current);
  }
  return bySymbol;
}

export function createStrategyEngine({ strategies, rules = [], mandate, minimumOrderNotional = 1, allocation = allocateMandatePortfolio } = {}) {
  if (!Array.isArray(strategies) || strategies.length === 0) throw new TypeError("nonempty-strategy-set-required");
  if (!Array.isArray(rules) || rules.some((rule) => typeof rule !== "function")) throw new TypeError("rules-must-be-functions");
  if (typeof allocation !== "function") throw new TypeError("portfolio-allocation-provider-required");
  const admittedStrategies = strategies.map(validateStrategy);
  const minimum = finite(minimumOrderNotional, "minimum-order-notional");

  return async function evaluateStrategySet(context) {
    const portfolio = currentPortfolio(context);
    const readings = await Promise.all(admittedStrategies.map(async (strategy) => ({ strategy, proposal: await strategy.evaluate(context) })));
    const admissions = readings.map(({ strategy, proposal }) => admitProposal(strategy, proposal, rules, context));
    const proposals = admissions.filter(({ admitted }) => admitted).map(({ proposal }) => proposal);
    if (proposals.length === 0) return Object.freeze({ disposition: "hold", reason: "no-admitted-strategy-proposals", admissions });
    const combined = aggregate(proposals);
    const scores = Object.fromEntries([...combined].map(([symbol, value]) => [symbol, value.score]));
    const uncertainty = Object.fromEntries([...combined].map(([symbol, value]) => [symbol, value.uncertainty]));
    const target = allocation({ scores, uncertainty, currentWeights: portfolio.weights, mandate });
    const orders = [];
    for (const [symbol, targetWeight] of Object.entries(target.weights)) {
      const targetNotional = targetWeight * portfolio.equity;
      const currentNotional = portfolio.notionals[symbol] ?? 0;
      const difference = targetNotional - currentNotional;
      if (Math.abs(difference) < minimum) continue;
      const sources = combined.get(symbol);
      const notional = Math.min(Math.abs(difference), context.envelope.maximumOrderNotional);
      orders.push(Object.freeze({
        symbol,
        side: difference > 0 ? "buy" : "sell",
        notional,
        maximumLoss: Math.min(notional, Number(context.envelope.maximumOrderNotional)),
        strategy: sources.strategies.join("+"),
        thesis: sources.theses.join(" | "),
        falsifier: sources.falsifiers.join(" | "),
        evidencePackets: sources.evidencePackets,
        liquidityPremise: "the order remains within the configured notional and symbol envelope",
        executionPremise: "the selected Alpaca venue reconciles the order by client order id",
        scenarios: [{ name: "bounded-loss", pnl: -Math.min(notional, Number(context.envelope.maximumOrderNotional)) }, { name: "flat", pnl: 0 }, { name: "upside", pnl: notional }],
      }));
    }
    orders.sort((left, right) => (left.side === right.side ? right.notional - left.notional : left.side === "sell" ? -1 : 1));
    if (orders.length === 0) return Object.freeze({ disposition: "hold", reason: "portfolio-within-rebalance-band", target, admissions });
    return Object.freeze({ disposition: "portfolio", target, orders: Object.freeze(orders), admissions: Object.freeze(admissions) });
  };
}
