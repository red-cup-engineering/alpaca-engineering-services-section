export async function strategy() {
  return { disposition: "order", strategy: "fake-blk", symbol: "BLK", side: "buy", notional: 10, maximumLoss: 3,
    thesis: "exercise the complete bounded order loop", falsifier: "the fake venue refuses", liquidityPremise: "fake liquidity is available", executionPremise: "fake market orders fill",
    scenarios: [{ name: "loss", pnl: -3 }, { name: "gain", pnl: 4 }] };
}
