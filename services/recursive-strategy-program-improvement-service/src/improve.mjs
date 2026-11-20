const NI = /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/u;
function validateRequest(request) {
  if (!NI.test(request?.incumbent?.id) || !NI.test(request?.contextProduct) || !NI.test(request?.acceptanceSuite) || !NI.test(request?.originalWork)) throw new TypeError("immutable-evolution-inputs-required");
  if (!Number.isInteger(request.maximumGenerations) || request.maximumGenerations < 1 || request.maximumGenerations > 100 || !Number.isInteger(request.populationSize) || request.populationSize < 1 || request.populationSize > 16) throw new TypeError("bounded-evolution-mandate-required");
  if (!Array.isArray(request.evidenceFacts) || !Array.isArray(request.allowedFeatureDependencies) || !Array.isArray(request.failureHistory)) throw new TypeError("typed-evolution-context-required");
}
function validateTournament(result, evaluations) {
  if (!result || result.type !== "GeneratedStrategyTournamentResult" || typeof result.improvementEstablished !== "boolean") throw new TypeError("generated-strategy-tournament-result-required");
  if (result.improvementEstablished && (!Number.isInteger(result.winnerIndex) || !evaluations.some(({ index }) => index === result.winnerIndex))) throw new TypeError("tournament-winner-binding-invalid");
}

// Research-method selection consumes the *existing* Organizing Work reading.
// Its trusted host obtains this array from Organizing.standingOutcomes over
// authenticated original custody. A caller-supplied historical outcome, a
// paper review, or a provider's claimed score is not a source-qualified read.
// This pure consumer cannot authenticate the host, Work rights or Science.
function originalWorkReceiving(standing, request, winner, incumbent, usedOutcomes, usedLots) {
  if (!Array.isArray(standing) || standing.length > 10_000) throw new TypeError("original-work-standing-read-required");
  const matches = standing.filter(row => row && row.kind === "organizing.enterprise.outcome"
    && row.source === "work-discharge"
    && Array.isArray(row.evidence) && row.evidence.includes(request.originalWork)
    && row.evidence.includes(winner.assay.source)
    && row.evidence.includes(incumbent.id)
    && row.evidence.includes(request.acceptanceSuite));
  if (matches.length !== 1) return { refusal: matches.length ? "contested-original-work" : "original-work-not-received" };
  const work = matches[0];
  if (work.version !== 1 || work.verdict !== "accepted" || !NI.test(work.id)
      || typeof work.lot !== "string" || !work.lot
      || typeof work.delivery !== "string" || !work.delivery
      || typeof work.provider !== "string" || !work.provider
      || typeof work.judge !== "string" || !work.judge
      || work.judge === work.provider || work.judge === winner.authorActor
      || !NI.test(work.receivingReceipt) || !NI.test(work.receivingAuthorizationReceipt)
      || work.reportedResult?.kind !== "skill-result") {
    return { refusal: "unqualified-original-work" };
  }
  if (usedOutcomes.has(work.id) || usedLots.has(work.lot)) return { refusal: "original-work-already-credited" };
  usedOutcomes.add(work.id); usedLots.add(work.lot);
  return { received: Object.freeze({
    outcome: work.id, lot: work.lot, delivery: work.delivery,
    judge: work.judge, receiver: work.receivingAuthorizationReceipt,
    originalWork: request.originalWork,
  }) };
}

