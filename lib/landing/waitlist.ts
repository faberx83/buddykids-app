// TRAMA — PAGINA DI BENVENUTO E LISTA D'ATTESA (20/10/2026).
// Controlli puri (niente rete) sul modulo "Chiedi un invito" di
// tramapp.it/benvenuto: usati dalla server action e dai test.

import { checkEmail } from "@/lib/auth/email-check";

export interface WaitlistInput {
  email: string;
  comune?: string | null;
  kidsCount?: string | number | null;
  note?: string | null;
  source?: string | null;
  consent?: boolean | null;
  /** Campo nascosto: se compilato è un programma automatico, non una persona. */
  website?: string | null;
}

export interface WaitlistRow {
  email: string;
  comune: string | null;
  kids_count: number | null;
  note: string | null;
  source: string | null;
  contact_consent: true;
}

export type WaitlistCheck =
  | { ok: true; row: WaitlistRow }
  | { ok: false; field: "email" | "consent" | "bot"; message: string; suggestion?: string };

function clean(value: string | null | undefined, max: number): string | null {
  const v = (value ?? "").replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
}

/** Da dove arriva la visita (?da=whatsapp, ?utm_source=…): solo lettere, numeri, - e _. */
export function cleanSource(raw: string | null | undefined): string | null {
  const v = (raw ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return v || null;
}

export function checkWaitlist(input: WaitlistInput): WaitlistCheck {
  if ((input.website ?? "").trim()) return { ok: false, field: "bot", message: "Richiesta non valida." };
  const email = checkEmail(input.email ?? "");
  if (!email.ok) return { ok: false, field: "email", message: email.message, suggestion: email.suggestion };
  if (!input.consent) {
    return { ok: false, field: "consent", message: "Per mandarti l'invito ci serve il tuo permesso di scriverti." };
  }
  const kidsRaw = typeof input.kidsCount === "number" ? input.kidsCount : parseInt(String(input.kidsCount ?? ""), 10);
  const kids = Number.isFinite(kidsRaw) && kidsRaw >= 1 && kidsRaw <= 9 ? kidsRaw : null;
  return {
    ok: true,
    row: {
      email: email.email,
      comune: clean(input.comune, 80),
      kids_count: kids,
      note: clean(input.note, 500),
      source: cleanSource(input.source),
      contact_consent: true,
    },
  };
}
