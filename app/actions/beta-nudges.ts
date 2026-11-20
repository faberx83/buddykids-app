"use server";

// TRAMA — SOLLECITI ALLE FAMIGLIE DELLA BETA (20/11/2026). Fabrizio: "dobbiamo
// definire una campagna di push per 'sollecitare' chi non si è iscritto".
// Solo platform_admin; l'invio parte sempre da un clic in Beta Famiglie → Frizioni.

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/data/beta-cockpit";
import { sendNudgeCampaign } from "@/lib/data/beta-nudges";
import { nudgeByKey } from "@/lib/beta-cockpit/nudges";

export async function sendNudgeCampaignAction(
  key: string
): Promise<{ ok: true; people: number; emails: number; skippedCooldown: number } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin();
  if (!admin) return { ok: false, error: "Solo per amministratori." };
  if (!nudgeByKey(key)) return { ok: false, error: "Sollecito sconosciuto." };
  const result = await sendNudgeCampaign(key);
  if ("error" in result) return { ok: false, error: result.error };
  revalidatePath("/admin/beta");
  return { ok: true, ...result };
}
