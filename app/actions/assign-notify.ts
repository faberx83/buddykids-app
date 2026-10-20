"use server";

// TRAMA — CHI ACCOMPAGNA PIÙ VELOCE (20/10/2026, release
// "chi-accompagna-veloce"). Quando chiudi il foglio "Chi accompagna", se in
// quel giro hai affidato (o tolto) passaggi all'altro genitore e lui/lei è
// nella tua famiglia su TRAMA, gli arriva UNA notifica con l'elenco
// (Fabrizio: "solo l'assegnatario, una per giro"). Riusa sendPushToUser
// (rispetta "Notifiche push") e la famiglia di getFamilyForUser. Nessun
// dato nuovo salvato oltre a un conteggio in product_events.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { getFamilyForUser } from "@/lib/data/family";
import { sendPushToUser } from "@/lib/push/send";
import { buildAssignNotice, CHI_ACCOMPAGNA_PLUS_FLAG, type AssignChange } from "@/lib/nextgen/assign-plus";
import { persistProductEvent } from "@/lib/telemetry/events";

function cleanChanges(raw: AssignChange[]): AssignChange[] {
  return (Array.isArray(raw) ? raw : [])
    .filter(
      (c) =>
        c &&
        /^\d{4}-\d{2}-\d{2}$/.test(String(c.dateIso)) &&
        (c.moment === "andata" || c.moment === "ritorno") &&
        typeof c.kidName === "string" &&
        typeof c.assigned === "boolean"
    )
    .slice(0, 300)
    .map((c) => ({ dateIso: c.dateIso, kidName: c.kidName.slice(0, 60), moment: c.moment, assigned: c.assigned }));
}

export async function notifyPartnerAssignmentsAction(raw: AssignChange[]): Promise<{ sent: number; error?: string }> {
  if (!isSupabaseConfigured) return { sent: 0 };
  const changes = cleanChanges(raw);
  if (changes.length === 0) return { sent: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { sent: 0, error: "Non autenticato" };

  const on = await resolveFeatureFlag({
    flagName: CHI_ACCOMPAGNA_PLUS_FLAG,
    userId: user.id,
    role: "parent",
    tenant: "family",
    correlationId: generateCorrelationId(),
  }).catch(() => false);
  if (!on) return { sent: 0 };

  const family = await getFamilyForUser().catch(() => null);
  const others = (family?.members ?? []).filter((m) => !m.isMe);
  if (others.length === 0) return { sent: 0 };

  const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const firstName = String((me?.full_name as string | null) ?? "").trim().split(/\s+/)[0] || null;
  const notice = buildAssignNotice({ fromName: firstName, changes, nonce: String(Date.now()) });
  if (!notice) return { sent: 0 };

  for (const m of others) await sendPushToUser(m.parentId, notice);

  try {
    await persistProductEvent(
      { event: "assign_partner_notified", correlationId: generateCorrelationId(), tenant: "family", detail: `passaggi=${changes.length}` },
      { supabase, userId: user.id }
    );
  } catch {
    // osservabilità best-effort
  }
  return { sent: others.length };
}
