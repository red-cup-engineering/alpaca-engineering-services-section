/** Free exact arithmetic via SignGraph, packaged as a replayable computation.
 * The existing x402 seller handles all pricing, payment and receipt custody.
 */
import { cellularSheaf, cellularSheafCohomology } from "@red-cup-engineering/signgraph/cellular-sheaf";
import { admitExactGraphSheafRequest } from "./exact-graph-admission.mjs";
export { admitExactGraphSheafRequest, EXACT_GRAPH_LIMITS } from "./exact-graph-admission.mjs";

export function computeExactGraphSheafCohomology(body) {
  // Admission is pure and must also be used by the merchant BEFORE a 402 challenge.
  const input = admitExactGraphSheafRequest(body);
  const source = cellularSheaf(input);
  if (source.exact !== true) throw new Error("exact-graph-sheaf-not-exact");
  const { h0, h1, rank, c0, c1 } = cellularSheafCohomology(source);
  if (![h0, h1, rank, c0, c1].every(Number.isSafeInteger) ||
      rank < 0 || rank > Math.min(c0, c1) || h0 !== c0 - rank ||
      h1 !== c1 - rank || h0 - h1 !== c0 - c1)
    throw new Error("exact-graph-cohomology-rank-identity-failed");
  return Object.freeze({
    kind: "red-cup.exact-graph-sheaf-cohomology/v1",
    field: "Q",
    input, // Immutable exact-rational input is included for independent replay.
    result: Object.freeze({ h0, h1, rankDelta0: rank, c0, c1,
      eulerCharacteristic: c0 - c1 }),
    verification: Object.freeze({
      method: "exact-rational-rank-and-rank-nullity",
      producer: "@red-cup-engineering/signgraph/cellular-sheaf",
      rankNullityChecked: true, eulerPoincareChecked: true,
      scope: "Finite linear cellular sheaf on a graph with user-supplied stalks and restriction maps",
      theoremNoveltyEstablished: false,
      formalProofOfSourceComplex: false,
      empiricalValidityEstablished: false,
      settlementEstablished: false,
    }),
  });
}
