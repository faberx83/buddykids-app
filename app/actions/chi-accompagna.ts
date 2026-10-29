"use server";

// TRAMA — CHI ACCOMPAGNA DOVE SI TOCCA (29/10/2026, release
// "chi-accompagna-giornate-piene"). Fabrizio: "non è possibile far aprire la
// scheda nel contesto di dove viene cliccata? oggi ricarica la pagina e
// finisce nel planner". I dati per aprire "Chi fa cosa" (settimana) o
// "Chi accompagna" (giorno) sopra la pagina in cui si è (Home, +, buongiorno),
// senza andare nel Planner. REUSE: gli stessi dati del Planner
// (loadPlannerV2Props), restituiti solo nella parte che serve ai due fogli.
// Flag spento (o passaggi spenti) → { fallback: true }: il link porta al
// Planner come prima.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { loadPlannerV2Props, type PlannerV2Props } from "@/app/nextgen/planner/planner-v2-data";

export type ChiAccompagnaContext = Pick<
  PlannerV2Props,
  | "todayIso"
  | "kids"
  | "bookings"
  | "hoursByActivityDbId"
  | "externalItems"
  | "responsibilities"
  | "parentRole"
  | "familyPeople"
  | "closureLabelsByDate"
  | "schoolClosedDates"
  | "assignPlusEnabled"
  | "partnerOnTrama"
  | "passageResponsibilities"
>;

export async function loadChiAccompagnaAction(): Promise<{ fallback: true } | { fallback: false; context: ChiAccompagnaContext }> {
  if (!isSupabaseConfigured) return { fallback: true };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { fallback: true };
    const { data: profileRow } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const role = (profileRow?.role as string | null) ?? "parent";
    const p = await loadPlannerV2Props({ userId: user.id, role, searchParams: {} });
    if (!p.passagesEnabled || !p.passagePersonFirst) return { fallback: true };
    return {
      fallback: false,
      context: {
        todayIso: p.todayIso,
        kids: p.kids,
        bookings: p.bookings,
        hoursByActivityDbId: p.hoursByActivityDbId,
        externalItems: p.externalItems,
        responsibilities: p.responsibilities,
        parentRole: p.parentRole,
        familyPeople: p.familyPeople,
        closureLabelsByDate: p.closureLabelsByDate,
        schoolClosedDates: p.schoolClosedDates,
        assignPlusEnabled: p.assignPlusEnabled,
        partnerOnTrama: p.partnerOnTrama,
        passageResponsibilities: p.passageResponsibilities,
      },
    };
  } catch {
    return { fallback: true };
  }
}
