export const ALPACA_APP_PRODUCT = Object.freeze({
  type: "AlpacaAppProductDefinition",
  version: 1,
  name: "Alpaca App",
  owner: "alpaca-engineering-services-section",
  customer: "Esther Davis",
  purpose: "Use the 561 Group's research and the customer's beliefs to manage a bounded portfolio through Alpaca, with the same strategy and execution engine available for simulation, paper trading, and authorized live capital.",
  operatingPrinciples: Object.freeze([
    "Paper trading is a mode, not the product and not a permanent gate against authorized live participation.",
    "A customer's beliefs are first-class strategy inputs that can add edge; they are not dismissed as noise and they do not bypass evidence or risk rules.",
    "Strategies compete and cooperate in an explicit strategy space; no ticker-specific strategy is the application architecture.",
    "Research, signals, portfolio construction, risk, execution, reconciliation, and operator control are one product loop.",
    "The family app composes reusable sibling services instead of replacing them with standalone code.",
  ]),
  capabilities: Object.freeze([
    { id: "family-composition-root", state: "working", evidence: "apps/alpaca-app and src/alpaca-app.mjs" },
    { id: "paper-and-bounded-live-execution", state: "working-not-activated", evidence: "one execution path selects the venue from explicit configuration" },
    { id: "multi-strategy-rule-engine", state: "working", evidence: "src/strategy-engine.mjs" },
    { id: "multi-asset-portfolio-rebalance", state: "working", evidence: "strategy engine target allocation and AlpacaAppPortfolioOutcome" },
    { id: "customer-belief-input", state: "available-sibling-not-composed", evidence: "trading-belief-service" },
    { id: "signal-fusion", state: "available-sibling-not-composed", evidence: "signal-fusion-alpha-engine-service" },
    { id: "causal-and-topological-measurement", state: "available-siblings-not-composed", evidence: "causal, correlation, sheaf, and tiling measurement services" },
    { id: "walk-forward-and-execution-aware-backtest", state: "available-siblings-not-composed", evidence: "purged folds, transaction-cost replay, and event-driven simulation services" },
    { id: "strategy-tournament-and-promotion", state: "available-siblings-not-composed", evidence: "model tournament and strategy evaluation services" },
    { id: "streaming-market-data", state: "missing" },
    { id: "continuous-scheduler", state: "missing" },
    { id: "operator-web-interface", state: "missing" },
    { id: "notifications-and-alert-response", state: "available-sibling-not-composed", evidence: "alpaca-alert-watch-service" },
    { id: "stock-lending-analysis-and-control", state: "missing" },
    { id: "deployed-live-customer-instance", state: "missing-authority-and-activation" },
    { id: "public-research-and-service-surface", state: "fragmented-not-an-app-surface" },
  ]),
});

export function describeAlpacaAppProduct() {
  return ALPACA_APP_PRODUCT;
}
