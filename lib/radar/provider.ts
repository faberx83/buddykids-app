import "server-only";

// TRAMA — RADAR (12/10/2026). Scelta del provider di analisi.
//
// Oggi: simulazione (decisione di Fabrizio del 12/10). Per attivare l'AI
// reale basta UNA cosa: impostare ANTHROPIC_API_KEY su Vercel (Production)
// e rifare il deploy. Facoltativi: RADAR_AI_MODEL (modello con visione,
// default sotto) e RADAR_AI_PROVIDER=mock per forzare la simulazione anche
// con la chiave presente.

import { MockRadarProvider } from "@/lib/radar/providers/mock";
import { AnthropicRadarProvider } from "@/lib/radar/providers/anthropic";
import type { RadarProvider } from "@/lib/radar/types";

export const DEFAULT_RADAR_AI_MODEL = "claude-sonnet-4-5";

/**
 * 27/10/2026 (Fabrizio: "togliamo foto per ora"): senza l'AI vera la foto di
 * un volantino non si legge (la simulazione non vede il testo), quindi
 * "Foto o screenshot" si mostra solo quando c'è ANTHROPIC_API_KEY. Il giorno
 * in cui la chiave c'è, la foto torna da sola.
 */
export function isRadarPhotoAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.RADAR_AI_PROVIDER !== "mock";
}

export function getRadarProvider(): RadarProvider {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key && process.env.RADAR_AI_PROVIDER !== "mock") {
    return new AnthropicRadarProvider(key, process.env.RADAR_AI_MODEL || DEFAULT_RADAR_AI_MODEL);
  }
  return new MockRadarProvider();
}
