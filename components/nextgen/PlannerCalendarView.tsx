"use client";

import { useEffect, useMemo, useRef, useState } from "react";
// "import type" per SeasonWeek/PlanShare: sono usati SOLO come tipo in
// questo componente client — con "import type" il compilatore li elimina
// sempre dal bundle, cosi lib/data/planner.ts e lib/data/plan-shares.ts (che
// importano lib/supabase/server) non finiscono mai nel bundle client per
// errore (stesso bug di build risolto per ADDRESS_KIND_LABELS/
// RESPONSIBLE_OPTIONS, vedi lib/nextgen/address-kinds.ts).
import type { SeasonWeek } from "@/lib/data/planner";
import type { KidOverlap } from "@/lib/nextgen/planner-insights";
import { buildCalendarMonths, defaultMonthKey, CalendarDay } from "@/lib/nextgen/calendar-weeks";
import {
  WeekResponsibility,
  ResponsibleValue,
  Weekday,
  Moment,
  WEEKDAYS,
  MOMENTS,
  resolveResponsibleOptions,
  FamilyPerson,
} from "@/lib/nextgen/responsibility-options";
// TRAMA BETA v1.1.1 (FINAL VISUAL CONFORMANCE PASS, punto 8) — helper puro
// (nessuna dipendenza server-only) che decide lo STATO cromatico
// dell'assegnazione ("mine" / "other" / "unassigned"), estratto per essere
// coperto da un test unitario indipendente dal browser (VIS111-07/08).
import { responsibilityToneFor } from "@/lib/nextgen/responsibility-tone";
// TRAMA BETA v1.1.1 (FINAL FUNCTIONAL + UI CONSISTENCY FIXES, punto 8-13) —
// logica pura del toggle "Andata/Ritorno" nel bulk assign, estratta per
// essere testata senza browser — vedi lib/nextgen/bulk-assign.ts per la
// ROOT CAUSE ANALYSIS completa (il modello era ad esclusione, non a
// selezione: toccare "Andata" la ESCLUDEVA di default, mostrato barrato).
import { toggleInMap, selectedMoments, isBulkAssignReady } from "@/lib/nextgen/bulk-assign";
// "import type": ParentRole è solo un tipo, non trascina lib/supabase/server
// nel bundle client — stesso motivo di SeasonWeek/KidOverlap qui sopra.
import type { ParentRole } from "@/lib/data/profile";
import {
  setResponsibilityAction,
  clearResponsibilityAction,
  setWeekBulkResponsibilityAction,
} from "@/app/actions/responsibilities";
import type { PlanShare } from "@/lib/data/plan-shares";
import { createPlanShareAction, revokePlanShareAction } from "@/app/actions/plan-shares";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import type { Kid } from "@/lib/types";
// TRAMA — EXTERNAL PLANNER ITEMS · CALENDAR VISIBILITY (28/09/2026): vedi
// lib/planner/external-calendar-items-core.ts per la ROOT CAUSE ANALYSIS
// completa (questo componente non riceveva mai externalPlannerItems da
// PlannerClient.tsx, mentre buildCalendarMonths già sapeva riceverle da
// questo stesso fix — vedi lib/nextgen/calendar-weeks.ts). "import type"
// per ExternalPlannerItem: solo un tipo, non trascina lib/supabase/server
// (import "server-only" del modulo che lo dichiara) nel bundle client —
// stesso motivo già documentato per SeasonWeek/KidOverlap/ParentRole sopra.
import type { ExternalPlannerItem } from "@/lib/data/external-planner-items";
import {
  buildExternalOccurrencesByDate,
  externalOccurrencesInRange,
  type ExternalCalendarOccurrence,
} from "@/lib/planner/external-calendar-items-core";
// TRAMA — CALENDARIO PLANNER · AGENDA COME SUPERFICIE PRINCIPALE
// (28/09/2026): logica pura del day strip/agenda cronologica estratta in
// lib/nextgen/agenda-view.ts — vedi quel file per la ROOT CAUSE del perché
// (testabilità "[no browser]", stessa convenzione di bulk-assign.ts/
// responsibility-tone.ts/calendar-weeks.ts).
import {
  WEEKDAY_SHORT3_IT,
  AGENDA_BORDER_BG,
  AGENDA_EXTERNAL_BORDER_BG,
  mondayOfIso,
  formatMonthYearIt,
  buildAgendaRows,
} from "@/lib/nextgen/agenda-view";
// TRAMA — WEEK PLANNER UX REDESIGN (29/09/2026, brief verbatim di
// Fabrizio): logica pura specifica della vista Settimana (range date
// intestazione, riepilogo, dettaglio conflitto) — vedi lib/nextgen/
// week-view.ts per la documentazione completa di ciascuna funzione. Riusa
// (non duplica) buildAgendaRows/mondayOfIso sopra, stesso principio
// "Settimana = Agenda espansa a 7 giorni" del brief (sezione 2).
import {
  formatWeekDateRangeIt,
  overlapsForWeekIndex,
  weekConflictBadgeLabel,
  weekConflictDetailForKid,
  buildWeekSummaryLabel,
  firstConflictedDayIndex,
  // WEEK VIEW V2 (29/09/2026) — vedi lib/nextgen/week-view.ts per la
  // documentazione completa di ciascuna funzione.
  formatSelectedDayHeaderIt,
  selectedDayItemsCountLabel,
  countDayConflicts,
  dayConflictBadgeLabel,
  categoryChipForTramaRow,
  externalKindChip,
  selectedDayIndexInWeek,
} from "@/lib/nextgen/week-view";

// SPRINT 5.2 (NEXTGEN) — Planner, modalità Calendario: "Giorno, settimana e
// mese, con colori per figlio e conflitti evidenziati" (PRD Family Planner).
// Vedi lib/nextgen/calendar-weeks.ts per il limite di dati dichiarato: niente
// vista Giorno con presenza reale (il modello dati copre solo intere
// settimane, non singoli giorni di frequenza) — qui offriamo Mese e
// Settimana, entrambe derivate dalle stesse SeasonWeek già usate in
// Organizzazione, senza nuove query.
//
// SPRINT 5.3 (NEXTGEN) — "Chi fa cosa?" (idea di Fabrizio): integrata nel
// riepilogo settimana già costruito in 5.2, invece di una sesta scheda del
// Planner o di una nuova pagina — il riepilogo mostra già "quale bambino,
// quale settimana", il passo naturale è aggiungere "chi lo accompagna".
// Versione leggera (etichetta libera, non il sistema multi-genitore vero).

// TRAMA — CALENDARIO PLANNER · AGENDA COME SUPERFICIE PRINCIPALE
// (28/09/2026, richiesta di Fabrizio dopo aver mostrato uno screenshot di
// riferimento — un mockup "Calendario prenotazioni" NON di TRAMA, solo
// ispirazione per il pattern visivo "day strip + agenda cronologica"). "mese"
// e "settimana" restano IDENTICHE (nessuna logica toccata, solo rese
// raggiungibili via il toggle + la CTA "Apri calendario completo" sotto);
// "agenda" è il nuovo default all'apertura del pannello Calendario.
// TRAMA — CALENDARIO PLANNER · AGENDA COME SUPERFICIE PRINCIPALE
// (28/09/2026, richiesta di Fabrizio dopo aver mostrato uno screenshot di
// riferimento — un mockup "Calendario prenotazioni" NON di TRAMA, solo
// ispirazione per il pattern visivo "day strip + agenda cronologica"). "mese"
// e "settimana" restano IDENTICHE (nessuna logica toccata, solo rese
// raggiungibili via il toggle + la CTA "Apri calendario completo" sotto);
// "agenda" è il nuovo default all'apertura del pannello Calendario.
type ViewMode = "agenda" | "mese" | "settimana";

const WEEKDAY_SHORT_IT = ["L", "M", "M", "G", "V", "S", "D"];

const DOT_BG: Record<string, string> = {
  sky: "bg-sky",
  aqua: "bg-aqua",
  orange: "bg-orange",
  purple: "bg-purple",
  green: "bg-green",
};

// SPRINT CORRETTIVO — chiave estesa a giorno feriale + momento (vedi
// lib/nextgen/responsibility-options.ts): persone diverse possono occuparsi
// di andata/ritorno in giorni diversi della stessa settimana.
function respKey(kidId: string, weekStartDate: string, weekday: Weekday, moment: Moment): string {
  return `${kidId}__${weekStartDate}__${weekday}__${moment}`;
}

