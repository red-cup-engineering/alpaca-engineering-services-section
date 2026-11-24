export function measureCausalPatchNovelty({ tokens, patchSize = 5 } = {}) {
  if (!Array.isArray(tokens) || !Number.isInteger(patchSize) || patchSize < 1 || tokens.length < patchSize * 2) {
    throw new TypeError("finite-causal-patch-input-invalid");
  }
  for (let index = 0; index < tokens.length; index += 1) {
    if (typeof tokens[index] !== "string") throw new TypeError("finite-causal-patch-input-invalid");
  }
  const current = tokens.slice(-patchSize);
  const eligiblePriorPatches = tokens.length - 2 * patchSize + 1;
  let recurrenceCount = 0;
  for (let start = 0; start < eligiblePriorPatches; start += 1) {
    if (current.every((token, index) => token === tokens[start + index])) recurrenceCount += 1;
  }
  return Object.freeze({
    type: "CausalPatchNoveltyMeasurement",
    version: 1,
    patchSize,
    eligiblePriorPatches,
    recurrenceCount,
    empiricalFrequency: recurrenceCount / eligiblePriorPatches,
    novelty: 1 / (1 + recurrenceCount),
    infiniteTilingEquivalenceEstablished: false,
    effect: "measurement-only",
  });
}
