// SPRINT 5.3 (NEXTGEN) — tipi/costanti "Chi fa cosa?" estratti da
// lib/data/responsibilities.ts in un modulo SENZA import server-only: stesso
// motivo di lib/nextgen/address-kinds.ts — PlannerCalendarView.tsx ("use
// client") importava RESPONSIBLE_OPTIONS (una costante, non solo un tipo)
// direttamente da lib/data/responsibilities.ts, che importa
// lib/supabase/server (next/headers), facendo fallire la build Next.js con
// lo stesso errore visto per gli Indirizzi. lib/data/responsibilities.ts ora
// importa da qui e ri-esporta, il codice server-side resta invariato.

export type ResponsibleValue = "io" | "partner" | "nonno" | "nonna" | "tata" | "altro";

export const RESPONSIBLE_OPTIONS: { value: ResponsibleValue; emoji: string; label: string }[] = [
  { value: "io", emoji: "🧑", label: "Io" },
  { value: "partner", emoji: "❤️", label: "Partner" },
  { value: "nonno", emoji: "👴", label: "Nonno" },
  { value: "nonna", emoji: "👵", label: "Nonna" },
  { value: "tata", emoji: "🧑‍🍼", label: "Tata" },
  { value: "altro", emoji: "✏️", label: "Altro" },
];

// SPRINT CORRETTIVO (feedback di Fabrizio: "non è detto che sia sempre la
// stessa persona a gestire") — granularità per singolo giorno feriale e
// momento (andata/ritorno), invece di un'unica assegnazione per l'intera
// settimana: persone diverse possono alternarsi nella stessa settimana.
export type Weekday = "lun" | "mar" | "mer" | "gio" | "ven";

export const WEEKDAYS: { value: Weekday; label: string; dayOffset: number }[] = [
  { value: "lun", label: "Lun", dayOffset: 0 },
  { value: "mar", label: "Mar", dayOffset: 1 },
  { value: "mer", label: "Mer", dayOffset: 2 },
  { value: "gio", label: "Gio", dayOffset: 3 },
  { value: "ven", label: "Ven", dayOffset: 4 },
];

export type Moment = "andata" | "ritorno";

export const MOMENTS: { value: Moment; label: string; icon: string }[] = [
  { value: "andata", label: "Andata", icon: "ti-arrow-right" },
  { value: "ritorno", label: "Ritorno", icon: "ti-arrow-left" },
];

export interface WeekResponsibility {
  kidId: string;
  weekStartDate: string;
  weekday: Weekday;
  moment: Moment;
  responsible: ResponsibleValue;
  responsibleLabel: string | null; // solo per responsible="altro"
  // TRAMA BETA v1.1.1 (FINAL GAP CLOSURE, punto 5) — riferimento stabile a
  // public.family_people quando responsible="altro" corrisponde a una
  // persona custom persistente (nullable: righe legacy/"Altro" ad-hoc senza
  // migrazione applicata restano valide con familyPersonId=null — nessun
  // backfill, nessuna reinterpretazione automatica delle vecchie label).
  familyPersonId?: string | null;
}

// TRAMA BETA v1.1.1 (FINAL GAP CLOSURE, punto 3) — forma minima di una
// persona custom persistente: id stabile, ownership implicita nel fetch
// (già scoped per parent_id lato server, vedi lib/data/family-people.ts),
// display_name, emoji. Nessun campo "relationship/type" libero aggiunto:
// non richiesto da nessun punto della revisione e display_name libero
// ("Zio Marco") già lo esprime senza bisogno di una tassonomia separata.
export interface FamilyPerson {
  id: string;
  displayName: string;
  emoji: string;
}

