import { createHmac, timingSafeEqual } from "crypto";

// TRAMA — Push check-in: azioni rapide, logica pura (11/09/2026). Estratta
// da lib/checkin/action-token.ts (che resta "server-only" e legge
// CHECKIN_ACTION_SECRET da process.env) per lo STESSO motivo già seguito da
// lib/feature-flags/evaluate.ts rispetto a resolve.ts in questo codebase:
// "server-only" impedisce a Playwright/ts-node di importare il modulo per un
// test unitario diretto (lancia sempre l'errore "This module cannot be
// imported from a Client Component module", indipendentemente dal contesto
// reale) — separare la firma/verifica pura (nessun accesso a process.env,
// il segreto è un parametro esplicito) dal wrapper server-only permette di
// testare l'algoritmo vero senza rinunciare alla barriera di sicurezza sul
// wrapper che legge davvero il segreto.

export interface CheckinActionTokenPayload {
  kidId: string;
  activityId: string;
  weekId: string | null;
  activityDayId: string | null;
  date: string;
  status: "presente" | "in_ritardo" | "assente";
  exp: number; // epoch seconds
}

export type VerifiedCheckinActionToken = CheckinActionTokenPayload | { error: string };

export function isCheckinActionTokenError(result: VerifiedCheckinActionToken): result is { error: string } {
  return "error" in result;
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function signCheckinActionToken(secret: string, payload: CheckinActionTokenPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verifica firma + scadenza dato ESPLICITAMENTE il segreto (mai letto da
 * process.env qui — quella responsabilità resta del wrapper server-only).
 * Confronto della firma timing-safe (stesso principio già usato per
 * CRON_SECRET in app/api/cron/checkin-reminders/route.ts).
 */
export function verifyCheckinActionTokenWithSecret(secret: string, token: string): VerifiedCheckinActionToken {
  const parts = token.split(".");
  if (parts.length !== 2) return { error: "Token malformato" };
  const [encodedPayload, signature] = parts;

  const expectedSignature = sign(encodedPayload, secret);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { error: "Firma non valida" };
  }

  let payload: CheckinActionTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));
  } catch {
    return { error: "Token illeggibile" };
  }

  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    return { error: "Token scaduto" };
  }

  return payload;
}