export function createRecursiveStrategyProgramImprovement(providers) {
  const required = ["synthesizePopulation", "assayProgram", "replayProgram", "evaluateProgram", "selectTournamentWinner", "reviewProgram", "recordGeneration", "promotePaperProgram", "readStandingOutcomes"];
  if (required.some((key) => typeof providers?.[key] !== "function")) throw new TypeError("explicit-evolution-providers-required");
  return async function improve(request) {
    validateRequest(request);
    const started = Date.now(), maximumWallClockMs = request.maximumWallClockMs ?? 3_600_000;
    if (!Number.isInteger(maximumWallClockMs) || maximumWallClockMs < 1_000 || maximumWallClockMs > 86_400_000) throw new TypeError("evolution-wall-clock-bound-invalid");
    let incumbent = Object.freeze({ ...request.incumbent }), failureHistory = [...request.failureHistory];
    const generations = [], usedWorkOutcomes = new Set(), usedWorkLots = new Set(), receivedWork = [];
    for (let generation = 0; generation < request.maximumGenerations; generation += 1) {
      if (Date.now() - started >= maximumWallClockMs) break;
      const population = await providers.synthesizePopulation({
        customerActor: request.customerActor,
        contextProduct: request.contextProduct,
        incumbentProgram: incumbent.id,
        acceptanceSuite: request.acceptanceSuite,
        abi: "export function decide(input) -> plain JSON target scores or weights",
        populationSize: request.populationSize,
        maxTokensPerCandidate: request.maxTokensPerCandidate,
        routingProfile: request.routingProfile,
        difficulty: request.difficulty,
        maximumWallClockMs: Math.min(request.maximumSynthesisWallClockMs ?? 180_000, Math.max(1_000, maximumWallClockMs - (Date.now() - started))),
        evidenceFacts: request.evidenceFacts,
        allowedFeatureDependencies: request.allowedFeatureDependencies,
        failureHistory,
        generation
      });
      const evaluations = [], residues = [...(population.residues ?? [])];
      for (const authored of population.candidates ?? []) {
        try {
          const assay = await providers.assayProgram({ source: authored.candidate.strategySource, authorActor: authored.provider });
          if (!assay?.admitted) { residues.push({ index: authored.index, disposition: "static-assay-refusal", assay }); continue; }
          const replay = await providers.replayProgram({ source: authored.candidate.strategySource, staticAssay: assay, input: request.replayProbe, maximumWallClockMs: request.maximumReplayWallClockMs ?? 5_000 });
          if (replay?.type !== "DeterministicStrategyProgramReplay") { residues.push({ index: authored.index, disposition: "sandbox-replay-refusal", replay }); continue; }
          const evaluation = await providers.evaluateProgram({
            generation, authored, assay, replay, contextProduct: request.contextProduct,
            acceptanceSuite: request.acceptanceSuite, incumbent
          });
          evaluations.push(Object.freeze({ index: authored.index, authorActor: authored.provider, authored, assay, replay, evaluation }));
        } catch (error) {
          residues.push(Object.freeze({ index: authored.index, disposition: "candidate-evaluation-refusal", reason: error.message }));
        }
      }
      const tournament = await providers.selectTournamentWinner({ generation, incumbent, evaluations, contextProduct: request.contextProduct, acceptanceSuite: request.acceptanceSuite });
      validateTournament(tournament, evaluations);
      let successor = null, review = null;
      if (tournament.improvementEstablished) {
        const winner = evaluations.find(({ index }) => index === tournament.winnerIndex);
        review = await providers.reviewProgram({
          source: winner.authored.candidate.strategySource,
          candidate: winner.authored.candidate,
          authorActor: winner.authorActor,
          excludedProviders: [winner.authorActor],
          assay: winner.assay,
          replay: winner.replay,
          evaluation: winner.evaluation,
          tournament
        });
        if (review?.approved !== true || typeof review.reviewerActor !== "string"
            || !review.reviewerActor.trim() || review.reviewerActor === winner.authorActor) {
          residues.push(Object.freeze({ index: winner.index, disposition: "independent-review-refusal" }));
        } else {
          // A tournament and peer review are proposal evidence. Only the
          // original Work source's *current standing* can advance the lineage.
          // Do not build a second outcome ledger or infer Work discharge from
          // mere approval of a producer's result.
          let qualified;
          if (winner.assay.source === incumbent.id) {
            qualified = { refusal: "unchanged-strategy-cannot-improve-itself" };
          } else try {
            if (!NI.test(winner.assay.source)) throw new TypeError("unaddressed-strategy-source");
            const standing = await providers.readStandingOutcomes({
              originalWork: request.originalWork, candidateSource: winner.assay.source,
              incumbent: incumbent.id, contextProduct: request.contextProduct,
              acceptanceSuite: request.acceptanceSuite, generation
            });
            qualified = originalWorkReceiving(standing, request, winner, incumbent, usedWorkOutcomes, usedWorkLots);
          } catch (error) {
            qualified = { refusal: "original-work-source-refused", reason: String(error?.message ?? error) };
          }
          if (!qualified.received) {
            residues.push(Object.freeze({
              index: winner.index, disposition: qualified.refusal,
              ...(qualified.reason === undefined ? {} : { reason: qualified.reason })
            }));
          } else {
            receivedWork.push(qualified.received);
            successor = Object.freeze({
              id: winner.assay.source,
              source: winner.authored.candidate.strategySource,
              authorActor: winner.authorActor,
              parent: incumbent.id,
              generation,
              evaluation: winner.evaluation,
              tournament,
              review,
              originalWorkReceiving: qualified.received,
            });
          }
        }
      }
      const generationRecord = await providers.recordGeneration({
        type: "StrategyProgramEvolutionGeneration",
        generation, incumbent: incumbent.id, population, evaluations, tournament,
        successor: successor?.id ?? null, residues, orderEffect: false, liveEffect: false
      });
      generations.push(Object.freeze({ generation, incumbent: incumbent.id, successor: successor?.id ?? null, record: generationRecord, residues }));
      failureHistory = failureHistory.concat(residues.map(({ disposition, reason }) => `${disposition}:${reason ?? "recorded"}`)).slice(-128);
      if (successor) incumbent = successor;
    }
    // No received replacement means no new paper promotion. Merely running
    // the generator must not republish the starting program as an advance.
    const changed = receivedWork.length > 0;
    const promotion = changed ? await providers.promotePaperProgram({
      candidate: incumbent,
      originalIncumbent: request.incumbent.id,
      generations,
      contextProduct: request.contextProduct,
      acceptanceSuite: request.acceptanceSuite,
      originalWork: request.originalWork,
      receivedWork: Object.freeze([...receivedWork]),
      liveReadinessEstablished: false
    }) : null;
    if (changed && (promotion?.paperPromotionEstablished !== true ||
      promotion.liveReadinessEstablished !== false || promotion.candidate !== incumbent.id))
      throw new TypeError("paper-promotion-certificate-invalid");
    return Object.freeze({
      type: "RecursiveStrategyProgramImprovementResult",
      version: 1,
      originalIncumbent: request.incumbent.id,
      lineageHead: incumbent.id,
      generations: Object.freeze(generations),
      promotion,
      receivedWork: Object.freeze([...receivedWork]),
      scientificImprovementEstablished: null,
      orderExecutionEstablished: false,
      liveReadinessEstablished: false,
      effect: "paper-strategy-program-lineage-only"
    });
  };
}
