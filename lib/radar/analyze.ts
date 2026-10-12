// TRAMA — RADAR (12/10/2026). Orchestrazione: analyzeDiscoveryImport().
//
// INPUT → ANALISI (provider) → VALIDAZIONE → MATCHING → esito per la UI.
// Non scrive nulla: la persistenza avviene dopo la revisione dell'utente
// (app/actions/radar.ts). Le dipendenze (provider, candidati, match esatti
// per hash/URL) sono iniettate, così il flusso è testabile senza rete né DB.

import { findCandidateMatches, type MatchCandidate } from "@/lib/radar/match";
import { validateRawAnalysis } from "@/lib/radar/validate";
import type { CandidateMatch, RadarAnalysis, RadarInput, RadarNextStep, RadarProvider } from "@/lib/radar/types";

export interface AnalyzeDeps {
  provider: RadarProvider;
  /** Candidati Partner, Curated e Community da confrontare. */
  loadCandidates: () => Promise<MatchCandidate[]>;
  /** Contenuto già collegato a questa stessa immagine o a questo stesso link (doppione esatto). */
  findExactSource?: () => Promise<CandidateMatch | null>;
}

export function decideNextStep(relevance: RadarAnalysis["relevance"], matches: CandidateMatch[]): RadarNextStep {
  if (relevance === "not_relevant") return "reject";
  if (relevance === "uncertain") return "ask_confirmation";
  if (matches.length > 0 && matches[0].strong) return "open_existing";
  if (matches.length > 0) return "choose_match";
  return "review_and_save";
}

export async function analyzeDiscoveryImport(input: RadarInput, deps: AnalyzeDeps): Promise<RadarAnalysis> {
  // Doppione esatto (stessa foto o stesso link già trasformati in una
  // scoperta): nessuna nuova analisi AI, si apre direttamente quella.
  const exact = deps.findExactSource ? await deps.findExactSource() : null;

  const raw = await deps.provider.analyze(input);
  const validated = validateRawAnalysis(raw, input);

  if (exact && validated.relevance !== "not_relevant") {
    return {
      ...validated,
      relevance: "relevant",
      candidateMatches: [exact],
      nextStep: "open_existing",
      analyzer: deps.provider.name,
    };
  }

  let candidateMatches: CandidateMatch[] = [];
  if (validated.relevance !== "not_relevant") {
    candidateMatches = findCandidateMatches(validated.extracted, await deps.loadCandidates());
  }

  return {
    ...validated,
    candidateMatches,
    nextStep: decideNextStep(validated.relevance, candidateMatches),
    analyzer: deps.provider.name,
  };
}