// Stessa tecnica di addDaysIso in lib/nextgen/calendar-weeks.ts, duplicata
// qui (piccola funzione pura) per calcolare la data di Lun/Mar/Mer/Gio/Ven a
// partire dal lunedì della settimana (weekStartDate) — serve solo per
// etichettare le colonne della griglia "Chi fa cosa?" con la data reale.
function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDayMonth(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

// TRAMA — CALENDAR LAYOUT POLISH (28/09/2026, sezione 3 del task): il
// riepilogo giorno/settimana mostrava sempre e solo l'etichetta della
// SeasonWeek ("Settimana N"), anche quando l'utente ha selezionato un
// singolo giorno preciso nella vista Mese — poco leggibile per un'agenda
// giornaliera, e nullo per un giorno fuori stagione (weekLabel null). Data
// completa in italiano ("Lun 28 settembre") per il caso "giorno preciso",
// usata solo dall'header del riepilogo sotto.
function formatFullDayIt(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const label = d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// TRAMA — EXTERNAL PLANNER ITEMS · CALENDAR/AGENDA VISUAL SEMANTICS
// (sezione 7 del task): orario leggibile per un'occorrenza — "Tutto il
// giorno" se all_day, altrimenti "HH:MM" o "HH:MM–HH:MM" se sono note
// entrambe le estremità. Nessun'altra euristica: un orario mancante non
// viene mai inventato.
function formatOccurrenceTime(occ: ExternalCalendarOccurrence): string {
  if (occ.allDay) return "Tutto il giorno";
  if (occ.startTime && occ.endTime) return `${occ.startTime}–${occ.endTime}`;
  if (occ.startTime) return occ.startTime;
  return "Orario da confermare";
}


export default function PlannerCalendarView({
  weeks,
  kids,
  overlaps,
  responsibilities,
  existingShares,
  parentRole,
  familyPeople,
  initialWeekStartDate,
  externalPlannerItems,
}: {
  weeks: SeasonWeek[];
  kids: Kid[];
  overlaps: KidOverlap[];
  responsibilities: WeekResponsibility[];
  existingShares: PlanShare[];
  // TRAMA BETA v1.1.1 (UI Refinement, punto 15) — usato solo per risolvere
  // l'etichetta "Mamma"/"Papà"/"Partner" nel selettore sotto, vedi
  // resolveResponsibleOptions.
  parentRole: ParentRole | null;
  // TRAMA BETA v1.1.1 — FINAL GAP CLOSURE (punto 6/7): persone custom
  // persistenti del genitore ("Zio Marco"...) — [] se
  // supabase/migration_32_family_people.sql non è ancora applicata.
  familyPeople: FamilyPerson[];
  // TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS (§8): deep-link opzionale
  // (da Home o dall'alert di coordinamento del Coverage Hero) verso una
  // settimana specifica — override deterministico della preselezione
  // "settimana corrente" sotto, SOLO se corrisponde a una settimana reale
  // (nessuna settimana inventata da una stringa arbitraria in query string).
  initialWeekStartDate?: string | null;
  // TRAMA — EXTERNAL PLANNER ITEMS · CALENDAR VISIBILITY (28/09/2026): già
  // letti server-side (getExternalPlannerItemsForParent, page.tsx) — stesso
  // dato già passato a <ExternalPlannerItemsSection>, ora anche qui. []
  // finché il flag EXTERNAL_PLANNER_ITEMS_ENABLED non risolve true per
  // questo utente (stesso principio difensivo delle altre capability gated
  // di questa pagina, vedi commento in PlannerClient.tsx).
  externalPlannerItems: ExternalPlannerItem[];
}) {
  const showToast = useNextgenToast();
  // ADAPT: stessa funzione già introdotta per il punto 15 di v1.1.1, ora
  // arricchita con le persone custom persistenti (punto 6) — nessuna nuova
  // opzione tecnica, nessun cambio al valore persistito ("altro" resta
  // "altro" in DB anche per le persone custom, vedi app/actions/
  // responsibilities.ts#resolveFamilyPersonId).
  const responsibleOptions = useMemo(
    () => resolveResponsibleOptions(parentRole, familyPeople),
    [parentRole, familyPeople]
  );
  // TRAMA — CALENDARIO PLANNER · AGENDA COME SUPERFICIE PRINCIPALE: default
  // "agenda" (era "mese") — richiesta esplicita di Fabrizio, la griglia mese
  // resta a un tap di distanza (toggle qui sotto + CTA "Apri calendario
  // completo" in fondo alla vista Agenda).
  const [viewMode, setViewMode] = useState<ViewMode>("agenda");
  // TRAMA — EXTERNAL PLANNER ITEMS · CALENDAR VISIBILITY (28/09/2026): unica
  // espansione range→occorrenze-per-giorno per tutto il componente, riusata
  // sia da buildCalendarMonths (vista Mese) sia da dayFromWeek/dal ramo
  // "Settimana" sotto (via externalOccurrencesInRange) — nessun doppio
  // calcolo divergente.
  const externalByDate = useMemo(
    () => buildExternalOccurrencesByDate(externalPlannerItems, kids),
    [externalPlannerItems, kids]
  );
  const months = useMemo(
    () => buildCalendarMonths(weeks, kids, overlaps, externalByDate),
    [weeks, kids, overlaps, externalByDate]
  );
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  // Vista Agenda — lookup O(1) dateIso→CalendarDay su tutti i mesi stagionali
  // già costruiti da buildCalendarMonths (months sopra): nessun ricalcolo,
  // stessa fonte di dati già usata dalla vista Mese (griglia) e dal ramo
  // "Settimana" (via dayFromWeek). Ogni giorno della stagione (Lun-Dom, non
  // solo i giorni feriali coperti) ha già una cella qui, vedi
  // lib/nextgen/calendar-weeks.ts.
  const cellsByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const m of months) for (const c of m.cells) if (c) map.set(c.dateIso, c);
    return map;
  }, [months]);
  // Un giorno fuori dal range dei mesi stagionali costruiti sopra (es. molto
  // prima/dopo la stagione, dove la famiglia può comunque avere impegni
  // esterni — VISIBILE ≠ COVERED) non ha una cella in cellsByDate: fallback
  // sintetico "giorno vuoto" con solo gli impegni esterni di quella data
  // esatta (stessa fonte externalByDate già usata sopra), covered/dismissed
  // sempre false (nessun booking TRAMA possibile fuori da weeks).
  function agendaCellFor(dateIso: string): CalendarDay {
    return (
      cellsByDate.get(dateIso) ?? {
        dateIso,
        dayOfMonth: Number(dateIso.slice(-2)),
        weekIndex: null,
        weekLabel: null,
        weekStartDate: null,
        weekEndDate: null,
        inSeason: false,
        covered: false,
        dismissed: false,
        kids: [],
        hasConflict: false,
        externalItems: externalByDate.get(dateIso) ?? [],
      }
    );
  }
  // BUGFIX (segnalato da Fabrizio: click sull'alert di coordinamento del
  // Coverage Hero "non fa accadere nulla") — conflictIdx e la costruzione di
  // un CalendarDay da una SeasonWeek erano scritti SOLO dentro l'initializer
  // di useState(selectedDay) (eseguito una sola volta, al mount): un cambio
  // di initialWeekStartDate DOPO il mount (il caso reale del click, che
  // aggiorna lo stato del genitore senza rimontare questo componente — la
  // route resta la stessa) non aveva alcun modo di rientrare qui. Estratti
  // sopra il livello degli useState così sia l'inizializzazione iniziale
  // SIA il nuovo useEffect qui sotto (che reagisce ai cambi successivi)
  // possono riusarli — nessuna logica duplicata.
  const conflictIdx = useMemo(() => {
    function weekIdxFromLabel(label: string): number | null {
      const m = label.match(/\d+/);
      return m ? Number(m[0]) : null;
    }
    return new Set(overlaps.map((o) => weekIdxFromLabel(o.weekLabel)).filter((i): i is number => i !== null));
  }, [overlaps]);
  function dayFromWeek(candidate: SeasonWeek): CalendarDay {
    return {
      dateIso: candidate.startDate,
      dayOfMonth: 0,
      weekIndex: candidate.index,
      weekLabel: candidate.label,
      weekStartDate: candidate.startDate,
      weekEndDate: candidate.endDate,
      inSeason: true,
      covered: candidate.covered,
      dismissed: candidate.dismissed,
      activityName: candidate.activityName,
      kids: candidate.coveredKids
        .map((ck) => kids.find((k) => k.id === ck.kidId))
        .filter((k): k is Kid => Boolean(k))
        .map((k) => ({ kidId: k.id, kidName: k.name, accentColor: k.accentColor ?? "sky" })),
      hasConflict: conflictIdx.has(candidate.index),
      // TRAMA — EXTERNAL PLANNER ITEMS · CALENDAR VISIBILITY (28/09/2026):
      // la vista "Settimana" seleziona un'intera SeasonWeek (non un singolo
      // giorno) — aggreghiamo tutte le occorrenze che cadono nel range
      // [startDate, endDate] di quella settimana, cosi restano visibili
      // anche qui (sezione 1 del task: "DAY DETAIL/AGENDA... gli External
      // Items devono comparire tra gli elementi di quel giorno", qui esteso
      // al riepilogo settimana perché questo componente non ha un vero
      // dettaglio per singolo giorno in questa vista, vedi limite dati
      // dichiarato in lib/nextgen/calendar-weeks.ts).
      externalItems: externalOccurrencesInRange(externalByDate, candidate.startDate, candidate.endDate),
    };
  }
  const [monthKey, setMonthKey] = useState<string>(() => {
    // TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS (§8): stesso deep-link
    // di selectedDay sopra — il mese mostrato di default deve contenere la
    // settimana del gap, altrimenti la riga preselezionata risulterebbe in
    // un mese diverso da quello visibile alla prima apertura.
    if (initialWeekStartDate && weeks.some((w) => w.startDate === initialWeekStartDate)) {
      return initialWeekStartDate.slice(0, 7);
    }
    return defaultMonthKey(months, todayIso);
  });
  // SPRINT CORRETTIVO 2 (01/09/2026, segnalazione di Fabrizio: "è necessario
  // cliccare un giorno per capire che sotto c'è chi fa cosa") — invece di
  // partire vuoto e richiedere un click prima di mostrare qualunque cosa, si
  // preseleziona qui la settimana corrente (quella che contiene la data di
  // oggi, o la prima settimana coperta se oggi cade fuori stagione): il
  // riepilogo "Chi fa cosa?" appare così già alla prima apertura del
  // pannello Calendario, zero click. Resta comunque deselezionabile/
  // cambiabile come prima (stesso setSelectedDay usato dal click su giorno
  // o settimana sotto).
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(() => {
    if (weeks.length === 0) return null;
    // TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS (§8): il deep-link vince
    // sulla preselezione "settimana corrente" di default, ma SOLO se
    // corrisponde davvero a una delle settimane reali passate in weeks —
    // altrimenti si ricade silenziosamente sulla stessa logica di sempre
    // (routing deterministico, nessun crash/stato invalido da una query
    // string manomessa o obsoleta).
    const candidate =
      (initialWeekStartDate ? weeks.find((w) => w.startDate === initialWeekStartDate) : undefined) ??
      weeks.find((w) => !w.dismissed && todayIso >= w.startDate && todayIso <= w.endDate) ??
      weeks.find((w) => !w.dismissed && w.coveredKids.length > 0) ??
      null;
    return candidate ? dayFromWeek(candidate) : null;
  });

  // Vista Agenda — data selezionata nel day strip. STATO INDIPENDENTE da
  // selectedDay sopra (che guida "Mese"/"Settimana" e il relativo pannello
  // di riepilogo "Chi fa cosa?"): tenerli separati evita qualunque rischio
  // di alterare l'inizializzazione/il comportamento già esistenti di
  // selectedDay (usato altrove per bulk-assign/condivisione/deep-link) solo
  // per far posto al nuovo day strip. Preferisce il giorno REALE di oggi se
  // ha contenuto (in stagione o con impegni esterni — VISIBILE ≠ COVERED),
  // altrimenti ricade sullo stesso deep-link/prima-settimana-coperta già
  // usato sopra per selectedDay, cosi le due viste si aprono comunque sulla
  // stessa settimana "di interesse" alla primissima apertura del pannello.
  const [agendaDate, setAgendaDate] = useState<string>(() => {
    if (weeks.length === 0) return todayIso;
    const todayCell = cellsByDate.get(todayIso);
    if (todayCell && (todayCell.inSeason || todayCell.externalItems.length > 0)) return todayIso;
    const candidate =
      (initialWeekStartDate ? weeks.find((w) => w.startDate === initialWeekStartDate) : undefined) ??
      weeks.find((w) => !w.dismissed && todayIso >= w.startDate && todayIso <= w.endDate) ??
      weeks.find((w) => !w.dismissed && w.coveredKids.length > 0) ??
      null;
    return candidate?.startDate ?? todayIso;
  });

  // BUGFIX (segnalato da Fabrizio: click sull'alert di coordinamento "non fa
  // accadere nulla") — reagisce ai cambi di initialWeekStartDate DOPO il
  // mount (il click aggiorna lo stato del genitore, PlannerClient.tsx, senza
  // rimontare questo componente): l'useState sopra copre solo il valore alla
  // primissima apertura del pannello. Pattern "adjusting state when a prop
  // changes" (react.dev) — setState durante il RENDER, non dentro un
  // useEffect: evita un giro di render in più e l'errore di lint
  // react-hooks/set-state-in-effect ("Calling setState synchronously within
  // an effect can trigger cascading renders"), che questo repo tratta come
  // errore bloccante. Stesso identico "vince solo se è una settimana reale"
  // di sopra.
  const [appliedWeekStartDate, setAppliedWeekStartDate] = useState(initialWeekStartDate ?? null);
  if ((initialWeekStartDate ?? null) !== appliedWeekStartDate) {
    setAppliedWeekStartDate(initialWeekStartDate ?? null);
    if (initialWeekStartDate) {
      const candidate = weeks.find((w) => w.startDate === initialWeekStartDate);
      if (candidate) {
        setMonthKey(candidate.startDate.slice(0, 7));
        setSelectedDay(dayFromWeek(candidate));
        // TRAMA — AGENDA COME DEFAULT: un deep-link (es. click sull'alert di
        // coordinamento del Coverage Hero) punta a una settimana precisa —
        // porta l'utente sulla vista Mese (dove il riepilogo/bulk-assign
        // sono raggiungibili), stesso comportamento di quando "mese" era il
        // default. agendaDate resta comunque allineato, cosi se l'utente
        // torna in Agenda vede lo stesso periodo.
        setAgendaDate(candidate.startDate);
        setViewMode("mese");
      }
    }
  }

  // Stato locale delle assegnazioni "Chi fa cosa?", inizializzato dal prop e
  // aggiornato in modo ottimistico dopo ogni salvataggio — evita di dover
  // ricaricare la pagina per vedere subito il risultato.
  const [localResp, setLocalResp] = useState<Record<string, WeekResponsibility>>(() => {
    const map: Record<string, WeekResponsibility> = {};
    for (const r of responsibilities) map[respKey(r.kidId, r.weekStartDate, r.weekday, r.moment)] = r;
    return map;
  });
  const [assigningKey, setAssigningKey] = useState<string | null>(null);
  // PLANNER BETA v1.1 (Wave 3, punto 18) — "quando un giorno contiene più
  // attività/bambini, mostra una sola activity card espansa alla volta": in
  // questo componente il "blocco attività" per un giorno/settimana
  // selezionata è il riquadro per-bambino sotto (selectedDay.kids.map),
  // finora sempre tutti espansi insieme quando la famiglia ha più di un
  // figlio. null = nessuna scelta esplicita ancora fatta per questa
  // selezione: si ricade sul primo bambino (vedi effectiveExpandedKidId
  // nel render), senza bisogno di un useEffect per re-inizializzare lo
  // stato ad ogni cambio di selectedDay.
  const [expandedKidKey, setExpandedKidKey] = useState<string | null>(null);
  const [altroText, setAltroText] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function handleAssign(
    kidId: string,
    weekStartDate: string,
    weekday: Weekday,
    moment: Moment,
    value: ResponsibleValue,
    label?: string,
    // TRAMA BETA v1.1.1 — FINAL GAP CLOSURE: id di una persona persistente
    // già nota (tap su una chip del selettore) — assente quando si assegna
    // Io/Mamma-Papà-Partner/Nonno/Nonna/Tata, o quando si digita un nome
    // nuovo nella "Altro" generica (in quel caso il server fa find-or-create).
    familyPersonId?: string
  ) {
    const key = respKey(kidId, weekStartDate, weekday, moment);
    setSavingKey(key);
    const res = await setResponsibilityAction(kidId, weekStartDate, weekday, moment, value, label, familyPersonId);
    setSavingKey(null);
    if (res.error) {
      showToast(res.error);
      return;
    }
    setLocalResp((prev) => ({
      ...prev,
      [key]: {
        kidId,
        weekStartDate,
        weekday,
        moment,
        responsible: value,
        responsibleLabel: value === "altro" ? label ?? null : null,
        familyPersonId: value === "altro" ? familyPersonId ?? null : null,
      },
    }));
    setAssigningKey(null);
    setAltroText("");
    showToast("Assegnato!");
  }

  async function handleClear(kidId: string, weekStartDate: string, weekday: Weekday, moment: Moment) {
    const key = respKey(kidId, weekStartDate, weekday, moment);
    setSavingKey(key);
    const res = await clearResponsibilityAction(kidId, weekStartDate, weekday, moment);
    setSavingKey(null);
    if (res.error) {
      showToast(res.error);
      return;
    }
    setLocalResp((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setAssigningKey(null);
  }

  // FEEDBACK DI FABRIZIO: "bisogna aggiungere qualcosa che permetta di
  // applicare rapidamente l'assegnazione su tutta la settimana ed
  // eventualmente applicarla anche ai due figli — non è detto che siano da
  // gestire diversamente o insieme". Di default tutti i bambini della
  // settimana sono INCLUSI (il caso più comune, "gestiti insieme"): si
  // tracciano solo le ESCLUSIONI esplicite, cosi un genitore con un solo
  // figlio non vede alcun controllo in più.
  const [bulkKidExcluded, setBulkKidExcluded] = useState<Record<string, boolean>>({});
  // FEEDBACK SUCCESSIVO DI FABRIZIO: "ci vuole qualcosa di flessibile" —
  // oltre ai bambini, anche solo Andata, solo Ritorno, o entrambi.
  //
  // TRAMA BETA v1.1.1 (FINAL FUNCTIONAL + UI CONSISTENCY FIXES, punto 8-13)
  // — segnalazione: toccare "Andata" lo mostrava barrato, controintuitivo
  // ("mi aspetto che toccare Andata significhi applicarla, non escluderla").
  // ROOT CAUSE (vedi lib/nextgen/bulk-assign.ts): non era solo visivo, la
  // logica stessa era ad ESCLUSIONE (default = tutto incluso senza toccare
  // nulla, il tap escludeva). Cambiato in modello a SELEZIONE POSITIVA:
  // default = NESSUN momento selezionato, il tap SELEZIONA (seconda volta
  // deseleziona) — "selezionato" ora significa "verrà applicato", mai
  // "escluso". L'assegnazione a una persona resta disabilitata finché
  // nessun momento è selezionato (isBulkAssignReady), niente più
  // applicazione ambigua implicita di entrambi i momenti di default.
  // Il modello ad esclusione dei BAMBINI (sotto, bulkKidExcluded) resta
  // INVARIATO: lì "escluso" è semanticamente corretto (il default
  // "gestiti insieme" non è mai stato segnalato come confuso) — vedi
  // commento originale di Fabrizio qui sopra.
  const [bulkMomentsSelected, setBulkMomentsSelected] = useState<Record<Moment, boolean>>({} as Record<Moment, boolean>);
  const [bulkAssigningAltro, setBulkAssigningAltro] = useState(false);
  const [bulkAltroText, setBulkAltroText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  // TRAMA BETA v1.1.1 (UI Refinement, punto 12 — "Bulk assign non deve
  // essere protagonista") — "Applica a tutta la settimana" è un'azione di
  // accelerazione, non la prima cosa che il genitore deve vedere aprendo un
  // giorno. Default COLLASSATO; le opzioni esistenti (bambini/momento/
  // responsabile) restano identiche, solo dietro un toggle.
  const [bulkOpen, setBulkOpen] = useState(false);

  function toggleBulkKid(kidId: string) {
    setBulkKidExcluded((prev) => ({ ...prev, [kidId]: !prev[kidId] }));
  }

  function toggleBulkMoment(moment: Moment) {
    setBulkMomentsSelected((prev) => toggleInMap(prev, moment) as Record<Moment, boolean>);
  }

  // TRAMA — WEEK PLANNER UX REDESIGN (29/09/2026, brief di Fabrizio, sezione
  // 10 "Applica a tutta la settimana"): questa funzione leggeva SOLO
  // selectedDay (impostato esclusivamente dal click su un giorno/settimana
  // della vista Mese) — la nuova vista Settimana (sotto) non usa più
  // selectedDay (per restare completamente indipendente da Mese, punto 19
  // del brief "non toccare Mese"), quindi il bersaglio dell'azione bulk è
  // ora un parametro esplicito. Il chiamante di Mese (invariato) continua a
  // passare selectedDay.weekStartDate/selectedDay.kids — stesso identico
  // comportamento di prima, zero cambi funzionali per quella vista.
  async function handleBulkAssign(
    targetWeekStartDate: string,
    targetKids: { kidId: string }[],
    value: ResponsibleValue,
    label?: string,
    familyPersonId?: string
  ) {
    const weekStartDate = targetWeekStartDate;
    const kidIds = targetKids.map((k) => k.kidId).filter((id) => !bulkKidExcluded[id]);
    const moments = selectedMoments(bulkMomentsSelected);
    if (kidIds.length === 0) {
      showToast("Seleziona almeno un bambino");
      return;
    }
    if (moments.length === 0) {
      showToast("Seleziona almeno Andata o Ritorno");
      return;
    }
    setBulkBusy(true);
    const res = await setWeekBulkResponsibilityAction(kidIds, weekStartDate, moments, value, label, familyPersonId);
    setBulkBusy(false);
    if (res.error) {
      showToast(res.error);
      return;
    }
    setLocalResp((prev) => {
      const next = { ...prev };
      for (const kidId of kidIds) {
        for (const wd of WEEKDAYS) {
          for (const moment of moments) {
            const key = respKey(kidId, weekStartDate, wd.value, moment);
            next[key] = {
              kidId,
              weekStartDate,
              weekday: wd.value,
              moment,
              responsible: value,
              responsibleLabel: value === "altro" ? label ?? null : null,
              familyPersonId: value === "altro" ? familyPersonId ?? null : null,
            };
          }
        }
      }
      return next;
    });
    setAssigningKey(null);
    setBulkAssigningAltro(false);
    setBulkAltroText("");
    const momentsLabel =
      moments.length === 1 ? ` (solo ${MOMENTS.find((mo) => mo.value === moments[0])?.label})` : "";
    showToast(
      kidIds.length > 1
        ? `Assegnato a tutta la settimana per entrambi i bambini${momentsLabel}!`
        : `Assegnato a tutta la settimana${momentsLabel}!`
    );
  }

  // WEEK VIEW V2 (29/09/2026, brief verbatim di Fabrizio dopo la validazione
  // live del redesign precedente) — requisito esplicito "NO anchor
  // scrolling, NO full page jump" (sezione 4/16 del nuovo brief): il vecchio
  // ref-per-giorno + scrollIntoView di WEEK PLANNER UX REDESIGN è stato
  // rimosso. Il "giorno selezionato" della vista Settimana resta lo stesso
  // `agendaDate` già condiviso con la vista Agenda (comportamento voluto,
  // invariato dal redesign precedente — vedi commento sopra il ramo
  // "settimana"): toccare un giorno dello strip cambia SOLO quello stato, il
  // contenuto sotto lo strip sticky cambia "sul posto", nessuno scroll
  // programmatico.

  // SPRINT 5.3 — "Condivisione Piano": link pubblico di sola lettura per il
  // mese visualizzato o per una singola settimana (dal riepilogo). Niente
  // periodo personalizzato in questa fase (nessun date-picker): due scope
  // ben definiti, coerenti con "logistica leggera" — un intervallo libero è
  // un buon candidato per un prossimo sprint.
  const [shares, setShares] = useState<PlanShare[]>(existingShares);
  const [sharingScope, setSharingScope] = useState<{ start: string; end: string; defaultLabel: string } | null>(
    null
  );
  const [shareLabel, setShareLabel] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareResultUrl, setShareResultUrl] = useState<string | null>(null);
  // FIX (segnalazione live di Fabrizio, 02/09/2026: "non sembra funzionare" /
  // "neanche il tasto Condividi") — il bottone Condividi ha SEMPRE
  // funzionato lato stato (openShare imposta sharingScope, invariato), ma il
  // pannello "Condividi piano" è renderizzato in fondo alla card, DOPO tutto
  // il contenuto "Chi fa cosa?" — che nel refinement v1.1.1 (punto 11) è
  // diventato più alto quando ci sono più bambini/giorni assegnati. Su
  // schermo il pannello si apriva correttamente ma FUORI dallo schermo
  // visibile, senza scroll automatico: sembrava che il tasto non facesse
  // nulla. sharePanelRef + scrollIntoView porta il pannello in vista appena
  // si apre, stesso comportamento sia per "Condividi {mese}" sia per
  // "Condividi" (settimana).
  const sharePanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (sharingScope) {
      sharePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [sharingScope]);

  function openShare(start: string, end: string, defaultLabel: string) {
    setSharingScope({ start, end, defaultLabel });
    setShareLabel(defaultLabel);
    setShareResultUrl(null);
  }

  async function handleCreateShare() {
    if (!sharingScope) return;
    setShareBusy(true);
    const res = await createPlanShareAction(sharingScope.start, sharingScope.end, shareLabel);
    setShareBusy(false);
    if (res.error || !res.url || !res.id) {
      showToast(res.error ?? "Errore nella creazione del link");
      return;
    }
    setShareResultUrl(res.url);
    const now = new Date();
    setShares((prev) => [
      {
        id: res.id!,
        token: "",
        label: shareLabel.trim() || null,
        scopeStart: sharingScope.start,
        scopeEnd: sharingScope.end,
        createdAt: now.toISOString(),
        revokedAt: null,
        // Fix privacy 06/08/2026: rispecchia il default DB (30gg) solo per
        // l'ottimistic update — il valore reale arriva al prossimo reload.
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      ...prev,
    ]);
  }

  async function handleRevokeShare(id: string) {
    const res = await revokePlanShareAction(id);
    if (res.error) {
      showToast(res.error);
      return;
    }
    setShares((prev) => prev.filter((s) => s.id !== id));
    showToast("Link revocato");
  }

  async function copyToClipboard(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copiato!");
    } catch {
      showToast("Non sono riuscito a copiare — seleziona e copia il link manualmente");
    }
  }

  const monthIndex = months.findIndex((m) => m.key === monthKey);
  const activeMonth = months[monthIndex] ?? months[0] ?? null;

  // Scope di condivisione per il mese visualizzato: primo/ultimo giorno IN
  // STAGIONE del mese (non 1/fine mese solare, per non includere giorni fuori
  // dalla stagione nei mesi di confine).
  const monthShareScope = useMemo(() => {
    if (!activeMonth) return null;
    const inSeasonCells = activeMonth.cells.filter((c): c is CalendarDay => Boolean(c && c.inSeason));
    if (inSeasonCells.length === 0) return null;
    return { start: inSeasonCells[0].dateIso, end: inSeasonCells[inSeasonCells.length - 1].dateIso };
  }, [activeMonth]);

  if (weeks.length === 0 || !activeMonth) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-6 text-center">
        <i className="ti ti-calendar mb-2 text-2xl text-ink-3" />
        <p className="text-xs text-ink-2">Nessuna settimana stagionale disponibile.</p>
      </div>
    );
  }

  // Legenda colori per bambino — stessa tecnica del chip selettore bambino
  // già usato altrove nel Planner (kid.accentColor), qui mostrata come
  // legenda fissa (non richiede alcuna selezione).
  const kidLegend = kids.map((k) => {
    const dot = months
      .flatMap((m) => m.cells)
      .find((c) => c?.kids.some((ck) => ck.kidId === k.id))
      ?.kids.find((ck) => ck.kidId === k.id);
    return { kidId: k.id, kidName: k.name, accentColor: dot?.accentColor };
  });

  return (
    // TRAMA BETA v1.1.1 (FINAL VISUAL CONFORMANCE PASS, punto 6) — gap
    // verticale fra i blocchi (selettore/legenda/calendario/riepilogo)
    // ridotto da 3 (12px) a 2.5 (10px): stesso contenuto, meno "aria" prima
    // che la parte operativa (riepilogo giorno/settimana) sia raggiungibile.
    <div className="flex flex-col gap-2.5">
      {/* Selettore Agenda/Mese/Settimana — "Agenda" aggiunta come nuova
          prima opzione (default all'apertura, vedi useState viewMode
          sopra): "Mese" e "Settimana" restano IDENTICHE e raggiungibili qui
          esattamente come prima. */}
      <div className="flex gap-2" data-testid="planner-view-mode-selector">
        {(
          [
            { key: "agenda", label: "Agenda" },
            { key: "mese", label: "Mese" },
            { key: "settimana", label: "Settimana" },
          ] as { key: ViewMode; label: string }[]
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            data-testid={`view-mode-${opt.key}`}
            onClick={() => {
              setViewMode(opt.key);
              setSelectedDay(null);
            }}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold active:scale-95 ${
              viewMode === opt.key ? "bg-trama-violet text-white" : "bg-bg text-ink-2"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {viewMode === "agenda" && (
        <div className="flex flex-col gap-2.5" data-testid="planner-agenda-view">
          {/* Day strip — navigazione per settimana (frecce ±7 giorni) +
              striscia orizzontale scrollabile dei 7 giorni della settimana
              che contiene agendaDate. Lo scroll è confinato al div sotto
              (overflow-x-auto), MAI alla pagina intera (nessun overflow-x su
              elementi genitori qui) — requisito mobile-first (~360-390px). */}
          <div className="rounded-2xl bg-white p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAgendaDate((d) => addDaysIso(d, -7))}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-2 active:scale-95"
                aria-label="Settimana precedente"
              >
                <i className="ti ti-chevron-left text-[15px]" />
              </button>
              <div className="flex flex-col items-center">
                <div className="font-poppins text-sm font-bold text-ink">{formatMonthYearIt(agendaDate)}</div>
                {agendaDate !== todayIso && (
                  <button
                    type="button"
                    onClick={() => setAgendaDate(todayIso)}
                    className="text-[10.5px] font-semibold text-trama-violet active:opacity-70"
                  >
                    Vai a oggi
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAgendaDate((d) => addDaysIso(d, 7))}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-2 active:scale-95"
                aria-label="Settimana successiva"
              >
                <i className="ti ti-chevron-right text-[15px]" />
              </button>
            </div>

            <div
              className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
              data-testid="agenda-day-strip"
              style={{ scrollbarWidth: "none" }}
            >
              {Array.from({ length: 7 }, (_, i) => addDaysIso(mondayOfIso(agendaDate), i)).map((dateIso) => {
                const cell = agendaCellFor(dateIso);
                const isSelected = dateIso === agendaDate;
                const isToday = dateIso === todayIso;
                const hasContent =
                  (cell.covered && !cell.dismissed && cell.kids.length > 0) || cell.externalItems.length > 0;
                const d = new Date(dateIso + "T00:00:00Z");
                const weekdayIdx = (d.getUTCDay() + 6) % 7;
                return (
                  <button
                    key={dateIso}
                    type="button"
                    data-testid={`agenda-day-${dateIso}`}
                    onClick={() => setAgendaDate(dateIso)}
                    className={`flex flex-shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] active:scale-95 ${
                      isSelected
                        ? "bg-trama-violet text-white"
                        : isToday
                          ? "border border-trama-violet text-ink"
                          : "text-ink-2"
                    }`}
                  >
                    <span className="text-[9.5px] font-bold uppercase tracking-wide">
                      {WEEKDAY_SHORT3_IT[weekdayIdx]}
                    </span>
                    <span className="font-poppins text-[13px] font-bold">{Number(dateIso.slice(-2))}</span>
                    <span
                      className={`h-1 w-1 rounded-full ${
                        hasContent ? (isSelected ? "bg-white" : "bg-trama-violet") : "bg-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Agenda cronologica del giorno selezionato — TRAMA + Esterno
              nella STESSA lista (stesso principio "domini separati,
              presentation layer unificato" di buildAgendaRows sopra), righe
              ordinate per orario, distinte solo da bordo/badge. */}
          <div className="rounded-2xl border border-[#E8EBF0] bg-white p-4" data-testid="agenda-day-list">
            <div className="mb-2.5 font-poppins text-[13px] font-bold text-ink">{formatFullDayIt(agendaDate)}</div>
            {(() => {
              const cell = agendaCellFor(agendaDate);
              const rows = buildAgendaRows(cell);
              if (cell.dismissed) {
                return <p className="text-[12.5px] text-ink-2">Segnata come &quot;non ti serve&quot;.</p>;
              }
              if (rows.length === 0) {
                return <p className="text-[12.5px] text-ink-2">Nessun impegno per questo giorno.</p>;
              }
              return (
                <div className="flex flex-col gap-2">
                  {rows.map((row, idx) => {
                    if (row.kind === "trama") {
                      return (
                        <button
                          key={`trama-${row.kidId}-${idx}`}
                          type="button"
                          data-testid="agenda-row-trama"
                          onClick={() => {
                            // "Gestisci" — apre la vista Mese con questo
                            // giorno selezionato: stesso pannello di
                            // riepilogo/bulk-assign/condivisione già
                            // esistente, nessuna logica duplicata qui (vista
                            // Agenda resta un pass di presentazione, non di
                            // dati/azioni — punto 3 del task).
                            setViewMode("mese");
                            setMonthKey(agendaDate.slice(0, 7));
                            setSelectedDay(cell);
                          }}
                          className={`flex items-start gap-3 rounded-xl border-l-4 p-2.5 text-left active:scale-[0.99] ${
                            AGENDA_BORDER_BG[row.accentColor] ?? AGENDA_BORDER_BG.sky
                          }`}
                        >
                          <div className="w-16 flex-shrink-0 text-[10px] font-bold text-ink-3">Tutto il giorno</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12.5px] font-bold text-ink">{row.title}</div>
                            <div className="flex items-center gap-1 text-[11px] text-ink-2">
                              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${DOT_BG[row.accentColor]}`} />
                              {row.kidName}
                            </div>
                            {cell.hasConflict && (
                              <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-[#9a6b00]">
                                <i className="ti ti-alert-triangle text-[11px]" />
                                Sovrapposizione
                              </div>
                            )}
                          </div>
                          <i className="ti ti-chevron-right mt-0.5 flex-shrink-0 text-[13px] text-ink-3" />
                        </button>
                      );
                    }
                    const occ = row.occ;
                    return (
                      <div
                        key={`ext-${occ.itemId}-${idx}`}
                        data-testid="agenda-row-external"
                        className={`flex items-start gap-3 rounded-xl border-l-4 p-2.5 ${AGENDA_EXTERNAL_BORDER_BG}`}
                      >
                        <div className="w-16 flex-shrink-0 text-[10px] font-bold text-ink-3">
                          {formatOccurrenceTime(occ)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-white px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink-3">
                              Esterno
                            </span>
                            {occ.sourceType === "curated_discovery" && (
                              <span className="text-[10px] font-medium text-ink-3">Da Scoperta TRAMA</span>
                            )}
                          </div>
                          <div className="text-[12.5px] font-bold text-ink">{occ.title}</div>
                          {occ.kidNames.length > 0 && (
                            <div className="text-[11px] text-ink-2">{occ.kidNames.join(", ")}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* CTA — porta alla griglia mese esistente, MAI eliminata: resta
                la vista secondaria/estesa raggiungibile da qui e dal
                selettore sopra (punto 2 del task). */}
            <button
              type="button"
              data-testid="open-full-calendar-cta"
              onClick={() => {
                setViewMode("mese");
                setMonthKey(agendaDate.slice(0, 7));
              }}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-bg px-4 py-2.5 text-[12px] font-bold text-trama-violet active:scale-[0.97]"
            >
              Apri calendario completo
              <i className="ti ti-chevron-right text-[13px]" />
            </button>
          </div>
        </div>
      )}

      {/* TRAMA — AGENDA COME SUPERFICIE PRINCIPALE: legenda, griglia
          Mese/Settimana e pannello di riepilogo "Chi fa cosa?" restano
          IDENTICI (nessuna riga toccata sotto), solo nascosti mentre
          viewMode è "agenda" — la vista Agenda ha la propria legenda
          cromatica implicita nel bordo di ogni card, e il riepilogo
          dettagliato resta raggiungibile passando da "Mese"/"Settimana"
          (toggle sopra) o dalla CTA/riga "Gestisci" della vista Agenda. */}
      {viewMode !== "agenda" && (
      <>
      {/* Legenda per bambino
          TRAMA BETA v1.1.1 (UI Refinement, punto 10) — legenda più
          compatta (meno padding/gap): stessa informazione, meno spazio
          verticale prima del calendario vero e proprio.
          TRAMA — CALENDAR LAYOUT POLISH (28/09/2026, sezione 3/7 del task):
          aggiunta la voce "Esterno" — stesso marker (trattino violetto)
          disegnato sulle celle del mese sotto, cosi la legenda spiega
          SUBITO cosa significa senza dover prima aprire un giorno. */}
      {(kids.length > 0 || externalPlannerItems.length > 0) && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-white px-3 py-2">
          {kidLegend.map((k) => (
            <div key={k.kidId} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${DOT_BG[k.accentColor ?? "sky"]}`} />
              <span className="text-[11.5px] font-semibold text-ink-2">{k.kidName}</span>
            </div>
          ))}
          {externalPlannerItems.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="h-[3px] w-3 rounded-full bg-trama-violet/60" />
              <span className="text-[11.5px] font-semibold text-ink-2">Esterno</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <i className="ti ti-alert-triangle text-[13px] text-[#9a6b00]" />
            <span className="text-[11px] text-ink-3">Sovrapposizione</span>
          </div>
        </div>
      )}

      {viewMode === "mese" ? (
        <div className="rounded-2xl bg-white p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <button
              type="button"
              disabled={monthIndex <= 0}
              onClick={() => setMonthKey(months[Math.max(0, monthIndex - 1)].key)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-2 active:scale-95 disabled:opacity-30"
              aria-label="Mese precedente"
            >
              <i className="ti ti-chevron-left text-[15px]" />
            </button>
            {/* TRAMA — CALENDAR LAYOUT POLISH (28/09/2026, sezione 3
                "DAY STRIP/DATE NAVIGATION" del task) — "Oggi" mostrato solo
                quando il mese visualizzato NON è già quello di oggi (nessun
                bottone inutile quando si sta già guardando il mese
                corrente): un salto rapido, senza dover premere ripetutamente
                le frecce mese per mese per tornare al presente. */}
            <div className="flex flex-col items-center">
              <div className="font-poppins text-sm font-bold text-ink">{activeMonth.label}</div>
              {/* Mostrato solo se il mese di oggi esiste davvero tra i mesi
                  stagionali disponibili (months) — altrimenti sarebbe un
                  bottone che non porta da nessuna parte (es. oggi è fuori
                  stagione). */}
              {activeMonth.key !== todayIso.slice(0, 7) && months.some((m) => m.key === todayIso.slice(0, 7)) && (
                <button
                  type="button"
                  onClick={() => setMonthKey(todayIso.slice(0, 7))}
                  className="text-[10.5px] font-semibold text-trama-violet active:opacity-70"
                >
                  Vai a oggi
                </button>
              )}
            </div>
            <button
              type="button"
              disabled={monthIndex >= months.length - 1}
              onClick={() => setMonthKey(months[Math.min(months.length - 1, monthIndex + 1)].key)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-2 active:scale-95 disabled:opacity-30"
              aria-label="Mese successivo"
            >
              <i className="ti ti-chevron-right text-[15px]" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAY_SHORT_IT.map((d, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-ink-3">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {activeMonth.cells.map((cell, i) => {
              if (!cell) return <div key={i} className="aspect-square" />;
              const isToday = cell.dateIso === todayIso;
              const isSelected = selectedDay?.dateIso === cell.dateIso;
              // TRAMA — EXTERNAL PLANNER ITEMS · CALENDAR VISIBILITY
              // (28/09/2026): un impegno esterno è indipendente dalla
              // stagione TRAMA (sezione 1 del task — VISIBILE ≠ COVERED, e
              // una famiglia può avere un impegno anche fuori stagione/in un
              // weekend, giorni normalmente non cliccabili perché
              // !inSeason). La cella resta cliccabile se ha almeno un
              // impegno esterno, anche quando cell.inSeason è false — questo
              // NON tocca in alcun modo cell.covered/dismissed.
              const hasExternal = cell.externalItems.length > 0;
              const clickable = cell.inSeason || hasExternal;
              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  disabled={!clickable}
                  onClick={() => setSelectedDay(isSelected ? null : cell)}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] active:scale-95 ${
                    isSelected
                      ? "bg-trama-lilac/20 font-bold text-ink"
                      : isToday
                        ? "border border-trama-violet font-semibold text-ink"
                        : cell.inSeason
                          ? "text-ink"
                          : hasExternal
                            ? "text-ink-2"
                            : "text-ink-3/50"
                  }`}
                >
                  <span>{cell.dayOfMonth}</span>
                  {cell.kids.length > 0 && (
                    <span className="mt-0.5 flex gap-0.5">
                      {cell.kids.slice(0, 3).map((k) => (
                        <span key={k.kidId} className={`h-1.5 w-1.5 rounded-full ${DOT_BG[k.accentColor]}`} />
                      ))}
                    </span>
                  )}
                  {/* Indicatore "Esterno" (sezione 1/7 del task) — marker
                      SECONDARIO e visivamente distinto dai pallini colorati
                      per bambino sopra (mai lo stesso linguaggio visivo di
                      un booking TRAMA): un piccolo trattino violetto sotto i
                      pallini, non un pallino colorato aggiuntivo che si
                      confonderebbe con la copertura bambino. */}
                  {hasExternal && (
                    <span
                      className="mt-0.5 h-[3px] w-3 rounded-full bg-trama-violet/60"
                      aria-label="Impegno esterno"
                    />
                  )}
                  {cell.hasConflict && (
                    <i className="ti ti-alert-triangle absolute -right-0.5 -top-0.5 text-[10px] text-[#9a6b00]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* SPRINT 5.3 — Condivisione Piano: link pubblico di sola lettura
              per il mese visualizzato.
              TRAMA BETA v1.1.1 (UI Refinement, punto 13) — "Condividi
              {mese}" e "Condividi" (settimana, sotto) non devono competere
              come CTA primarie: la primary action del Calendario è
              organizzare le responsabilità, non condividere.
              TRAMA BETA v1.1.1 (FINAL VISUAL CONFORMANCE PASS, punto 6) —
              ancora troppo "pillola" per essere davvero terziario: rimossa
              la pillola di sfondo (bg-trama-lilac/20), resta solo testo +
              icona, stesso trattamento di un link secondario del prodotto
              (es. "Vedi tutte le settimane" in PlannerClient.tsx). Stessa
              funzionalità/azione (openShare), spazio verticale sopra
              ridotto (mt-3→mt-2). */}
          {monthShareScope && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => openShare(monthShareScope.start, monthShareScope.end, activeMonth.label)}
                className="flex items-center gap-1 rounded-full px-1 py-1 text-[11px] font-semibold text-trama-violet active:bg-black/[0.04]"
              >
                <i className="ti ti-share text-[12px]" />
                Condividi {activeMonth.label}
              </button>
            </div>
          )}
        </div>
      ) : (
        // TRAMA — WEEK VIEW V2 (29/09/2026, brief verbatim di Fabrizio dopo
        // aver validato dal vivo il redesign precedente — "WEEK PLANNER UX
        // REDESIGN", commit 6ad1b86/63446ac/602652d — e trovato un limite
        // reale: 7 sezioni-giorno impilate verticalmente si comportavano più
        // come una lunga lista che come un calendario, lo strip settimanale
        // spariva scrollando, le card erano ancora alte). Nuovo modello
        // mentale (sezione 2 del nuovo brief): WEEK = navigatore settimanale
        // STICKY + agenda del SOLO giorno selezionato sotto — ispirato a
        // Google Calendar/Outlook, MAI un clone: linguaggio visivo TRAMA.
        // Riusa AL 100% la logica pura già esistente per Agenda/Settimana
        // (mondayOfIso/addDaysIso/buildAgendaRows/agendaCellFor,
        // overlapsForWeekIndex/weekConflictBadgeLabel/weekConflictDetailForKid/
        // buildWeekSummaryLabel/firstConflictedDayIndex) + le nuove funzioni
        // pure aggiunte in lib/nextgen/week-view.ts per V2
        // (formatSelectedDayHeaderIt/selectedDayItemsCountLabel/
        // countDayConflicts/dayConflictBadgeLabel/categoryChipForTramaRow/
        // externalKindChip/selectedDayIndexInWeek) — zero terzo motore di
        // rendering (sezione 29 del brief). Il "giorno selezionato" resta lo
        // stesso `agendaDate` già condiviso con Agenda (comportamento voluto,
        // invariato). NON legge/scrive mai `selectedDay` (esclusivo di Mese).
        //
        // GOVERNANCE — WEEK OVERVIEW (sezione 18 del brief): l'alternanza
        // "GIORNO | PANORAMICA" (una vera overview calendario, non la vecchia
        // lista a 7 sezioni) NON è implementata in questo pass — il brief
        // stesso la marca esplicitamente P1 se aumenta materialmente la
        // complessità ("implementa solo la forte esperienza selected-day
        // ora"). Idem per lo swipe orizzontale opzionale (sezione 17,
        // "benvenuto solo se semplice e robusto... NON necessario"): il tap
        // sullo strip resta l'unica interazione, nessuna gesture aggiunta in
        // questo pass. Entrambe le scelte sono riportate nel report finale.
        (() => {
          const weekMonday = mondayOfIso(agendaDate);
          const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(weekMonday, i));
          const activeWeek = weeks.find((w) => w.startDate === weekMonday) ?? null;
          const weekDayCells = weekDates.map((d) => agendaCellFor(d));
          const weekDayRows = weekDayCells.map((c) => buildAgendaRows(c));
          // Sezione 21 del brief (CONFLICT DATA AUDIT) — RICONFERMATO leggendo
          // per intero lib/nextgen/planner-insights.ts#computeKidOverlaps
          // prima di scrivere questo blocco: KidOverlap è per
          // kidId+weekId(=intera SeasonWeek), MAI per singolo giorno/orario —
          // nessun booking TRAMA porta un giorno o un orario reali nel
          // modello dati odierno (stessa ROOT CAUSE ANALYSIS già documentata
          // nel redesign precedente, invariata: lib/nextgen/
          // calendar-weeks.ts#buildCalendarMonths marca hasConflict su OGNI
          // giorno feriale della stessa SeasonWeek). "il giorno ha un
          // conflitto reale" (sezione 4/20, indicatore ⚠ sullo strip e
          // sull'header del giorno selezionato) significa quindi, con onestà
          // verso il dato: "in QUESTO giorno compare una card TRAMA di un
          // bambino che risulta doppio-prenotato in QUESTA settimana" — mai
          // un conflitto orario preciso fabbricato (sezione 20: "17:30–18:00
          // si sovrappone a..." NON è mostrato, perché quel dato non esiste).
          const weekOverlaps = overlapsForWeekIndex(overlaps, activeWeek?.index ?? null);
          const weekConflictedKidIds = new Set(weekOverlaps.map((o) => o.kidId));
          const conflictBadge = weekConflictBadgeLabel(weekOverlaps.length);
          const summaryLabel = buildWeekSummaryLabel(weekDayRows, weekOverlaps.length);
          const firstConflictIdx = firstConflictedDayIndex(weekDayRows, weekConflictedKidIds);
          const weekKidsForBulk = activeWeek
            ? (activeWeek.coveredKids
                .map((ck) => kids.find((k) => k.id === ck.kidId))
                .filter((k): k is Kid => Boolean(k)))
            : [];

          // Sezione 5/16 — "il contenuto sotto lo strip cambia SUL POSTO,
          // no anchor scroll, no page jump": nessun ref/scrollIntoView (a
          // differenza del redesign precedente), il giorno selezionato è
          // derivato SOLO da `agendaDate`. selectedIdx -1 (agendaDate fuori
          // da questa settimana) non dovrebbe mai accadere — weekDates è
          // sempre calcolato dalla stessa agendaDate — ma un fallback a Lun
          // (indice 0) evita un crash se mai capitasse.
          const selectedIdxRaw = selectedDayIndexInWeek(weekDates, agendaDate);
          const selectedIdx = selectedIdxRaw === -1 ? 0 : selectedIdxRaw;
          const selectedDateIso = weekDates[selectedIdx];
          const selectedCell = weekDayCells[selectedIdx];
          const selectedRows = weekDayRows[selectedIdx];
          const selectedItemsLabel = selectedDayItemsCountLabel(selectedRows);
          const selectedConflictCount = countDayConflicts(selectedRows, weekConflictedKidIds);
          const selectedConflictLabel = dayConflictBadgeLabel(selectedConflictCount);
          const selectedWeekdayDef = activeWeek
            ? WEEKDAYS.find((wd) => addDaysIso(activeWeek.startDate, wd.dayOffset) === selectedDateIso)
            : undefined;

          return (
            <div className="flex flex-col gap-2.5" data-testid="planner-week-view">
              {/* Sezione 14 (brief precedente, mantenuta) — selettore
                  compatto per saltare direttamente a una settimana
                  stagionale. NON sticky di proposito (uso occasionale, resta
                  fuori dall'area fissa per tenerla minima — sezione 27). */}
              {weeks.length > 1 && (
                <select
                  aria-label="Vai a settimana"
                  data-testid="week-picker-select"
                  value={activeWeek?.startDate ?? ""}
                  onChange={(e) => {
                    if (e.target.value) setAgendaDate(e.target.value);
                  }}
                  className="w-full rounded-xl border border-[#E8EBF0] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-2"
                >
                  {!activeWeek && (
                    <option value="" disabled>
                      Fuori stagione
                    </option>
                  )}
                  {weeks.map((w) => (
                    <option key={w.index} value={w.startDate}>
                      Sett. {w.index} — {w.dateRange}
                      {w.dismissed ? " · Non ti serve" : w.coveredKids.length === 0 ? " · Da organizzare" : ""}
                    </option>
                  ))}
                </select>
              )}

              {/* Sezioni 3/4/27 — STICKY WEEK NAVIGATOR: header (Sett. N +
                  range su una riga sola, sezione 3 "avoid duplicated info")
                  + day strip, uniti nello stesso pannello sticky così restano
                  visibili insieme mentre il giorno selezionato sotto scrolla.
                  top-[57px] = altezza reale dell'header mobile sticky di
                  DashboardLayout.tsx (icona 32px + py-3 24px + bordo 1px,
                  z-30) verificata leggendo il sorgente prima di scrivere
                  questo blocco — z-20 (sotto l'header app) evita qualunque
                  sovrapposizione di layer; md:top-0 perché su desktop
                  quell'header è md:hidden (nessun ingombro sopra). bg-white
                  pieno (mai trasparente): deve coprire le card che scorrono
                  sotto. */}
              <div
                className="sticky top-[57px] z-20 rounded-2xl bg-white p-3.5 md:top-0"
                data-testid="week-sticky-navigator"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setAgendaDate((d) => addDaysIso(d, -7))}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-bg text-ink-2 active:scale-95"
                    aria-label="Settimana precedente"
                  >
                    <i className="ti ti-chevron-left text-[15px]" />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col items-center">
                    <div
                      className="truncate font-poppins text-[12.5px] font-bold uppercase text-ink"
                      data-testid="week-date-range"
                    >
                      {activeWeek ? `Sett. ${activeWeek.index} / ` : ""}
                      {formatWeekDateRangeIt(weekMonday)}
                    </div>
                    {weekMonday !== mondayOfIso(todayIso) && (
                      <button
                        type="button"
                        onClick={() => setAgendaDate(todayIso)}
                        className="text-[10.5px] font-semibold text-trama-violet active:opacity-70"
                      >
                        Vai a oggi
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAgendaDate((d) => addDaysIso(d, 7))}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-bg text-ink-2 active:scale-95"
                    aria-label="Settimana successiva"
                  >
                    <i className="ti ti-chevron-right text-[15px]" />
                  </button>
                </div>

                {/* Sezione 4/16 — day strip: 7 giorni, data reale sempre
                    visibile, oggi ≠ selezionato ≠ giorno con impegni/
                    conflitto, tap cambia SOLO agendaDate (nessuno scroll). */}
                <div
                  className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1"
                  data-testid="week-day-strip"
                  style={{ scrollbarWidth: "none" }}
                >
                  {weekDates.map((dateIso, i) => {
                    const isSelected = i === selectedIdx;
                    const isToday = dateIso === todayIso;
                    const rows = weekDayRows[i];
                    const hasContent = rows.length > 0;
                    const dayHasConflict = rows.some(
                      (row) => row.kind === "trama" && weekConflictedKidIds.has(row.kidId)
                    );
                    return (
                      <button
                        key={dateIso}
                        type="button"
                        data-testid={`week-day-${dateIso}`}
                        aria-current={isSelected ? "date" : undefined}
                        onClick={() => setAgendaDate(dateIso)}
                        className={`flex flex-shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] active:scale-95 ${
                          isSelected
                            ? "bg-trama-violet text-white"
                            : isToday
                              ? "border border-trama-violet text-ink"
                              : "text-ink-2"
                        }`}
                      >
                        <span className="text-[9.5px] font-bold uppercase tracking-wide">{WEEKDAY_SHORT3_IT[i]}</span>
                        <span className="font-poppins text-[13px] font-bold">{Number(dateIso.slice(-2))}</span>
                        {dayHasConflict ? (
                          <i
                            className={`ti ti-alert-triangle text-[11px] ${isSelected ? "text-white" : "text-[#9a6b00]"}`}
                          />
                        ) : (
                          <span
                            className={`h-1 w-1 rounded-full ${
                              hasContent ? (isSelected ? "bg-white" : "bg-trama-violet") : "bg-transparent"
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sezione 20/22 — badge conflitto SETTIMANA: STATUS, non una
                  CTA (niente stile pulsante primario) — tappabile SOLO
                  perché porta navigazione reale (cambia il giorno
                  selezionato al primo giorno interessato, senza scroll). */}
              {conflictBadge && (
                <button
                  type="button"
                  data-testid="week-conflict-badge"
                  onClick={() => {
                    if (firstConflictIdx !== null) setAgendaDate(weekDates[firstConflictIdx]);
                  }}
                  className="flex items-center gap-1.5 self-start rounded-full bg-[#FFF6E5] px-3 py-1.5 text-[11.5px] font-bold text-[#9a6b00] active:scale-[0.98]"
                >
                  <i className="ti ti-alert-triangle text-[13px]" />
                  {conflictBadge}
                </button>
              )}

              {/* Sezioni 5/6/7/23 — SELECTED DAY: SOLO il giorno selezionato
                  è renderizzato qui sotto (nessun'altra sezione-giorno nella
                  pagina — requisito esplicito "no other day sections should
                  be rendered below"). */}
              <div className="rounded-2xl bg-white p-3.5" data-testid="week-selected-day">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="font-poppins text-[13px] font-bold uppercase text-ink" data-testid="week-selected-day-header">
                    {formatSelectedDayHeaderIt(selectedDateIso)}
                  </span>
                  {selectedDateIso === todayIso && (
                    <span className="rounded-full bg-trama-violet/10 px-1.5 py-0.5 text-[9.5px] font-bold text-trama-violet">
                      Oggi
                    </span>
                  )}
                  {selectedItemsLabel && <span className="text-[11px] font-semibold text-ink-3">· {selectedItemsLabel}</span>}
                  {selectedConflictLabel && (
                    <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#9a6b00]">
                      <i className="ti ti-alert-triangle text-[11px]" />
                      {selectedConflictLabel}
                    </span>
                  )}
                </div>

                {selectedCell.dismissed ? (
                  <p className="text-[12px] text-ink-2">Segnata come &quot;non ti serve&quot;.</p>
                ) : selectedRows.length === 0 ? (
                  // Sezione 23 — empty state compatto: "Nessun impegno /
                  // martedì 29 settembre" + CTA esistente "+Aggiungi
                  // impegno" (stessa azione già disponibile in
                  // <ExternalPlannerItemsSection>, PlannerClient.tsx — questa
                  // vista Calendario non duplica quel form, coerente col
                  // principio "riuso, non un terzo motore").
                  <div className="rounded-xl border border-dashed border-[#D8DEE8] py-4 text-center">
                    <i className="ti ti-calendar-off mb-1 text-xl text-ink-3" />
                    <p className="text-[12px] text-ink-2">Nessun impegno</p>
                    <p className="text-[10.5px] text-ink-3">{formatSelectedDayHeaderIt(selectedDateIso)}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {selectedRows.map((row, rowIdx) => {
                      if (row.kind === "trama") {
                        // Sezione 14 (nuovo brief) — Andata/Ritorno restano
                        // ESATTAMENTE nello stesso perimetro di prima (kid
                        // TRAMA-coperto in QUESTA SeasonWeek, giorno feriale
                        // Lun-Ven) e SOLO sulla card TRAMA — non estesi agli
                        // impegni Esterni (governance esplicita, invariata).
                        const kid = kids.find((k) => k.id === row.kidId);
                        const conflictDetail = weekConflictDetailForKid(weekOverlaps, row.kidId, kid?.gender);
                        const categoryChip = categoryChipForTramaRow(row);
                        return (
                          <div
                            key={`trama-${row.kidId}-${rowIdx}`}
                            data-testid="week-row-trama"
                            className={`rounded-xl border-l-4 p-2 ${AGENDA_BORDER_BG[row.accentColor] ?? AGENDA_BORDER_BG.sky}`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="w-[52px] flex-shrink-0 text-[9.5px] font-bold uppercase leading-tight text-ink-3">
                                Tutto
                                <br />
                                il giorno
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[12.5px] font-bold text-ink">{row.title}</div>
                                {/* Sezione 8 — gerarchia visiva: PRIMARIO
                                    (pallino colore bambino, già esistente,
                                    invariato) · SOURCE come badge esplicito
                                    "TRAMA" · categoria SOLO come cue
                                    secondario (emoji+etichetta piccola, mai
                                    un colore pieno sulla card — sezione 8 del
                                    brief). Ogni distinzione resta anche
                                    testuale/iconica, mai solo colore
                                    (sezione 13 accessibilità). */}
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-2">
                                  <span className="flex items-center gap-1">
                                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${DOT_BG[row.accentColor]}`} />
                                    {row.kidName}
                                  </span>
                                  <span className="rounded-full bg-bg px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink-3">
                                    TRAMA
                                  </span>
                                  {categoryChip && (
                                    <span className="text-[10.5px] text-ink-3" data-testid="week-category-chip">
                                      {categoryChip.emoji} {categoryChip.label}
                                    </span>
                                  )}
                                </div>
                                {conflictDetail && (
                                  <div className="mt-1 flex items-start gap-1 text-[10.5px] font-semibold text-[#9a6b00]">
                                    <i className="ti ti-alert-triangle mt-[1px] flex-shrink-0 text-[11px]" />
                                    {conflictDetail}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Andata/Ritorno compatti — stessa identica
                                azione (handleAssign/handleClear/
                                assigningKey/localResp) già in uso da Mese. */}
                            {selectedWeekdayDef && activeWeek && (
                              <div className="mt-1.5 flex items-center gap-1.5 border-t border-black/[0.04] pt-1.5">
                                {MOMENTS.map((mo, moIdx) => {
                                  const key = respKey(row.kidId, activeWeek.startDate, selectedWeekdayDef.value, mo.value);
                                  const current = localResp[key];
                                  const currentOption = current
                                    ? responsibleOptions.find((o) => o.value === current.responsible)
                                    : null;
                                  const currentLabel = current
                                    ? current.responsible === "altro"
                                      ? current.responsibleLabel || "Altro"
                                      : currentOption?.label
                                    : null;
                                  const isAssigning = assigningKey === key;
                                  return (
                                    <span key={key} className="flex min-w-0 flex-1 items-center gap-1">
                                      {moIdx > 0 && (
                                        <i className="ti ti-arrow-narrow-right flex-shrink-0 text-[11px] text-ink-3" />
                                      )}
                                      <button
                                        type="button"
                                        title={mo.label}
                                        onClick={() => {
                                          setAssigningKey(isAssigning ? null : key);
                                          setAltroText(
                                            current?.responsible === "altro" ? current.responsibleLabel ?? "" : ""
                                          );
                                        }}
                                        className={`flex min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11px] font-semibold active:scale-[0.97] ${
                                          isAssigning
                                            ? "bg-trama-lilac/20 ring-1 ring-trama-violet"
                                            : current
                                              ? "bg-[#F4F6FA] text-ink"
                                              : "bg-bg text-ink-3"
                                        }`}
                                      >
                                        <span className="sr-only">{mo.label}</span>
                                        {current ? (
                                          <>
                                            {currentOption?.emoji ?? ""} {currentLabel}
                                          </>
                                        ) : (
                                          `+ ${mo.label}`
                                        )}
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {selectedWeekdayDef &&
                              activeWeek &&
                              MOMENTS.some(
                                (mo) => assigningKey === respKey(row.kidId, activeWeek.startDate, selectedWeekdayDef.value, mo.value)
                              ) && (
                                <div className="mt-2 flex flex-col gap-2 rounded-xl bg-bg p-2.5">
                                  {(() => {
                                    const [, , weekdayStr, momentStr] = (assigningKey as string).split("__");
                                    const weekday = weekdayStr as Weekday;
                                    const moment = momentStr as Moment;
                                    const current = localResp[assigningKey as string];
                                    return (
                                      <>
                                        <div className="flex flex-wrap gap-1.5">
                                          {responsibleOptions.map((opt) => (
                                            <button
                                              key={opt.familyPersonId ?? opt.value}
                                              type="button"
                                              disabled={savingKey === assigningKey}
                                              onClick={() => {
                                                if (opt.value === "altro" && !opt.familyPersonId) return;
                                                handleAssign(
                                                  row.kidId,
                                                  activeWeek.startDate,
                                                  weekday,
                                                  moment,
                                                  opt.value,
                                                  opt.familyPersonId ? opt.label : undefined,
                                                  opt.familyPersonId
                                                );
                                              }}
                                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold active:scale-95 ${
                                                current?.responsible === opt.value &&
                                                (opt.value !== "altro" || current?.responsibleLabel === opt.label)
                                                  ? "bg-trama-violet text-white"
                                                  : "bg-white text-ink-2"
                                              }`}
                                            >
                                              {opt.emoji} {opt.label}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            type="text"
                                            value={altroText}
                                            onChange={(e) => setAltroText(e.target.value)}
                                            placeholder="Altro: scrivi chi (es. Zia Carla)"
                                            className="min-w-0 flex-1 rounded-lg border border-[#E8EBF0] bg-white px-2.5 py-1.5 text-[11.5px] text-ink"
                                          />
                                          <button
                                            type="button"
                                            disabled={savingKey === assigningKey || !altroText.trim()}
                                            onClick={() =>
                                              handleAssign(row.kidId, activeWeek.startDate, weekday, moment, "altro", altroText)
                                            }
                                            className="flex-shrink-0 rounded-lg bg-trama-violet px-2.5 py-1.5 text-[11px] font-bold text-white active:scale-[0.97] disabled:opacity-40"
                                          >
                                            OK
                                          </button>
                                        </div>
                                        {current && (
                                          <button
                                            type="button"
                                            disabled={savingKey === assigningKey}
                                            onClick={() => handleClear(row.kidId, activeWeek.startDate, weekday, moment)}
                                            className="self-start text-[11px] font-semibold text-ink-3 active:bg-black/[0.04]"
                                          >
                                            Rimuovi assegnazione
                                          </button>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                          </div>
                        );
                      }
                      const occ = row.occ;
                      const kindChip = externalKindChip(occ.kind);
                      return (
                        <div
                          key={`ext-${occ.itemId}-${rowIdx}`}
                          data-testid="week-row-external"
                          className={`rounded-xl border-l-4 p-2 ${AGENDA_EXTERNAL_BORDER_BG}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-[52px] flex-shrink-0 text-[9.5px] font-bold uppercase leading-tight text-ink-3">
                              {formatOccurrenceTime(occ)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[12.5px] font-bold text-ink">{occ.title}</div>
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-2">
                                {occ.kidNames.length > 0 && <span>{occ.kidNames.join(", ")}</span>}
                                <span className="rounded-full bg-white px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink-3">
                                  Esterno
                                </span>
                                <span className="text-[10.5px] text-ink-3" data-testid="week-category-chip-external">
                                  {kindChip.emoji} {kindChip.label}
                                </span>
                              </div>
                              {occ.sourceType === "curated_discovery" && (
                                <div className="mt-0.5 text-[10px] font-medium text-ink-3">Da Scoperta TRAMA</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sezione 24 — riepilogo SETTIMANA, sottile e opzionale (mai
                  vanity metrics/CTA grande) — distinto dal conteggio del
                  giorno selezionato sopra. */}
              {summaryLabel && (
                <div className="rounded-2xl bg-white px-3.5 py-2.5 text-center text-[11.5px] font-semibold text-ink-2">
                  {summaryLabel}
                </div>
              )}

              {/* Sezione 26 — "Applica accompagnamento alla settimana":
                  stessa identica azione (setWeekBulkResponsibilityAction) già
                  in uso da Mese — invariata, resta a livello di intera
                  SeasonWeek (non del solo giorno selezionato). */}
              {weekKidsForBulk.length > 0 && activeWeek && (
                <div className="rounded-xl bg-white" data-testid="week-bulk-assign-panel">
                  <button
                    type="button"
                    onClick={() => setBulkOpen((v) => !v)}
                    className="flex w-full items-center justify-between gap-1.5 rounded-xl px-3.5 py-3 text-[11.5px] font-bold text-trama-violet active:bg-black/[0.04]"
                  >
                    <span className="flex items-center gap-1.5">
                      <i className="ti ti-bolt text-[13px]" />
                      Applica accompagnamento alla settimana
                    </span>
                    <i className={`ti ti-chevron-${bulkOpen ? "up" : "down"} text-[13px] text-ink-3`} />
                  </button>
                  {bulkOpen && (
                    <div className="px-3.5 pb-3.5">
                      {weekKidsForBulk.length > 1 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {weekKidsForBulk.map((k) => {
                            const included = !bulkKidExcluded[k.id];
                            return (
                              <button
                                key={k.id}
                                type="button"
                                onClick={() => toggleBulkKid(k.id)}
                                className={`flex items-center gap-1.5 rounded-full bg-bg px-2.5 py-1 text-[11px] font-semibold active:scale-95 ${
                                  included ? "text-ink" : "text-ink-3 line-through"
                                }`}
                              >
                                <span className={`h-2 w-2 rounded-full ${DOT_BG[k.accentColor ?? "sky"]}`} />
                                {k.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="mb-1.5 flex flex-wrap gap-2">
                        {MOMENTS.map((mo) => {
                          const selected = bulkMomentsSelected[mo.value] === true;
                          return (
                            <button
                              key={mo.value}
                              type="button"
                              onClick={() => toggleBulkMoment(mo.value)}
                              aria-pressed={selected}
                              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors active:scale-95 ${
                                selected ? "bg-trama-violet text-white" : "bg-bg text-ink-2"
                              }`}
                            >
                              <i className={`ti ${mo.icon} text-[11px]`} />
                              {mo.label}
                            </button>
                          );
                        })}
                      </div>
                      {!isBulkAssignReady(bulkMomentsSelected) && (
                        <p className="mb-1.5 text-[10.5px] font-medium text-ink-3">
                          Seleziona Andata, Ritorno o entrambi
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {responsibleOptions.map((opt) => (
                          <button
                            key={opt.familyPersonId ?? opt.value}
                            type="button"
                            disabled={bulkBusy || !isBulkAssignReady(bulkMomentsSelected)}
                            onClick={() => {
                              if (opt.value === "altro" && !opt.familyPersonId) {
                                setBulkAssigningAltro(true);
                                return;
                              }
                              handleBulkAssign(
                                activeWeek.startDate,
                                weekKidsForBulk.map((k) => ({ kidId: k.id })),
                                opt.value,
                                opt.familyPersonId ? opt.label : undefined,
                                opt.familyPersonId
                              );
                            }}
                            className="rounded-full bg-bg px-2.5 py-1 text-[11px] font-semibold text-ink-2 active:scale-95 disabled:opacity-50"
                          >
                            {opt.emoji} {opt.label}
                          </button>
                        ))}
                      </div>
                      {isBulkAssignReady(bulkMomentsSelected) && (
                        <p className="mt-1.5 text-[10px] text-ink-3">
                          Sostituisce eventuali assegnazioni già presenti nei giorni selezionati.
                        </p>
                      )}
                      {bulkAssigningAltro && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={bulkAltroText}
                            onChange={(e) => setBulkAltroText(e.target.value)}
                            placeholder="Altro: scrivi chi (es. Zia Carla)"
                            className="min-w-0 flex-1 rounded-lg border border-[#E8EBF0] bg-white px-2.5 py-1.5 text-[11.5px] text-ink"
                          />
                          <button
                            type="button"
                            disabled={bulkBusy || !bulkAltroText.trim()}
                            onClick={() =>
                              handleBulkAssign(
                                activeWeek.startDate,
                                weekKidsForBulk.map((k) => ({ kidId: k.id })),
                                "altro",
                                bulkAltroText
                              )
                            }
                            className="flex-shrink-0 rounded-lg bg-trama-violet px-2.5 py-1.5 text-[11px] font-bold text-white active:scale-[0.97] disabled:opacity-40"
                          >
                            OK
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sezione 17 — Condividi: stessa identica azione (openShare)
                  già in uso da Mese, qui nell'area utility della settimana,
                  mai in competizione visiva con le card attività. */}
              {activeWeek && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => openShare(activeWeek.startDate, activeWeek.endDate, `Sett. ${activeWeek.index}`)}
                    className="flex items-center gap-1 rounded-full px-1 py-1 text-[11px] font-semibold text-trama-violet active:bg-black/[0.04]"
                  >
                    <i className="ti ti-share text-[12px]" />
                    Condividi
                  </button>
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* Riepilogo del giorno selezionato — SOLO vista Mese (la vista
          Settimana, sopra, ha il proprio riepilogo/Applica/Condividi
          autonomi, indipendenti da `selectedDay`). */}
      {viewMode === "mese" && selectedDay && (
        <div className="rounded-2xl border border-[#E8EBF0] bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            {/* TRAMA — CALENDAR LAYOUT POLISH (28/09/2026): quando la
                selezione è un giorno preciso della vista Mese
                (dayOfMonth>0), il titolo mostra la data reale — "Lun 28
                settembre" — non più solo "Settimana N", più leggibile come
                intestazione di un'agenda giornaliera. La vista Settimana
                (dayOfMonth===0) resta invariata: mostra l'etichetta della
                SeasonWeek come sempre. */}
            <div>
              <div className="font-poppins text-[13px] font-bold text-ink">
                {selectedDay.dayOfMonth > 0 ? formatFullDayIt(selectedDay.dateIso) : (selectedDay.weekLabel ?? "Settimana")}
              </div>
              {selectedDay.dayOfMonth > 0 && selectedDay.weekLabel && (
                <div className="text-[10.5px] text-ink-3">{selectedDay.weekLabel}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedDay.hasConflict && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-[#9a6b00]">
                  <i className="ti ti-alert-triangle text-[13px]" />
                  Sovrapposizione
                </span>
              )}
              {/* SPRINT 5.3 — Condivisione Piano: link pubblico per questa
                  singola settimana.
                  TRAMA BETA v1.1.1 (FINAL VISUAL CONFORMANCE PASS, punto 6)
                  — stesso trattamento terziario applicato a "Condividi
                  {mese}" sopra: niente pillola di sfondo, solo testo+icona. */}
              {!selectedDay.dismissed && selectedDay.weekStartDate && selectedDay.weekEndDate && (
                <button
                  type="button"
                  onClick={() =>
                    openShare(
                      selectedDay.weekStartDate!,
                      selectedDay.weekEndDate!,
                      selectedDay.weekLabel ?? "Settimana"
                    )
                  }
                  className="flex items-center gap-1 rounded-full px-1 py-1 text-[11px] font-semibold text-trama-violet active:bg-black/[0.04]"
                >
                  <i className="ti ti-share text-[12px]" />
                  Condividi
                </button>
              )}
            </div>
          </div>

          {/* TRAMA — EXTERNAL PLANNER ITEMS · CALENDAR/DAY AGENDA (sezione 1
              del task, "DAY DETAIL/AGENDA... gli External Items devono
              comparire tra gli elementi di quel giorno") — blocco
              INDIPENDENTE dal ramo dismissed/kids sotto (che riguarda SOLO
              la copertura TRAMA): un impegno esterno resta visibile qui
              anche in una settimana "non ti serve" o senza alcun bambino
              coperto da booking TRAMA — coerente con VISIBILE ≠ COVERED
              (questo blocco non legge/scrive mai covered/dismissed).
              Ordinati per data poi per orario (gli "tutto il giorno" prima,
              stessa convenzione leggibile di un'agenda reale), cosi anche la
              vista Settimana (che aggrega più giorni in un'unica lista) resta
              coerente con l'ordine cronologico reale. */}
          {selectedDay.externalItems.length > 0 && (
            <div className="mb-3 flex flex-col gap-1.5 rounded-xl bg-bg p-2.5">
              <div className="mb-0.5 flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-ink-3">
                <i className="ti ti-calendar-event text-[12px]" />
                Impegni esterni
              </div>
              {[...selectedDay.externalItems]
                .sort((a, b) => {
                  if (a.dateIso !== b.dateIso) return a.dateIso.localeCompare(b.dateIso);
                  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
                  return (a.startTime ?? "").localeCompare(b.startTime ?? "");
                })
                .map((occ, idx) => (
                  <div
                    key={`${occ.itemId}__${occ.dateIso}__${idx}`}
                    className="flex flex-col gap-0.5 rounded-lg bg-white px-2.5 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Vista Settimana: più giorni aggregati nella stessa
                          lista, la data della singola occorrenza evita
                          ambiguità su "quale giorno" (vista Mese: sempre lo
                          stesso giorno del selettore, la data è ridondante
                          e viene omessa per restare compatta). */}
                      {selectedDay.dayOfMonth === 0 && (
                        <span className="rounded-full bg-[#F4F6FA] px-1.5 py-0.5 text-[10px] font-bold text-ink-3">
                          {formatDayMonth(occ.dateIso)}
                        </span>
                      )}
                      {/* Grammatica visuale "Esterno" — MAI lo stesso badge
                          di un'attività TRAMA (sezione 7/11 del task): stesso
                          trattamento già in uso in
                          ExternalPlannerItemsSection.tsx (lista "I tuoi
                          impegni"), riusato qui identico per coerenza. */}
                      <span className="rounded-full bg-[#F4F6FA] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-3">
                        Esterno
                      </span>
                      {occ.sourceType === "curated_discovery" && (
                        <span className="text-[10px] font-medium text-ink-3">Da Scoperta TRAMA</span>
                      )}
                      {!occ.isRangeStart || !occ.isRangeEnd ? (
                        <span className="text-[10px] font-medium text-trama-violet">
                          {occ.isRangeStart ? "Inizia oggi" : occ.isRangeEnd ? "Ultimo giorno" : "In corso"}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink">
                      <i
                        className={`ti ${occ.kind === "activity" ? "ti-ball-football" : "ti-calendar-event"} text-[13px] text-trama-violet`}
                      />
                      {occ.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-2">
                      <span className="flex items-center gap-1">
                        <i className="ti ti-clock text-[11px] text-ink-3" />
                        {formatOccurrenceTime(occ)}
                      </span>
                      {occ.kidNames.length > 0 && (
                        <span className="flex items-center gap-1">
                          <i className="ti ti-users text-[11px] text-ink-3" />
                          {occ.kidNames.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {selectedDay.dismissed ? (
            <p className="text-[12.5px] text-ink-2">Segnata come &quot;non ti serve&quot;.</p>
          ) : selectedDay.kids.length > 0 ? (
            <div className="flex flex-col gap-3">
              {/* FEEDBACK DI FABRIZIO — applicazione rapida a tutta la
                  settimana (5 giorni × andata/ritorno) in un colpo solo,
                  opzionalmente su più bambini insieme: "non è detto che
                  siano da gestire diversamente o insieme". Un solo upsert
                  multiplo (setWeekBulkResponsibilityAction), non 10-20
                  chiamate singole. */}
              {selectedDay.weekStartDate && (
                <div className="rounded-xl bg-bg" data-testid="bulk-assign-panel">
                  {/* TRAMA BETA v1.1.1 (punto 12) — collassato di default:
                      questa è un'accelerazione, non la prima cosa vista.
                      TRAMA BETA v1.1.1 (punto 9) — sfondo neutro (bg-bg),
                      non più lilla: il lilla pieno resta riservato alla CTA
                      primaria e allo stato "selezionato". */}
                  <button
                    type="button"
                    onClick={() => setBulkOpen((v) => !v)}
                    className="flex w-full items-center justify-between gap-1.5 rounded-xl px-3 py-2 text-[11.5px] font-bold text-trama-violet active:bg-black/[0.04]"
                  >
                    <span className="flex items-center gap-1.5">
                      <i className="ti ti-bolt text-[13px]" />
                      Applica a tutta la settimana
                    </span>
                    <i className={`ti ti-chevron-${bulkOpen ? "up" : "down"} text-[13px] text-ink-3`} />
                  </button>
                  {bulkOpen && (
                    <div className="px-3 pb-3">
                      {selectedDay.kids.length > 1 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {selectedDay.kids.map((k) => {
                            const included = !bulkKidExcluded[k.kidId];
                            return (
                              <button
                                key={k.kidId}
                                type="button"
                                onClick={() => toggleBulkKid(k.kidId)}
                                className={`flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold active:scale-95 ${
                                  included ? "text-ink" : "text-ink-3 line-through"
                                }`}
                              >
                                <span className={`h-2 w-2 rounded-full ${DOT_BG[k.accentColor]}`} />
                                {k.kidName}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* FEEDBACK SUCCESSIVO DI FABRIZIO: "ci vuole qualcosa
                          di flessibile" — solo Andata, solo Ritorno, o
                          entrambi.
                          TRAMA BETA v1.1.1 (FINAL FUNCTIONAL + UI
                          CONSISTENCY FIXES, punto 8-13) — modello a
                          SELEZIONE POSITIVA: nessun momento selezionato di
                          default, tap per selezionare/deselezionare
                          (secondo tap = deseleziona). Selezionato = violetto
                          pieno (stato NextGen chiaro), non selezionato =
                          chip neutra/secondaria. MAI line-through: qui
                          "selezionato" significa sempre "verrà applicato",
                          mai "escluso" (vedi bulk-assign.ts per la ROOT
                          CAUSE ANALYSIS completa). */}
                      <div className="mb-1.5 flex flex-wrap gap-2">
                        {MOMENTS.map((mo) => {
                          const selected = bulkMomentsSelected[mo.value] === true;
                          return (
                            <button
                              key={mo.value}
                              type="button"
                              onClick={() => toggleBulkMoment(mo.value)}
                              aria-pressed={selected}
                              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors active:scale-95 ${
                                selected ? "bg-trama-violet text-white" : "bg-white text-ink-2"
                              }`}
                            >
                              <i className={`ti ${mo.icon} text-[11px]`} />
                              {mo.label}
                            </button>
                          );
                        })}
                      </div>
                      {/* Nessun momento selezionato: l'assegnazione a una
                          persona sarebbe ambigua (punto 12) — bottoni
                          disabilitati + micro-hint, nessuna nuova modale. */}
                      {!isBulkAssignReady(bulkMomentsSelected) && (
                        <p className="mb-1.5 text-[10.5px] font-medium text-ink-3">
                          Seleziona Andata, Ritorno o entrambi
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {/* TRAMA BETA v1.1.1 — FINAL GAP CLOSURE (punto 6/7):
                            una chip con opt.familyPersonId è una persona
                            custom già persistente — tap diretto, nessun
                            testo da digitare (già nota). La voce generica
                            "Altro" (ultima della lista, senza
                            familyPersonId) resta invariata: apre l'input
                            libero, il server fa find-or-create sul nome
                            digitato (app/actions/responsibilities.ts). */}
                        {responsibleOptions.map((opt) => (
                          <button
                            key={opt.familyPersonId ?? opt.value}
                            type="button"
                            disabled={bulkBusy || !isBulkAssignReady(bulkMomentsSelected)}
                            onClick={() => {
                              if (opt.value === "altro" && !opt.familyPersonId) {
                                setBulkAssigningAltro(true);
                                return;
                              }
                              handleBulkAssign(
                                selectedDay.weekStartDate!,
                                selectedDay.kids,
                                opt.value,
                                opt.familyPersonId ? opt.label : undefined,
                                opt.familyPersonId
                              );
                            }}
                            className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-2 active:scale-95 disabled:opacity-50"
                          >
                            {opt.emoji} {opt.label}
                          </button>
                        ))}
                      </div>
                      {/* TRAMA BETA v1.1.1 (punto 8-13, ultimo punto —
                          "comportamento overwrite deve essere intenzionale/
                          comprensibile, documentato") — setWeekBulkResponsibilityAction
                          fa un upsert su parent_id,kid_id,week_start_date,
                          weekday,moment: sovrascrive DAVVERO ogni assegnazione
                          già presente nei giorni/momenti selezionati. Coerente
                          con l'etichetta stessa del pulsante ("tutta la
                          settimana") — non è un comportamento nascosto, ma va
                          reso esplicito qui invece che silenzioso. Nessuna
                          nuova modale di conferma: il rischio è comprensibile
                          dalla sola etichetta + questa riga, non "genuinely
                          dangerous" al punto da giustificare un blocco. */}
                      {isBulkAssignReady(bulkMomentsSelected) && (
                        <p className="mt-1.5 text-[10px] text-ink-3">
                          Sostituisce eventuali assegnazioni già presenti nei giorni selezionati.
                        </p>
                      )}
                      {bulkAssigningAltro && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={bulkAltroText}
                            onChange={(e) => setBulkAltroText(e.target.value)}
                            placeholder="Altro: scrivi chi (es. Zia Carla)"
                            className="min-w-0 flex-1 rounded-lg border border-[#E8EBF0] bg-white px-2.5 py-1.5 text-[11.5px] text-ink"
                          />
                          <button
                            type="button"
                            disabled={bulkBusy || !bulkAltroText.trim()}
                            onClick={() =>
                              handleBulkAssign(selectedDay.weekStartDate!, selectedDay.kids, "altro", bulkAltroText)
                            }
                            className="flex-shrink-0 rounded-lg bg-trama-violet px-2.5 py-1.5 text-[11px] font-bold text-white active:scale-[0.97] disabled:opacity-40"
                          >
                            OK
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* PLANNER BETA v1.1 (Wave 3, punto 18) — con più di un
                  bambino coperto lo stesso giorno/settimana, una sola card
                  resta espansa alla volta (le altre diventano header
                  compatti cliccabili): meno densità visiva quando la
                  famiglia ha più figli. Con un solo bambino il
                  comportamento resta identico a prima (sempre espanso,
                  nessun header da cliccare). effectiveExpandedKidId
                  ricade sul primo bambino della selezione corrente se
                  expandedKidKey è vuoto o si riferisce a un bambino non più
                  presente (es. dopo aver cambiato giorno/settimana) — senza
                  bisogno di un useEffect di re-inizializzazione. */}
              {(() => {
                const effectiveExpandedKidId =
                  selectedDay.kids.length <= 1
                    ? (selectedDay.kids[0]?.kidId ?? null)
                    : (selectedDay.kids.some((k) => k.kidId === expandedKidKey)
                        ? expandedKidKey
                        : (selectedDay.kids[0]?.kidId ?? null));
                return selectedDay.kids.map((k) => {
                const weekStartDate = selectedDay.weekStartDate;
                const isExpanded = k.kidId === effectiveExpandedKidId;

                if (!isExpanded) {
                  return (
                    <button
                      key={k.kidId}
                      type="button"
                      onClick={() => setExpandedKidKey(k.kidId)}
                      className="flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5 text-left active:bg-black/[0.04]"
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${DOT_BG[k.accentColor]}`} />
                      <span className="flex-1 text-[12.5px] font-semibold text-ink">{k.kidName}</span>
                      <i className="ti ti-chevron-down text-[14px] text-ink-3" />
                    </button>
                  );
                }

                return (
                  <div key={k.kidId} className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => selectedDay.kids.length > 1 && setExpandedKidKey(null)}
                      className="flex items-center gap-2 text-left text-[12.5px]"
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${DOT_BG[k.accentColor]}`} />
                      <span className="font-semibold text-ink">{k.kidName}</span>
                      <span className="text-ink-2">{selectedDay.activityName ?? "attività prenotata"}</span>
                      {selectedDay.kids.length > 1 && (
                        <i className="ti ti-chevron-up ml-auto text-[14px] text-ink-3" />
                      )}
                    </button>

                    {/* SPRINT CORRETTIVO 2 (01/09/2026, seconda segnalazione
                        ripetuta di Fabrizio dopo la live QA: "è necessario
                        cliccare un giorno per capire che sotto c'è chi fa
                        cosa..e poi la logica di 'barrare' andata/ritorno o
                        chi lo fa è di difficile comprensione") — la vecchia
                        griglia 5 giorni × 2 momenti (celle 7×7px con solo
                        un'emoji o un puntino "·", correlazione riga/colonna
                        a memoria) è sostituita da un elenco verticale, un
                        riquadro per giorno feriale, con due bottoni "Andata"/
                        "Ritorno" a piena etichetta: mostrano subito icona +
                        nome di chi è assegnato, o "+ Assegna" se il giorno è
                        scoperto — niente più da decifrare al volo. Il
                        pannello di scelta (RESPONSIBLE_OPTIONS) resta la
                        stessa logica di prima (stesso handleAssign/
                        handleClear, stesso assigningKey), ma ora appare
                        subito SOTTO il giorno cliccato invece che in fondo
                        all'intera griglia — meno probabile perdersi tra
                        quale cella si sta modificando. */}
                    {/* TRAMA BETA v1.1.1 (UI Refinement, punto 11 —
                        "Chi fa cosa: nuovo layout compatto") — la card
                        precedente (SPRINT CORRETTIVO 2, sopra) usava un
                        riquadro alto con due bottoni a piena etichetta per
                        giorno: leggibile ma pesante quando si guarda tutta
                        la settimana insieme. Stessa identica logica/azioni
                        (handleAssign/handleClear/assigningKey/localResp,
                        NON toccate — punto 17: "non modificare il calcolo
                        child-day") — solo una riga per giorno: etichetta
                        giorno a sinistra, poi Andata → Ritorno affiancati
                        con icona/emoji della persona assegnata (target:
                        "Lun 31   👨 Io  →   👴 Nonno"). Tap sul singolo
                        momento apre lo stesso pannello di scelta di prima,
                        ora sotto la riga del giorno anziché sotto l'intera
                        settimana. */}
                    {weekStartDate && (
                      <div className="ml-4 flex flex-col gap-1 pl-0.5">
                        {/* TRAMA BETA v1.1.1 (FINAL VISUAL CONFORMANCE PASS,
                            punto 7) — segnalazione: le righe mostravano
                            soprattutto frecce + nomi, la distinzione
                            Andata/Ritorno era troppo implicita (solo
                            l'ordine e una freccina piccola). Intestazione
                            stabile sopra le righe, stessa larghezza dello
                            spacer del giorno (54px) cosi le due colonne si
                            allineano visivamente alle chip sotto — le chip
                            restano l'unico modo INTERATTIVO di leggere chi è
                            assegnato, questa è solo l'etichetta di colonna. */}
                        {/* TRAMA BETA v1.1.1 (FINAL FUNCTIONAL + UI
                            CONSISTENCY FIXES, punto 6) — segnalazione: le
                            etichette ANDATA/RITORNO erano troppo piccole/
                            chiare (9px, text-ink-3) per essere lette al volo.
                            Layout compatto approvato INVARIATO (nessun
                            ritorno alle maxi-card) — solo contrasto/peso/
                            dimensione aumentati (10.5px, font-extrabold,
                            text-ink-2 invece di text-ink-3): restano parole
                            intere ("Andata"/"Ritorno"), mai comunicate solo
                            via freccia/colore. */}
                        <div className="flex items-center gap-1.5 px-2">
                          <span className="w-[54px] flex-shrink-0" aria-hidden="true" />
                          <div className="flex min-w-0 flex-1 items-center gap-1">
                            <span className="min-w-0 flex-1 truncate text-center text-[10.5px] font-extrabold uppercase tracking-wide text-ink-2">
                              Andata
                            </span>
                            <span className="w-[13px] flex-shrink-0" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate text-center text-[10.5px] font-extrabold uppercase tracking-wide text-ink-2">
                              Ritorno
                            </span>
                          </div>
                        </div>
                        {WEEKDAYS.map((wd) => {
                          const dayKeys = MOMENTS.map((mo) => respKey(k.kidId, weekStartDate, wd.value, mo.value));
                          const isAssigningThisDay = assigningKey !== null && dayKeys.includes(assigningKey);
                          return (
                            <div key={wd.value} className="rounded-lg bg-bg px-2 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-[54px] flex-shrink-0 text-[10.5px] font-bold text-ink-3"
                                  title={formatDayMonth(addDaysIso(weekStartDate, wd.dayOffset))}
                                >
                                  {/* Target UI (punto 11): "Lun 31" — solo giorno del mese, il
                                      mese completo resta disponibile via title/tooltip. */}
                                  {wd.label} {Number(addDaysIso(weekStartDate, wd.dayOffset).slice(-2))}
                                </span>
                                <div className="flex min-w-0 flex-1 items-center gap-1">
                                  {MOMENTS.map((mo, moIdx) => {
                                    const key = respKey(k.kidId, weekStartDate, wd.value, mo.value);
                                    const current = localResp[key];
                                    const currentOption = current
                                      ? responsibleOptions.find((o) => o.value === current.responsible)
                                      : null;
                                    const isAssigning = assigningKey === key;
                                    const currentLabel = current
                                      ? current.responsible === "altro"
                                        ? current.responsibleLabel || "Altro"
                                        : currentOption?.label
                                      : null;
                                    // TRAMA BETA v1.1.1 (FINAL VISUAL
                                    // CONFORMANCE PASS, punto 8) —
                                    // segnalazione: tutte le assegnazioni
                                    // risultavano dello stesso verde,
                                    // qualunque fosse la persona assegnata
                                    // (il colore non comunicava nulla di
                                    // utile). Semantica corretta: il colore
                                    // indica lo STATO ("assegnato a me" /
                                    // "assegnato ad altri" / "da
                                    // assegnare"), non l'identità della
                                    // persona — "io" è l'unico valore che
                                    // corrisponde davvero al genitore che
                                    // sta guardando lo schermo (vedi
                                    // ResponsibleValue, lib/nextgen/
                                    // responsibility-options.ts).
                                    const tone = responsibilityToneFor(current?.responsible ?? null);
                                    const isMine = tone === "mine";
                                    return (
                                      <span key={key} className="flex min-w-0 flex-1 items-center gap-1">
                                        {moIdx > 0 && (
                                          <i className="ti ti-arrow-narrow-right flex-shrink-0 text-[11px] text-ink-3" />
                                        )}
                                        <button
                                          type="button"
                                          title={current ? (currentLabel ?? "Assegnato") : "Nessuno assegnato"}
                                          onClick={() => {
                                            setAssigningKey(isAssigning ? null : key);
                                            setAltroText(
                                              current?.responsible === "altro" ? current.responsibleLabel ?? "" : ""
                                            );
                                          }}
                                          className={`flex min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11px] font-semibold active:scale-[0.97] ${
                                            isAssigning
                                              ? "bg-trama-lilac/20 ring-1 ring-trama-violet"
                                              : current
                                                ? isMine
                                                  ? "bg-[#E8F9EE] text-ink" // assegnato a me: verde leggero
                                                  : "bg-sky-light text-ink" // assegnato ad altra persona: azzurro NextGen
                                                : "bg-white text-ink-3" // da assegnare: neutro
                                          }`}
                                        >
                                          {/* Etichetta "Andata"/"Ritorno" mantenuta nell'albero
                                              di accessibilità (screen reader + query testuali)
                                              ma non più visibile: nel layout compatto il
                                              contesto Andata/Ritorno è dato dall'intestazione
                                              di colonna sopra + dall'ordine/freccia tra le due
                                              chip, come nel target "👨 Io → 👴 Nonno". */}
                                          <span className="sr-only">{mo.label}</span>
                                          <i
                                            className={`ti ${mo.icon} flex-shrink-0 text-[10px] ${
                                              current ? (isMine ? "text-green" : "text-sky") : "text-ink-3"
                                            }`}
                                          />
                                          <span className="min-w-0 truncate">
                                            {current ? `${currentOption?.emoji ?? ""} ${currentLabel}` : "+ Assegna"}
                                          </span>
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>

                              {isAssigningThisDay && (
                                <div className="mt-2 flex flex-col gap-2 rounded-xl bg-white p-2.5">
                                  {(() => {
                                    const [, , weekdayStr, momentStr] = (assigningKey as string).split("__");
                                    const weekday = weekdayStr as Weekday;
                                    const moment = momentStr as Moment;
                                    const current = localResp[assigningKey as string];
                                    return (
                                      <>
                                        <div className="flex flex-wrap gap-1.5">
                                          {/* TRAMA BETA v1.1.1 — FINAL GAP
                                              CLOSURE (punto 6/7): stessa
                                              distinzione chip-nota vs "Altro"
                                              generico della pannello bulk
                                              qui sopra. L'evidenziazione
                                              "selezionato" confronta anche
                                              responsibleLabel (non solo
                                              value) cosi due chip "altro"
                                              diverse (es. "Zio Marco" e
                                              "Zia Carla") non si evidenziano
                                              a vicenda. */}
                                          {responsibleOptions.map((opt) => (
                                            <button
                                              key={opt.familyPersonId ?? opt.value}
                                              type="button"
                                              disabled={savingKey === assigningKey}
                                              onClick={() => {
                                                if (opt.value === "altro" && !opt.familyPersonId) return; // richiede il testo sotto
                                                handleAssign(
                                                  k.kidId,
                                                  weekStartDate,
                                                  weekday,
                                                  moment,
                                                  opt.value,
                                                  opt.familyPersonId ? opt.label : undefined,
                                                  opt.familyPersonId
                                                );
                                              }}
                                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold active:scale-95 ${
                                                current?.responsible === opt.value &&
                                                (opt.value !== "altro" || current?.responsibleLabel === opt.label)
                                                  ? "bg-trama-violet text-white"
                                                  : "bg-bg text-ink-2"
                                              }`}
                                            >
                                              {opt.emoji} {opt.label}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            type="text"
                                            value={altroText}
                                            onChange={(e) => setAltroText(e.target.value)}
                                            placeholder="Altro: scrivi chi (es. Zia Carla)"
                                            className="min-w-0 flex-1 rounded-lg border border-[#E8EBF0] bg-white px-2.5 py-1.5 text-[11.5px] text-ink"
                                          />
                                          <button
                                            type="button"
                                            disabled={savingKey === assigningKey || !altroText.trim()}
                                            onClick={() =>
                                              handleAssign(k.kidId, weekStartDate, weekday, moment, "altro", altroText)
                                            }
                                            className="flex-shrink-0 rounded-lg bg-trama-violet px-2.5 py-1.5 text-[11px] font-bold text-white active:scale-[0.97] disabled:opacity-40"
                                          >
                                            OK
                                          </button>
                                        </div>
                                        {current && (
                                          <button
                                            type="button"
                                            disabled={savingKey === assigningKey}
                                            onClick={() => handleClear(k.kidId, weekStartDate, weekday, moment)}
                                            className="self-start text-[11px] font-semibold text-ink-3 active:bg-black/[0.04]"
                                          >
                                            Rimuovi assegnazione
                                          </button>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
                });
              })()}
              {selectedDay.hasConflict && (
                <p className="mt-1 text-[11.5px] text-[#7a5400]">
                  Controlla il dettaglio in Organizzazione: uno o più bambini risultano prenotati due volte questa
                  settimana.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-2">Nessuna prenotazione per questa settimana.</p>
          )}
        </div>
      )}
      </>
      )}

      {/* SPRINT 5.3 — Condivisione Piano: pannello di creazione link, aperto
          da "Condividi" (mese o settimana). Nessun periodo personalizzato in
          questa fase — vedi commento su monthShareScope. */}
      {sharingScope && (
        <div ref={sharePanelRef} className="rounded-2xl border border-[#E8EBF0] bg-white p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="font-poppins text-[13px] font-bold text-ink">Condividi piano</div>
            <button type="button" onClick={() => setSharingScope(null)} className="text-ink-3 active:scale-95" aria-label="Chiudi">
              <i className="ti ti-x text-[16px]" />
            </button>
          </div>

          {shareResultUrl ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-[12.5px] text-ink-2">
                Link pronto — chi lo apre vede solo bambino, attività e date di questo periodo, senza login.
              </p>
              <div className="flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">{shareResultUrl}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(shareResultUrl)}
                  className="flex-shrink-0 rounded-full bg-trama-violet px-3 py-1.5 text-[11px] font-bold text-white active:scale-[0.97]"
                >
                  Copia
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSharingScope(null)}
                className="self-start text-[11.5px] font-semibold text-trama-violet active:bg-black/[0.04]"
              >
                Fatto
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <p className="text-[12.5px] text-ink-2">
                Chi lo apre vede solo bambino, attività e date — mai importi, indirizzi o contatti.
              </p>
              <input
                type="text"
                value={shareLabel}
                onChange={(e) => setShareLabel(e.target.value)}
                placeholder="Nome del link (es. Luglio 2026)"
                className="rounded-xl border border-[#E8EBF0] px-3 py-2 text-[13px] text-ink"
              />
              <button
                type="button"
                disabled={shareBusy}
                onClick={handleCreateShare}
                className="rounded-full bg-trama-violet px-4 py-2 text-[12.5px] font-bold text-white active:scale-[0.97] disabled:opacity-50"
              >
                {shareBusy ? "Creo il link…" : "Crea link"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Elenco dei link creati — gestione/revoca. */}
      {shares.filter((s) => !s.revokedAt).length > 0 && (
        <div className="rounded-2xl bg-white p-4">
          <div className="mb-2.5 font-poppins text-[13px] font-bold text-ink">I tuoi link condivisi</div>
          <div className="flex flex-col gap-2">
            {shares
              .filter((s) => !s.revokedAt)
              .map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-semibold text-ink">{s.label || "Piano condiviso"}</div>
                    <div className="text-[10.5px] text-ink-3">
                      {s.scopeStart} – {s.scopeEnd}
                    </div>
                    {/* Fix privacy 06/08/2026: ogni link scade 30gg dopo la
                        creazione — il genitore deve saperlo, non e' più un
                        link valido per sempre. */}
                    <div className="text-[10.5px] text-ink-3">
                      Scade il {new Date(s.expiresAt).toLocaleDateString("it-IT")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeShare(s.id)}
                    className="flex-shrink-0 text-[11px] font-semibold text-red-500 active:bg-black/[0.04]"
                  >
                    Revoca
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
