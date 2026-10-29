/**
 * CLI: `node fuse-signals-to-belief.mjs <input.json>`. Reads a
 * `{signals, belief}` input, fuses the signals (independence-weighted,
 * bilattice) into the stated belief's evidence base, and prints both the
 * fusion result and a created (falsifier-required) belief record.
 */

import { readFileSync } from "node:fs";
import { fuseBeliefWithEvidence } from "@red-cup-engineering/trading-belief-service/evidence-fusion";
import { createBeliefRecord } from "@red-cup-engineering/trading-belief-service/belief-record";
import { weightSignalsByIndependence } from "../src/independence-weighting.mjs";
import { signalsToBeliefObservations } from "../src/signal-to-belief-observations.mjs";

/**
 * Fuses raw Signal[] against a belief's stated direction and creates the
 * belief record carrying the fusion's support fraction as its confidence.
 * @param {object} input
 * @param {import("../src/signal.mjs").Signal[]} input.signals
 * @param {object} input.belief Belief record fields minus `confidence`, which is derived from fusion.
 * @returns {{fusion: object, belief: Readonly<object>}}
 */
export function fuseSignalsToBelief({ signals, belief }) {
  const weighted = weightSignalsByIndependence(signals);
  const observations = signalsToBeliefObservations(weighted, belief.direction);
  const fusion = fuseBeliefWithEvidence(observations);
  const record = createBeliefRecord({ ...belief, confidence: fusion.supportFraction, supportingObservations: observations.filter((o) => o.stance === "supports").map((o) => o.description), contraryObservations: observations.filter((o) => o.stance === "contradicts").map((o) => o.description) });
  return { fusion, belief: record };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , inputPath] = process.argv;
  const input = JSON.parse(readFileSync(inputPath, "utf8"));
  console.log(JSON.stringify(fuseSignalsToBelief(input), null, 2));
}
