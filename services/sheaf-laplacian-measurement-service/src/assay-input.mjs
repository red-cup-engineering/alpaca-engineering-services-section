/** Public JSON boundary for finite cellular sheaf calculations. No arithmetic
 * silently recasts an inexact host float as a rational proof. */
const ID = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/u;
const RATIONAL = /^(?:0|-?[1-9][0-9]{0,63})(?:\/[1-9][0-9]{0,63})?$/u;
const MAX_VERTICES = 16;
const MAX_EDGES = 32;
const MAX_COORDINATES = 48;
function object(value, label, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(k => !keys.includes(k)))
    throw new TypeError(label + ": unexpected or non-object fields");
  return value;
}
function id(value, label) {
  if (typeof value !== "string" || !ID.test(value)) throw new TypeError(label + ": valid stable identifier required");
  return value;
}
function integer(value, label, max) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max)
    throw new RangeError(label + ": dimension is out of bounds");
  return value;
}
function rational(value, label) {
  if (typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0)) return value;
  if (typeof value !== "string" || !RATIONAL.test(value))
    throw new TypeError(label + ": exact integer or bounded rational string required");
  // Equivalent source fractions must not turn into different serialized math inputs.
  // The original SignGraph engine retains ownership of exact rank and cohomology;
  // this boundary only normalizes a bounded, already-admitted rational carrier.
  if (!value.includes("/")) return value;
  const [numerator, denominator] = value.split("/").map(BigInt);
  let a = numerator < 0n ? -numerator : numerator, b = denominator;
  while (b !== 0n) [a, b] = [b, a % b];
  const n = numerator / a, d = denominator / a;
  return d === 1n ? String(n) : String(n) + "/" + String(d);
}
function matrix(value, rows, cols, label) {
  if (!Array.isArray(value) || value.length !== rows || value.some(row => !Array.isArray(row) || row.length !== cols))
    throw new TypeError(label + ": expected " + rows + " by " + cols + " exact matrix");
  return value.map((row, i) => row.map((v, j) => rational(v, label + "[" + i + "," + j + "]")));
}
/** Pure prepayment admission. Restrict sizes before allocating matrix or running
 * rational elimination. This is a deliberately narrow 1-skeleton over Q. */
export function admitFiniteCellularSheaf(input) {
  object(input, "sheaf input", ["vertices", "edges", "observations", "state", "metrics"]);
  if (!Array.isArray(input.vertices) || input.vertices.length > MAX_VERTICES ||
      !Array.isArray(input.edges) || input.edges.length > MAX_EDGES)
    throw new RangeError("sheaf: bounded vertex and edge arrays required");
  const seenVertices = new Set();
  let c0 = 0, c1 = 0;
  const vertices = input.vertices.map((vertex) => {
    object(vertex, "vertex", ["id", "dim"]);
    const name = id(vertex.id, "vertex id");
    if (seenVertices.has(name)) throw new TypeError("sheaf: duplicate vertex");
    seenVertices.add(name);
    const dim = integer(vertex.dim, "vertex dim", 4);
    c0 += dim;
    if (c0 > MAX_COORDINATES) throw new RangeError("sheaf: C0 exceeds budget");
    return { id: name, dim };
  });
  const vertexDimensions = new Map(vertices.map(v => [v.id, v.dim]));
  const seenEdges = new Set();
  const edges = input.edges.map(edge => {
    object(edge, "edge", ["id", "from", "to", "dim", "restrict"]);
    const name = id(edge.id, "edge id");
    if (seenEdges.has(name)) throw new TypeError("sheaf: duplicate edge");
    seenEdges.add(name);
    const from = id(edge.from, "edge from"), to = id(edge.to, "edge to");
    if (!vertexDimensions.has(from) || !vertexDimensions.has(to))
      throw new TypeError("sheaf: edge names an unadmitted stalk");
    const dim = integer(edge.dim, "edge dim", 4);
    c1 += dim;
    if (c1 > MAX_COORDINATES) throw new RangeError("sheaf: C1 exceeds budget");
    object(edge.restrict, "restriction", ["from", "to"]);
    return { id: name, from, to, dim, restrict: {
      from: matrix(edge.restrict.from, dim, vertexDimensions.get(from), "restriction from"),
      to: matrix(edge.restrict.to, dim, vertexDimensions.get(to), "restriction to"),
    } };
  });
  const observations = input.observations ?? [];
  if (!Array.isArray(observations) || observations.length + c1 > MAX_COORDINATES)
    throw new RangeError("sheaf: observed equation budget exceeded");
  const obs = observations.map(entry => {
    object(entry, "observation", ["vertex", "coordinate", "value", "sourceRecord"]);
    const vertex = id(entry.vertex, "observation vertex");
    if (!vertexDimensions.has(vertex) || !Number.isSafeInteger(entry.coordinate) ||
        entry.coordinate < 0 || entry.coordinate >= vertexDimensions.get(vertex))
      throw new TypeError("sheaf: observation references an unknown stalk coordinate");
    if (typeof entry.sourceRecord !== "string" || entry.sourceRecord.length > 1024 || !entry.sourceRecord.trim())
      throw new TypeError("sheaf: observation requires an original source record");
    return { vertex, coordinate: entry.coordinate,
      value: rational(entry.value, "observation value"), sourceRecord: entry.sourceRecord };
  });
  const state = input.state;
  if (state !== undefined && (!Array.isArray(state) || state.length !== c0 ||
      state.some(v => typeof v !== "number" || !Number.isFinite(v) || Object.is(v, -0))))
    throw new TypeError("sheaf: state requires one finite numeric value per C0 coordinate");
  const metrics = input.metrics;
  if (metrics !== undefined && (!Array.isArray(metrics) || metrics.length !== edges.length))
    throw new TypeError("sheaf: one metric is required per edge");
  const checkedMetrics = metrics?.map((value, i) => {
    const dim = edges[i].dim;
    if (!Array.isArray(value) || value.length !== dim ||
        value.some(row => !Array.isArray(row) || row.length !== dim ||
          row.some(x => typeof x !== "number" || !Number.isFinite(x) || Object.is(x, -0))))
      throw new TypeError("sheaf: finite numeric metric of exact edge stalk dimension required");
    return value.map(row => [...row]);
  });
  return { vertices, edges, observations: obs,
    ...(state === undefined ? {} : { state: [...state] }),
    ...(checkedMetrics === undefined ? {} : { metrics: checkedMetrics }),
    bounds: { vertices: MAX_VERTICES, edges: MAX_EDGES, coordinates: MAX_COORDINATES },
    coordinates: { c0, c1 } };
}
