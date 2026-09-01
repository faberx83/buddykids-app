"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ResponsibleValue, Weekday, Moment, WEEKDAYS } from "@/lib/nextgen/responsibility-options";
import { revalidatePath } from "next/cache";

const PLANNER_PATH = "/nextgen/planner";

// TRAMA BETA v1.1.1 — FINAL GAP CLOSURE (punto 7 — "quando l'utente sceglie
// Altro e inserisce un nome, la persona deve essere salvata come family
// person persistente"). Trova una persona esistente per questo genitore
// (case-insensitive: "Zio Marco" e "zio marco" sono la stessa persona,
// stesso indice univoco di supabase/migration_32_family_people.sql) o la
// crea. Ritorna null se la tabella non esiste ancora (migrazione non
// applicata) o se il nome è vuoto — in quel caso il chiamante scrive
// comunque responsible_label come prima di questa wave (nessuna
// regressione, solo nessuna persistenza finché la migrazione non è
// applicata).
async function findOrCreateFamilyPerson(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
  displayName: string
): Promise<string | null> {
  const trimmed = displayName.trim();
  if (!trimmed) return null;

  const { data: existing, error: findError } = await supabase
    .from("family_people")
    .select("id")
    .eq("parent_id", parentId)
    .ilike("display_name", trimmed)
    .maybeSingle();
  if (!findError && existing) return existing.id as string;

  const { data: created, error: createError } = await supabase
    .from("family_people")
    .insert({ parent_id: parentId, display_name: trimmed })
    .select("id")
    .maybeSingle();
  if (createError || !created) return null; // tabella assente o altro errore: degrada senza bloccare l'assegnazione
  return created.id as string;
}

// Quando il chiamante conosce già l'id (chip di una persona persistente
// già mostrata nel selettore, vedi resolveResponsibleOptions) invece di
// testo libero appena digitato: verifica che l'id appartenga DAVVERO a
// questo genitore prima di riusarlo — un id valido ma di un altro
// parent_id (teoricamente inviabile solo forzando la richiesta, la RLS
// blocca comunque qualunque lettura reale di quella riga da parte di un
// altro account) viene ignorato e si ricade sul find-or-create per nome,
// mai fidandosi ciecamente di un id arrivato dal client.
async function verifyFamilyPersonId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
  familyPersonId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("family_people")
    .select("id")
    .eq("id", familyPersonId)
    .eq("parent_id", parentId)
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}

// Risolve il riferimento stabile per responsible="altro": usa l'id già
// verificato se fornito dal client (chip nota), altrimenti find-or-create
// per etichetta (testo libero appena digitato). Per ogni altro valore di
// responsible ritorna sempre null — nessuna colonna family_person_id
// scritta per Io/Mamma-Papà-Partner/Nonno/Nonna/Tata (invariati, zero
// rischio di rottura pre-migrazione su quei percorsi).
async function resolveFamilyPersonId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
  responsible: ResponsibleValue,
  responsibleLabel: string | undefined,
  familyPersonId: string | undefined
): Promise<string | null> {
  if (responsible !== "altro") return null;
  if (familyPersonId) {
    const verified = await verifyFamilyPersonId(supabase, parentId, familyPersonId);
    if (verified) return verified;
  }
  return findOrCreateFamilyPerson(supabase, parentId, responsibleLabel ?? "");
}