// TRAMA BETA v1.1.1 (UI Refinement, punto 15 — "Mamma/Papà contestuale") —
// segnalazione: il selettore mostrava sempre "Partner" in modo generico,
// anche quando l'app conosce già il ruolo del genitore che sta guardando lo
// schermo (profiles.parent_role, "padre"/"madre"/"tutore" — già letto da
// app/nextgen/planner/page.tsx come profile.parentRole, ma mai passato più
// giù). ADAPT, non NEW: nessuna nuova opzione responsabile, nessuna
// modifica allo schema — riusiamo lo stesso valore tecnico "partner" già
// persistito (week_responsibilities.responsible resta invariato: "partner"
// in DB, qualunque sia l'etichetta mostrata), risolvendo dinamicamente solo
// la LABEL visibile. "import type" per ParentRole (da lib/data/profile.ts,
// che importa lib/supabase/server): il tipo viene eliminato a compile-time,
// stesso pattern già usato per SeasonWeek/KidOverlap altrove in questo
// modulo client-safe — nessun import server-only finisce nel bundle client.
//
// Nessuna inferenza da nome/avatar/sesso presunto/email (esplicitamente
// vietato dalla revisione): SOLO parent_role, esplicito nel profilo. Se il
// ruolo non è noto (profilo incompleto) o è "tutore", fallback a "Partner"
// (comportamento identico a prima).
import type { ParentRole } from "@/lib/data/profile";

export interface ResponsibleOption {
  value: ResponsibleValue;
  emoji: string;
  label: string;
  // Presente SOLO sulle opzioni "persona custom persistente" (punto 6 della
  // revisione FINAL GAP CLOSURE): distingue una chip già nota (tap diretto,
  // nessun testo da digitare) dalla voce generica "Altro" in fondo alla
  // lista (che apre ancora l'input libero — vedi PlannerCalendarView.tsx).
  // Il valore tecnico persistito resta "altro" in entrambi i casi: nessuna
  // modifica al check constraint di week_responsibilities.responsible.
  familyPersonId?: string;
}

// TRAMA BETA v1.1.1 (FINAL GAP CLOSURE, punto 6 — "source di opzioni unica,
// ordine Io / Mamma-Papà-Partner / persone custom persistenti / Nonno /
// Nonna / Tata / Altro"). ADAPT, non NEW: stessa funzione già introdotta
// per il punto 15 di v1.1.1 (Mamma/Papà contestuale), ora estesa con un
// secondo parametro opzionale — le chiamate esistenti che non lo passano
// (nessuna persona persistente da mostrare, o migrazione non ancora
// applicata) continuano a funzionare identiche a prima.
export function resolveResponsibleOptions(
  parentRole: ParentRole | null,
  familyPeople: FamilyPerson[] = []
): ResponsibleOption[] {
  const partnerLabel = parentRole === "padre" ? "Mamma" : parentRole === "madre" ? "Papà" : "Partner";
  const partnerEmoji = parentRole === "padre" ? "👩" : parentRole === "madre" ? "👨" : "❤️";
  const base = RESPONSIBLE_OPTIONS.map((opt) =>
    opt.value === "partner" ? { ...opt, label: partnerLabel, emoji: partnerEmoji } : opt
  );
  if (familyPeople.length === 0) return base;

  const io = base.find((o) => o.value === "io")!;
  const partner = base.find((o) => o.value === "partner")!;
  const rest = base.filter((o) => o.value !== "io" && o.value !== "partner" && o.value !== "altro");
  const genericAltro = base.find((o) => o.value === "altro")!;
  const peopleOptions: ResponsibleOption[] = familyPeople.map((p) => ({
    value: "altro",
    emoji: p.emoji,
    label: p.displayName,
    familyPersonId: p.id,
  }));
  return [io, partner, ...peopleOptions, ...rest, genericAltro];
}

