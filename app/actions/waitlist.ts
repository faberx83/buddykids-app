"use server";

// TRAMA — "CHIEDI UN INVITO" (20/10/2026). La beta è solo su invito: chi
// arriva su tramapp.it/benvenuto lascia la sua email e Fabrizio la ritrova in
// Admin → Lista d'attesa (supabase/migration_44_beta_waitlist.sql).
// Scrive col client di servizio DOPO i controlli (nessuna politica di
// inserimento per i visitatori), mai dati oltre a quelli del modulo.
// Se WAITLIST_NOTIFY_EMAIL è impostata su Vercel, arriva anche un'email.

import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { checkWaitlist, type WaitlistInput } from "@/lib/landing/waitlist";

export type JoinWaitlistResult =
  | { ok: true; already: boolean }
  | { ok: false; message: string; suggestion?: string; field?: "email" | "consent" };

function isMissingTableError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "PGRST205" || err.code === "42P01" || /schema cache|does not exist/i.test(err.message ?? "");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function joinWaitlistAction(input: WaitlistInput): Promise<JoinWaitlistResult> {
  const check = checkWaitlist(input);
  if (!check.ok) {
    // Programma automatico: risposta identica a un invio riuscito, niente salvato.
    if (check.field === "bot") return { ok: true, already: false };
    return { ok: false, message: check.message, suggestion: check.suggestion, field: check.field };
  }
  const service = isSupabaseConfigured ? createServiceClient() : null;
  const unavailable = { ok: false as const, message: "Non riusciamo a salvare la richiesta in questo momento. Scrivici a privacy@tramapp.it." };
  if (!service) return unavailable;

  const { data, error } = await service
    .from("beta_waitlist")
    .upsert(check.row, { onConflict: "email", ignoreDuplicates: true })
    .select("id");
  if (error) {
    if (!isMissingTableError(error)) console.error("[waitlist] salvataggio non riuscito:", error.message);
    return unavailable;
  }
  const already = !data || data.length === 0;

  try {
    await service.from("product_events").insert({ event_name: "landing_waitlist_joined", detail: already ? "already" : (check.row.source ?? "diretto") });
  } catch {
    // osservabilità best-effort
  }

  const notifyTo = process.env.WAITLIST_NOTIFY_EMAIL;
  if (!already && notifyTo && isEmailConfigured) {
    const r = check.row;
    const lines = [
      `<b>Email:</b> ${escapeHtml(r.email)}`,
      r.comune ? `<b>Comune:</b> ${escapeHtml(r.comune)}` : null,
      r.kids_count ? `<b>Figli:</b> ${r.kids_count}` : null,
      r.note ? `<b>Messaggio:</b> ${escapeHtml(r.note)}` : null,
      r.source ? `<b>Arrivato da:</b> ${escapeHtml(r.source)}` : null,
    ].filter(Boolean);
    await sendEmail({
      to: notifyTo,
      subject: "TRAMA — nuova richiesta di invito",
      html: `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#172A4D"><p>Qualcuno vuole provare TRAMA:</p><p>${lines.join("<br>")}</p><p>La trovi in Admin → Lista d'attesa.</p></div>`,
    }).catch(() => undefined);
  }

  return { ok: true, already };
}
