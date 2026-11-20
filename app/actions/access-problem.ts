"use server";

// TRAMA — LOTTO P0 BETA READINESS (16/11/2026): "Problemi ad accedere?"
// dalla pagina di accesso, senza account. Vedi lib/nextgen/access-problem.ts
// per i controlli e il perché. Scrive in beta_feedback col client di
// servizio DOPO i controlli (nessuna politica di inserimento per i
// visitatori), come app/actions/waitlist.ts. Serve la migration 62: prima
// di applicarla l'invio risponde con il messaggio di ripiego (scrivici via
// email) e non salva nulla.

import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { revalidatePath } from "next/cache";
import {
  ACCESS_PROBLEM_HOURLY_CAP,
  ACCESS_PROBLEM_SOURCE,
  checkAccessProblem,
  type AccessProblemInput,
} from "@/lib/nextgen/access-problem";
import { notifyAdmins } from "@/lib/admin-alerts/send";

export type AccessProblemResult = { ok: true } | { ok: false; message: string; field?: "message" | "email"; suggestion?: string };

const UNAVAILABLE = "Non riusciamo a ricevere la segnalazione in questo momento. Scrivici a privacy@tramapp.it e ti rispondiamo noi.";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function submitAccessProblemAction(input: AccessProblemInput): Promise<AccessProblemResult> {
  const check = checkAccessProblem(input);
  if (!check.ok) {
    // Programma automatico: stessa risposta di un invio riuscito, niente salvato.
    if (check.field === "bot") return { ok: true };
    return { ok: false, message: check.message, field: check.field, suggestion: check.suggestion };
  }
  const service = isSupabaseConfigured ? createServiceClient() : null;
  if (!service) return { ok: false, message: UNAVAILABLE };
  const row = check.row;

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Tetto orario complessivo: oltre, si risponde "ricevuto" senza salvare.
  const recent = await service
    .from("beta_feedback")
    .select("id", { count: "exact", head: true })
    .eq("app_source", ACCESS_PROBLEM_SOURCE)
    .gte("created_at", hourAgo);
  if (recent.error) {
    // app_source 'accesso' non ancora ammesso o colonna mancante: migration 62 non applicata.
    console.error("[access-problem] lettura non riuscita (migration 62 applicata?):", recent.error.message);
    return { ok: false, message: UNAVAILABLE };
  }
  if ((recent.count ?? 0) >= ACCESS_PROBLEM_HOURLY_CAP) return { ok: true };

  // Doppione (stesso testo nelle ultime 24 ore, es. doppio tocco): già ricevuta.
  const dup = await service
    .from("beta_feedback")
    .select("id")
    .eq("app_source", ACCESS_PROBLEM_SOURCE)
    .eq("message", row.message)
    .gte("created_at", dayAgo)
    .limit(1);
  if (!dup.error && dup.data && dup.data.length > 0) return { ok: true };

  const { error } = await service.from("beta_feedback").insert(row);
  if (error) {
    console.error("[access-problem] salvataggio non riuscito (migration 62 applicata?):", error.message);
    return { ok: false, message: UNAVAILABLE };
  }

  try {
    await service.from("product_events").insert({ event_name: "access_problem_reported", detail: row.client_context.kind });
  } catch {
    // osservabilità best-effort
  }

  // Avviso a Fabrizio: stessa variabile della lista d'attesa (nessuna nuova da impostare).
  const notifyTo = process.env.FEEDBACK_NOTIFY_EMAIL || process.env.WAITLIST_NOTIFY_EMAIL;
  if (notifyTo && isEmailConfigured) {
    await sendEmail({
      to: notifyTo,
      subject: "TRAMA — qualcuno ha problemi ad accedere",
      html: `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#172A4D"><p>${escapeHtml(row.message)}</p><p><b>Email per rispondere:</b> ${row.contact_email ? escapeHtml(row.contact_email) : "non lasciata"}</p><p>La trovi in Admin → Segnalazioni beta.</p></div>`,
    }).catch(() => undefined);
  }

  // 20/11/2026: anche una push agli Admin (l'email qui sopra resta com'era).
  await notifyAdmins({ kind: "access_problem" });

  revalidatePath("/admin/segnalazioni-beta");
  return { ok: true };
}
