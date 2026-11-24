import { EMPTY_WITNESS_ROOT, admitJsonSemanticContent, identifyJsonSemanticContent } from "@red-cup-engineering/computer-code-engine/semiotic-expression-notation/semantic-content-identity";
export const OPERATION_KIND = "deterministic-report-graphic.operation";
export const RECORD_KIND = "deterministic-report-graphic.record";
export const identify = (value, objectKind) => identifyJsonSemanticContent({ objectKind, value, witnessRoot: EMPTY_WITNESS_ROOT });
export const admit = (bytes, objectKind) => admitJsonSemanticContent({ bytes, objectKind }).value;
