import { cellularSheaf, cellularSheafCohomology, extendCellularSheafSection,
  sheafLaplacian, weightedSheafLaplacian, weightedSheafDirichlet,
  coboundary, apply } from "@red-cup-engineering/signgraph/cellular-sheaf";
import { admitFiniteCellularSheaf } from "./assay-input.mjs";

const SOURCE = "@red-cup-engineering/signgraph/cellular-sheaf";
function exactReceipt(input) {
  const admitted = admitFiniteCellularSheaf(input);
  const sheaf = cellularSheaf(admitted);
  // Exact rational rank and lifted/obstructed section are computed by the
  // original SignGraph owner. No independent or floating-point rank estimate.
  const cohomology = cellularSheafCohomology(sheaf);
  const extension = admitted.observations.length
    ? extendCellularSheafSection(sheaf, admitted.observations) : null;
  return { admitted, sheaf, receipt: {
    recordType: "561-group.finite-cellular-sheaf-assay.v1",
    mathematicalCarrier: "finite graph (1-dimensional CW complex), rational vector stalks",
    coefficientField: "Q", sourceOperation: SOURCE,
    qualification: "exact rational computation; independent machine-proof/kernel replay not established by this receipt",
    dimensions: { c0: sheaf.c0, c1: sheaf.c1, vertices: sheaf.vertices.length, edges: sheaf.edges.length },
    cohomology: { h0: cohomology.h0, h1: cohomology.h1, rankD0: cohomology.rank },
    extension,
    limits: admitted.bounds,
  } };
}
/** Finite 1-skeleton rational H0/H1 and optional source-indexed extension witness. */
export function assayFiniteCellularSheaf(input) {
  return exactReceipt(input).receipt;
}
/** Floating-point Laplacian, explicitly separated from exact rational H0/H1.
 * An SPD metric is admitted by the original SignGraph math engine. */
export function assayFiniteSheafLaplacian(input) {
  const { admitted, sheaf, receipt } = exactReceipt(input);
  const weighted = admitted.metrics !== undefined;
  const laplacian = weighted
    ? weightedSheafLaplacian(sheaf, admitted.metrics)
    : sheafLaplacian(sheaf);
  const numerical = {
    qualification: "IEEE-754 floating-point approximation, NOT an exact proof or certified spectrum",
    operator: weighted ? "delta-transpose W delta (SPD metrics)" : "delta-transpose delta",
    matrix: laplacian,
  };
  if (admitted.state !== undefined) {
    const delta = coboundary(sheaf), residual = apply(delta, admitted.state);
    const identityMetrics = sheaf.edges.map(edge =>
      Array.from({ length: edge.dim }, (_, i) =>
        Array.from({ length: edge.dim }, (_, j) => Number(i === j))));
    const energy = weightedSheafDirichlet(sheaf, admitted.metrics ?? identityMetrics, admitted.state);
    numerical.state = admitted.state;
    numerical.residual = residual;
    numerical.laplacianImage = apply(laplacian, admitted.state);
    numerical.dirichlet = energy;
  }
  return { ...receipt, recordType: "561-group.finite-sheaf-laplacian-assay.v1", numerical };
}
/** Fail closed before x402 verification, charge or supplier invocation. */
export { admitFiniteCellularSheaf } from "./assay-input.mjs";

/** Native x402 Autosell's ONE source-owned operation contract. Its package
 * declaration supplies only commerce terms; input/output come from here. */
const idSchema = { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_.:-]{0,63}$" };
const exactValue = { oneOf: [
  { type: "integer" }, { type: "string", pattern: "^(?:0|-?[1-9][0-9]{0,63})(?:/[1-9][0-9]{0,63})?$" },
] };
const rationalMatrix = { type: "array", items: { type: "array", items: exactValue } };
const inputSchema = {
  type: "object", additionalProperties: false, required: ["vertices", "edges"],
  properties: {
    vertices: { type: "array", maxItems: 16, items: { type: "object", additionalProperties: false,
      required: ["id", "dim"], properties: { id: idSchema, dim: { type: "integer", minimum: 1, maximum: 4 } } } },
    edges: { type: "array", maxItems: 32, items: { type: "object", additionalProperties: false,
      required: ["id", "from", "to", "dim", "restrict"], properties: {
        id: idSchema, from: idSchema, to: idSchema, dim: { type: "integer", minimum: 1, maximum: 4 },
        restrict: { type: "object", additionalProperties: false, required: ["from", "to"],
          properties: { from: rationalMatrix, to: rationalMatrix } },
      } } },
    observations: { type: "array", maxItems: 48, items: { type: "object", additionalProperties: false,
      required: ["vertex", "coordinate", "value", "sourceRecord"], properties: {
        vertex: idSchema, coordinate: { type: "integer", minimum: 0 }, value: exactValue,
        sourceRecord: { type: "string", minLength: 1, maxLength: 1024 },
      } } },
    state: { type: "array", maxItems: 48, items: { type: "number" } },
    metrics: { type: "array", maxItems: 32, items: { type: "array", items: { type: "array", items: { type: "number" } } } },
  },
};
const cohomologySchema = { type: "object", required: ["h0", "h1", "rankD0"],
  properties: { h0: { type: "integer", minimum: 0 }, h1: { type: "integer", minimum: 0 }, rankD0: { type: "integer", minimum: 0 } } };
const exactOutputSchema = { type: "object", required: ["recordType", "cohomology", "qualification", "dimensions", "coefficientField"],
  properties: { recordType: { const: "561-group.finite-cellular-sheaf-assay.v1" }, cohomology: cohomologySchema,
    qualification: { type: "string" }, coefficientField: { const: "Q" }, dimensions: { type: "object" } } };
const laplacianOutputSchema = { type: "object", required: ["recordType", "cohomology", "qualification", "numerical"],
  properties: { recordType: { const: "561-group.finite-sheaf-laplacian-assay.v1" }, cohomology: cohomologySchema,
    qualification: { type: "string" }, numerical: { type: "object", required: ["qualification", "operator", "matrix"],
      properties: { qualification: { type: "string" }, operator: { type: "string" }, matrix: { type: "object" } } } } };
export const catalog = Object.freeze({ operations: Object.freeze({
  "finite-sheaf-cohomology": Object.freeze({ name: "finite-sheaf-cohomology",
    description: "Exact rational H0/H1 and source-indexed extension/obstruction for a bounded finite one-dimensional cellular sheaf. Not kernel-certified Lean proof.",
    inputSchema, outputSchema: exactOutputSchema, operation: assayFiniteCellularSheaf }),
  "finite-sheaf-laplacian": Object.freeze({ name: "finite-sheaf-laplacian",
    description: "IEEE-754 sheaf Laplacian and optional Dirichlet energy with separately exact rational H0/H1. Numerical results are not proof certificates.",
    inputSchema, outputSchema: laplacianOutputSchema, operation: assayFiniteSheafLaplacian }),
}) });
