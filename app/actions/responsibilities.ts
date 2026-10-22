"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ResponsibleValue, Weekday, Moment, WEEKDAYS } from "@/lib/nextgen/responsibility-options";
import { revalidatePath } from "next/cache";
import type { PassageTarget } from "@/lib/nextgen/passages";

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
  // 20/10/2026 — CHI ACCOMPAGNA PIÙ VELOCE: niente revalidatePath qui. Il
  // Planner V2 aggiorna la scelta subito in locale e ricarica alla chiusura
  // del foglio; il Planner di prima tiene già il suo stato locale. Prima ogni
  // tocco aspettava il ridisegno dell'intero Planner (1–2 secondi).
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
  // 20/10/2026 — CHI ACCOMPAGNA PIÙ VELOCE: niente revalidatePath qui. Il
  // Planner V2 aggiorna la scelta subito in locale e ricarica alla chiusura
  // del foglio; il Planner di prima tiene già il suo stato locale. Prima ogni
  // tocco aspettava il ridisegno dell'intero Planner (1–2 secondi).
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

// TRAMA — CHI ACCOMPAGNA PIÙ VELOCE (20/10/2026): "applica a tutto
// l'impegno". Stessa scrittura di setResponsibilityAction, per più giorni di
// un figlio in un colpo solo (una sola upsert). I giorni li calcola il foglio
// con otherDaysOfCommitments (lib/nextgen/assign-plus.ts): qui si controlla
// solo che siano date valide, feriali, al massimo 200.
export async function setResponsibilityForDatesAction(
  kidId: string,
  dates: string[],
  moment: Moment,
  responsible: ResponsibleValue,
  responsibleLabel?: string,
  familyPersonId?: string
): Promise<{ error?: string; count?: number }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (responsible === "altro" && !responsibleLabel?.trim()) return { error: "Scrivi chi se ne occupa" };
  const unique = Array.from(new Set(dates)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (unique.length === 0) return { count: 0 };
  if (unique.length > 200) return { error: "Troppi giorni in una volta" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const resolvedFamilyPersonId = await resolveFamilyPersonId(supabase, user.id, responsible, responsibleLabel, familyPersonId);
  const now = new Date().toISOString();
  const rows = unique.flatMap((iso) => {
    const d = new Date(iso + "T00:00:00Z");
    const offset = (d.getUTCDay() + 6) % 7; // 0 = lunedì
    const wd = WEEKDAYS.find((w) => w.dayOffset === offset);
    if (!wd) return []; // sabato/domenica: week_responsibilities conosce solo lun–ven
    d.setUTCDate(d.getUTCDate() - offset);
    return [
      {
        parent_id: user.id,
        kid_id: kidId,
        week_start_date: d.toISOString().slice(0, 10),
        weekday: wd.value,
        moment,
        responsible,
        responsible_label: responsible === "altro" ? responsibleLabel!.trim() : null,
        ...(responsible === "altro" ? { family_person_id: resolvedFamilyPersonId } : {}),
        updated_at: now,
      },
    ];
  });
  if (rows.length === 0) return { count: 0 };
  const { error } = await supabase.from("week_responsibilities").upsert(rows, { onConflict: "parent_id,kid_id,week_start_date,weekday,moment" });
  if (error) return { error: error.message };
  return { count: rows.length };
}

// ─── 22/10/2026 — CHI ACCOMPAGNA PER PASSAGGIO (release "chi-accompagna-per-passaggio") ───
// Scrive su passage_responsibilities (migration 51): uno o più passaggi con la
// stessa persona (un viaggio = uscita da scuola + andata all'attività), anche
// su più date ("tutto l'impegno"). `mirror`: le scelte che sono anche la prima
// andata / l'ultimo ritorno del giorno si scrivono anche come scelta del
// giorno (week_responsibilities), che Home, promemoria della sera e piano
// condiviso leggono ancora. Logica: lib/nextgen/passages.ts.


const PASSAGE_KEY_RE = /^(school|booking:[0-9a-f-]{36}|external:[0-9a-f-]{36})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validTargets<T extends { date: string; moment: Moment }>(list: T[], withKey: boolean): T[] | null {
  if (list.length > 400) return null;
  for (const t of list) {
    if (!DATE_RE.test(t.date) || (t.moment !== "andata" && t.moment !== "ritorno")) return null;
    if (withKey && !PASSAGE_KEY_RE.test((t as unknown as PassageTarget).passageKey)) return null;
  }
  return list;
}

function dayRowOf(date: string): { weekStartDate: string; weekday: Weekday } | null {
  const d = new Date(date + "T00:00:00Z");
  const offset = (d.getUTCDay() + 6) % 7;
  const wd = WEEKDAYS.find((w) => w.dayOffset === offset);
  if (!wd) return null; // sabato/domenica: la scelta del giorno non esiste
  d.setUTCDate(d.getUTCDate() - offset);
  return { weekStartDate: d.toISOString().slice(0, 10), weekday: wd.value };
}

export async function setPassageResponsibilitiesAction(input: {
  targets: PassageTarget[];
  responsible: ResponsibleValue;
  responsibleLabel?: string;
  familyPersonId?: string;
  mirror?: { kidId: string; date: string; moment: Moment }[];
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (input.responsible === "altro" && !input.responsibleLabel?.trim()) return { error: "Scrivi chi se ne occupa" };
  const targets = validTargets(input.targets, true);
  const mirror = validTargets(input.mirror ?? [], false);
  if (!targets || !mirror) return { error: "Passaggi non validi" };
  if (targets.length === 0) return {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const familyPersonId = await resolveFamilyPersonId(supabase, user.id, input.responsible, input.responsibleLabel, input.familyPersonId);
  const label = input.responsible === "altro" ? input.responsibleLabel!.trim().slice(0, 80) : null;
  const now = new Date().toISOString();
  const { error } = await supabase.from("passage_responsibilities").upsert(
    targets.map((t) => ({
      parent_id: user.id,
      kid_id: t.kidId,
      date: t.date,
      passage_key: t.passageKey,
      moment: t.moment,
      responsible: input.responsible,
      responsible_label: label,
      family_person_id: input.responsible === "altro" ? familyPersonId : null,
      updated_at: now,
    })),
    { onConflict: "parent_id,kid_id,date,passage_key,moment" }
  );
  if (error) return { error: error.message };

  const dayRows = mirror.flatMap((m) => {
    const day = dayRowOf(m.date);
    if (!day) return [];
    return [
      {
        parent_id: user.id,
        kid_id: m.kidId,
        week_start_date: day.weekStartDate,
        weekday: day.weekday,
        moment: m.moment,
        responsible: input.responsible,
        responsible_label: label,
        ...(input.responsible === "altro" ? { family_person_id: familyPersonId } : {}),
        updated_at: now,
      },
    ];
  });
  if (dayRows.length > 0) {
    const { error: dayError } = await supabase
      .from("week_responsibilities")
      .upsert(dayRows, { onConflict: "parent_id,kid_id,week_start_date,weekday,moment" });
    if (dayError) return { error: dayError.message };
  }
  return {};
}

export async function clearPassageResponsibilitiesAction(input: {
  targets: PassageTarget[];
  mirror?: { kidId: string; date: string; moment: Moment }[];
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const targets = validTargets(input.targets, true);
  const mirror = validTargets(input.mirror ?? [], false);
  if (!targets || !mirror) return { error: "Passaggi non validi" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  for (const t of targets) {
    const { error } = await supabase
      .from("passage_responsibilities")
      .delete()
      .eq("parent_id", user.id)
      .eq("kid_id", t.kidId)
      .eq("date", t.date)
      .eq("passage_key", t.passageKey)
      .eq("moment", t.moment);
    if (error) return { error: error.message };
  }
  for (const m of mirror) {
    const day = dayRowOf(m.date);
    if (!day) continue;
    const { error } = await supabase
      .from("week_responsibilities")
      .delete()
      .eq("parent_id", user.id)
      .eq("kid_id", m.kidId)
      .eq("week_start_date", day.weekStartDate)
      .eq("weekday", day.weekday)
      .eq("moment", m.moment);
    if (error) return { error: error.message };
  }
  return {};
}
