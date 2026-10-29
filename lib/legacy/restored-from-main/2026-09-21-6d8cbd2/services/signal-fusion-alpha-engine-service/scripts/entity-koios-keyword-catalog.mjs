/**
 * Per-entity keyword catalog widening adapt-koios-news-signal.mjs's
 * coverage from the founding pass's single "bitcoin/crypto" pair to the
 * full asset roster, across macro/finance/tech/collapse-finance beats
 * already present in koios's store (the founding pass's 18-of-1195 match
 * count was a narrow-keyword artifact, not a store-coverage limit).
 */

/** @type {Record<string, string[]>} Case-insensitive substrings identifying each entity in koios claim text. */
export const ENTITY_KOIOS_KEYWORDS = Object.freeze({
  BTC: ["bitcoin", "btc", "crypto", "cryptocurrency", "satoshi"],
  ETH: ["ethereum", "eth ", "ether ", "vitalik", "crypto", "cryptocurrency"],
  SOL: ["solana", "sol ", "crypto", "cryptocurrency"],
  XRP: ["ripple", "xrp", "crypto", "cryptocurrency"],
  ADA: ["cardano", "ada ", "crypto", "cryptocurrency"],
  DOGE: ["dogecoin", "doge", "crypto", "cryptocurrency"],
  SPY: ["s&p 500", "s&p500", "stock market", "wall street", "dow jones", "nasdaq", "federal reserve", "interest rate", "inflation", "recession"],
  QQQ: ["nasdaq", "tech stocks", "big tech", "stock market", "federal reserve", "interest rate"],
  AAPL: ["apple inc", "apple's", "iphone", "tim cook"],
  MSFT: ["microsoft", "satya nadella", "azure"],
});
