/** Bounded, payment-free admission of exact rational graph-sheaf calculations.
 * No x402 authorization, payee, price or settlement state belongs here.
 */
export const EXACT_GRAPH_LIMITS = Object.freeze({
  maxRequestBytes: 32768, maxVertices: 24, maxEdges: 48,
  maxStalkDimension: 4, maxCochainDimension: 48, maxMatrixEntries: 384,
  maxRationalDigits: 12,
});

const record = value => value !== null && typeof value === "object" && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const keysAre = (value, allowed) => record(value) && Object.keys(value).every(key => allowed.includes(key));
const label = value => typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/.test(value);
const dimension = value => Number.isSafeInteger(value) && value >= 1 && value <= EXACT_GRAPH_LIMITS.maxStalkDimension;
const gcd = (a, b) => { while (b !== 0n) [a, b] = [b, a % b]; return a; };

/** Normalize integer and rational JSON values without binary64 conversion. */
export function exactRational(value) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new TypeError("exact-rational-required");
    return String(value);
  }
  if (typeof value !== "string" || value.length > EXACT_GRAPH_LIMITS.maxRationalDigits * 2 + 2 ||
      !/^(?:0|-?[1-9][0-9]*)(?:\/[1-9][0-9]*)?$/.test(value))
    throw new TypeError("exact-rational-required");
  const [numerator, denominator = "1"] = value.split("/");
  if (numerator.replace(/^-/, "").length > EXACT_GRAPH_LIMITS.maxRationalDigits ||
      denominator.length > EXACT_GRAPH_LIMITS.maxRationalDigits)
    throw new RangeError("rational-digit-limit");
  const n = BigInt(numerator), d = BigInt(denominator);
  const common = gcd(n < 0n ? -n : n, d);
  const a = n / common, b = d / common;
  return b === 1n ? String(a) : a + "/" + b;
}

export function admitExactGraphSheafRequest(body) {
  if (!keysAre(body, ["vertices", "edges"]) || !Array.isArray(body.vertices) || !Array.isArray(body.edges))
    throw new TypeError("exact-graph-sheaf-request-required");
  if (JSON.stringify(body).length > EXACT_GRAPH_LIMITS.maxRequestBytes)
    throw new RangeError("exact-graph-request-byte-limit");
  if (body.vertices.length < 1 || body.vertices.length > EXACT_GRAPH_LIMITS.maxVertices ||
      body.edges.length > EXACT_GRAPH_LIMITS.maxEdges)
    throw new RangeError("exact-graph-cell-limit");
  const seenVertices = new Set(), seenEdges = new Set();
  let c0 = 0, c1 = 0, entries = 0;
  const vertices = body.vertices.map(vertex => {
    if (!keysAre(vertex, ["id", "dim"]) || !label(vertex.id) || !dimension(vertex.dim) || seenVertices.has(vertex.id))
      throw new TypeError("exact-graph-vertex-invalid-or-duplicate");
    seenVertices.add(vertex.id); c0 += vertex.dim;
    return Object.freeze({ id: vertex.id, dim: vertex.dim });
  });
  const verticesById = new Map(vertices.map(vertex => [vertex.id, vertex]));
  const edges = body.edges.map(edge => {
    if (!keysAre(edge, ["id", "from", "to", "dim", "restrict"]) || !label(edge.id) ||
        seenEdges.has(edge.id) || !verticesById.has(edge.from) || !verticesById.has(edge.to) ||
        !dimension(edge.dim) || !keysAre(edge.restrict, ["from", "to"]))
      throw new TypeError("exact-graph-edge-invalid-or-duplicate");
    seenEdges.add(edge.id); c1 += edge.dim;
    const normalized = {};
    for (const side of ["from", "to"]) {
      const expectedColumns = verticesById.get(edge[side]).dim;
      const matrix = edge.restrict[side];
      if (!Array.isArray(matrix) || matrix.length !== edge.dim ||
          !matrix.every(row => Array.isArray(row) && row.length === expectedColumns))
        throw new TypeError("exact-graph-restriction-shape-invalid");
      entries += edge.dim * expectedColumns;
      normalized[side] = Object.freeze(matrix.map(row => Object.freeze(row.map(exactRational))));
    }
    return Object.freeze({ id: edge.id, from: edge.from, to: edge.to,
      dim: edge.dim, restrict: Object.freeze(normalized) });
  });
  if (c0 > EXACT_GRAPH_LIMITS.maxCochainDimension || c1 > EXACT_GRAPH_LIMITS.maxCochainDimension ||
      entries > EXACT_GRAPH_LIMITS.maxMatrixEntries)
    throw new RangeError("exact-graph-rank-budget-exceeded");
  return Object.freeze({ vertices: Object.freeze(vertices), edges: Object.freeze(edges) });
}