// TRAMA BETA v1.1.1 (FINAL GAP CLOSURE, punto 8 — "non duplicare la
// funzione di mapping: riusa/estrai helper condiviso"). Prima di questa
// wave, PlannerCalendarView.tsx e TodayResponsibilityReminder.tsx avevano
// due implementazioni indipendenti dello stesso calcolo (label/emoji per un
// responsible già assegnato) — quella di Home non era contestuale al
// parent_role (mostrava sempre "Partner" generico). Unica fonte ora:
// responsible_label è già denormalizzato al momento del salvataggio (vedi
// app/actions/responsibilities.ts, findOrCreateFamilyPerson) col
// display_name reale della persona, quindi per "altro" basta la label
// salvata — nessun bisogno di un JOIN a family_people in lettura.
export function resolveResponsibleDisplay(
  // responsible accetta anche null: TodayResponsibilityEntry.responsible
  // (Home) è nullable per uno slot non ancora assegnato — il chiamante in
  // TodayResponsibilityReminder.tsx filtra già quegli slot prima di
  // renderizzare, ma il tipo resta nullable a monte, quindi questa firma lo
  // accetta esplicitamente invece di forzare un cast lato chiamante.
  entry: { responsible: ResponsibleValue | null; responsibleLabel: string | null },
  parentRole: ParentRole | null
): { label: string; emoji: string } {
  if (entry.responsible === null) return { label: "", emoji: "" };
  if (entry.responsible === "altro") {
    return { label: entry.responsibleLabel?.trim() || "Altro", emoji: "✏️" };
  }
  const options = resolveResponsibleOptions(parentRole);
  const opt = options.find((o) => o.value === entry.responsible);
  return { label: opt?.label ?? "", emoji: opt?.emoji ?? "" };
}

// TRAMA BETA v1.1.1 — PIANO CONDIVISO: "chi fa cosa" (02/09/2026, richiesta
// esplicita di Fabrizio dopo aver visto la pagina pubblica del piano
// condiviso: "il mercoledì tocca alla tata, gli altri giorni ai nonni" deve
// essere leggibile da chi riceve il link, non solo dal genitore che lo ha
// creato).
//
// resolveResponsibleDisplay (sopra) è scritta in PRIMA persona per il
// genitore loggato: "io" -> "Io", "partner" -> l'etichetta dell'ALTRO
// genitore vista dal genitore che guarda lo schermo. Sulla pagina pubblica
// (nonni/tata, senza login) quella prospettiva è sbagliata: "Io" non
// significa nulla per chi legge, e "partner" andrebbe letto rispetto al
// genitore PROPRIETARIO del piano, non rispetto a chi guarda. Questa
// funzione risolve in TERZA persona: "io" -> il ruolo del genitore
// proprietario stesso (es. "Papà"), "partner" -> l'altro genitore (es.
// "Mamma"), entrambi derivati dallo stesso profiles.parent_role del
// proprietario (mai un'inferenza da nome/email/avatar, stesso vincolo di
// resolveResponsibleOptions sopra) — "Genitore"/"Partner" generici se il
// ruolo non è noto. nonno/nonna/tata/altro restano identici (già
// naturalmente in terza persona).
export function resolvePublicResponsibleLabel(
  entry: { responsible: ResponsibleValue | null; responsibleLabel: string | null },
  ownerParentRole: ParentRole | null
): { label: string; emoji: string } {
  if (entry.responsible === null) return { label: "", emoji: "" };
  if (entry.responsible === "altro") {
    return { label: entry.responsibleLabel?.trim() || "Altro", emoji: "✏️" };
  }
  if (entry.responsible === "io") {
    const label = ownerParentRole === "padre" ? "Papà" : ownerParentRole === "madre" ? "Mamma" : "Genitore";
    const emoji = ownerParentRole === "padre" ? "👨" : ownerParentRole === "madre" ? "👩" : "🧑";
    return { label, emoji };
  }
  if (entry.responsible === "partner") {
    const label = ownerParentRole === "padre" ? "Mamma" : ownerParentRole === "madre" ? "Papà" : "Partner";
    const emoji = ownerParentRole === "padre" ? "👩" : ownerParentRole === "madre" ? "👨" : "❤️";
    return { label, emoji };
  }
  const opt = RESPONSIBLE_OPTIONS.find((o) => o.value === entry.responsible);
  return { label: opt?.label ?? "", emoji: opt?.emoji ?? "" };
}