// SPRINT CORRETTIVO — granularità per singolo giorno feriale (weekday) e
// momento (andata/ritorno), non più un'unica assegnazione per l'intera
// settimana (vedi commento in supabase/schema.sql e lib/nextgen/
// responsibility-options.ts).
export async function setResponsibilityAction(
  kidId: string,
  weekStartDate: string,
  weekday: Weekday,
  moment: Moment,
  responsible: ResponsibleValue,
  responsibleLabel?: string,
  // TRAMA BETA v1.1.1 — FINAL GAP CLOSURE: id di una persona persistente
  // già nota (tap su una chip del selettore), opzionale. Se assente e
  // responsible === "altro", resolveFamilyPersonId fa find-or-create sul
  // testo digitato — comportamento invariato per chi non lo passa.
  familyPersonId?: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (responsible === "altro" && !responsibleLabel?.trim()) {
    return { error: "Scrivi chi si occupa del ritiro" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const resolvedFamilyPersonId = await resolveFamilyPersonId(
    supabase,
    user.id,
    responsible,
    responsibleLabel,
    familyPersonId
  );

  const { error } = await supabase.from("week_responsibilities").upsert(
    {
      parent_id: user.id,
      kid_id: kidId,
      week_start_date: weekStartDate,
      weekday,
      moment,
      responsible,
      responsible_label: responsible === "altro" ? responsibleLabel!.trim() : null,
      // Scritto SOLO per responsible === "altro" — per ogni altro valore
      // resta assente dal payload (undefined), quindi il default/valore
      // esistente della colonna non viene toccato per quei percorsi anche
      // su un DB dove la colonna non esistesse ancora. Solo quando
      // responsible === "altro" la riga referenzia esplicitamente
      // family_person_id (anche null se non risolvibile: nessuna riga
      // "a metà" con un id inventato).
      ...(responsible === "altro" ? { family_person_id: resolvedFamilyPersonId } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "parent_id,kid_id,week_start_date,weekday,moment" }
  );

  if (error) return { error: error.message };
  revalidatePath(PLANNER_PATH);
  return {};
}

export async function clearResponsibilityAction(
  kidId: string,
  weekStartDate: string,
  weekday: Weekday,
  moment: Moment
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("week_responsibilities")
    .delete()
    .eq("parent_id", user.id)
    .eq("kid_id", kidId)
    .eq("week_start_date", weekStartDate)
    .eq("weekday", weekday)
    .eq("moment", moment);

  if (error) return { error: error.message };
  revalidatePath(PLANNER_PATH);
  return {};
}

// FEEDBACK DI FABRIZIO: "bisogna aggiungere qualcosa che permetta di
// applicare rapidamente l'assegnazione su tutta la settimana ed
// eventualmente applicarla anche ai due figli — non è detto che siano da
// gestire diversamente o insieme". Un solo upsert multiplo (un array di
// righe, una per bambino×giorno×momento) invece di 10-20 chiamate
// sequenziali a setResponsibilityAction — più veloce e atomico.
//
// FEEDBACK SUCCESSIVO DI FABRIZIO: "ci vuole qualcosa di flessibile" — oltre
// a scegliere i bambini, anche solo Andata, solo Ritorno, o entrambi (non
// sempre chi porta è chi ritira). Il parametro moments sostituisce il fisso
// MOMENTS di prima: chi chiama decide quali momenti includere.
export async function setWeekBulkResponsibilityAction(
  kidIds: string[],
  weekStartDate: string,
  moments: Moment[],
  responsible: ResponsibleValue,
  responsibleLabel?: string,
  // TRAMA BETA v1.1.1 — FINAL GAP CLOSURE, stesso significato del parametro
  // omonimo di setResponsibilityAction sopra.
  familyPersonId?: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (kidIds.length === 0) return { error: "Seleziona almeno un bambino" };
  if (moments.length === 0) return { error: "Seleziona almeno Andata o Ritorno" };
  if (responsible === "altro" && !responsibleLabel?.trim()) {
    return { error: "Scrivi chi si occupa del ritiro" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const resolvedFamilyPersonId = await resolveFamilyPersonId(
    supabase,
    user.id,
    responsible,
    responsibleLabel,
    familyPersonId
  );

  const now = new Date().toISOString();
  const rows = kidIds.flatMap((kidId) =>
    WEEKDAYS.flatMap((wd) =>
      moments.map((moment) => ({
        parent_id: user.id,
        kid_id: kidId,
        week_start_date: weekStartDate,
        weekday: wd.value,
        moment,
        responsible,
        responsible_label: responsible === "altro" ? responsibleLabel!.trim() : null,
        ...(responsible === "altro" ? { family_person_id: resolvedFamilyPersonId } : {}),
        updated_at: now,
      }))
    )
  );

  const { error } = await supabase
    .from("week_responsibilities")
    .upsert(rows, { onConflict: "parent_id,kid_id,week_start_date,weekday,moment" });

  if (error) return { error: error.message };
  revalidatePath(PLANNER_PATH);
  return {};
}
