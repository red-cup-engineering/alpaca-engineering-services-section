import assert from "node:assert/strict";
import test from "node:test";
import { createStrategyEngine } from "../src/strategy-engine.mjs";
import { describeAlpacaAppProduct } from "../src/product.mjs";

const context = Object.freeze({
  account: { equity: "150", cash: "100" },
  positions: [{ symbol: "BLK", market_value: "50" }],
  envelope: { maximumOrderNotional: 20 },
});
const mandate = Object.freeze({ type: "PortfolioAllocationMandate", maximumWeight: 0.5, grossLimit: 0.8, leverageLimit: 1, shorting: false });
const proposal = (symbol, score, confidence = 1) => ({ symbol, score, confidence, uncertainty: 0.1, thesis: `${symbol} has measured edge`, falsifier: `${symbol} edge falls below zero`, evidencePackets: [{ id: `evidence:${symbol}`, type: "IssuerEvidencePacket" }] });

test("strategy engine combines independent proposals into a bounded multi-asset rebalance", async () => {
  const engine = createStrategyEngine({ mandate, strategies: [
    { id: "belief-led", evaluate: async () => proposal("SPY", 0.8, 0.7) },
    { id: "market-structure", evaluate: async () => proposal("QQQ", 0.5, 0.9) },
    { id: "existing-blk", evaluate: async () => proposal("BLK", 0.2, 0.6) },
  ] });
  const decision = await engine(context);
  assert.equal(decision.disposition, "portfolio");
  assert.ok(decision.orders.length >= 2);
  assert.ok(decision.orders.every((order) => order.notional <= 20));
  assert.deepEqual(new Set(decision.orders.map(({ symbol }) => symbol)), new Set(["BLK", "QQQ", "SPY"]));
});

test("rules can reject one strategy without collapsing the whole strategy space", async () => {
  const liquidityRule = Object.assign(({ proposal: candidate }) => candidate.symbol === "ILLIQ" ? { admitted: false, reason: "liquidity" } : true, { id: "minimum-liquidity" });
  const engine = createStrategyEngine({ mandate, rules: [liquidityRule], strategies: [
    { id: "bad", evaluate: async () => proposal("ILLIQ", 10) },
    { id: "good", evaluate: async () => proposal("SPY", 1) },
  ] });
  const decision = await engine(context);
  assert.equal(decision.disposition, "portfolio");
  assert.deepEqual(decision.orders.map(({ symbol }) => symbol), ["SPY"]);
  assert.equal(decision.admissions.find(({ strategy }) => strategy === "bad").disposition, "rule-rejected");
});

test("product definition keeps the customer and non-paper-only purpose beside the app", () => {
  const product = describeAlpacaAppProduct();
  assert.equal(product.customer, "Esther Davis");
  assert.match(product.purpose, /authorized live capital/u);
  assert.ok(product.operatingPrinciples.some((principle) => principle.startsWith("Paper trading is a mode")));
  assert.equal(product.capabilities.find(({ id }) => id === "multi-strategy-rule-engine").state, "working");
});
