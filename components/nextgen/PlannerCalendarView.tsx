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

type ViewMode = "mese" | "settimana";

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

export default function PlannerCalendarView({
  weeks,
  kids,
  overlaps,
  responsibilities,
  existingShares,
  parentRole,
  familyPeople,
  initialWeekStartDate,
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
  const [viewMode, setViewMode] = useState<ViewMode>("mese");
  const months = useMemo(() => buildCalendarMonths(weeks, kids, overlaps), [weeks, kids, overlaps]);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
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

  async function handleBulkAssign(value: ResponsibleValue, label?: string, familyPersonId?: string) {
    if (!selectedDay || !selectedDay.weekStartDate) return;
    const weekStartDate = selectedDay.weekStartDate;
    const kidIds = selectedDay.kids.map((k) => k.kidId).filter((id) => !bulkKidExcluded[id]);
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

  const conflictWeekIndexes = useMemo(() => {
    function weekIndexFromLabel(label: string): number | null {
      const m = label.match(/\d+/);
      return m ? Number(m[0]) : null;
    }
    return new Set(overlaps.map((o) => weekIndexFromLabel(o.weekLabel)).filter((i): i is number => i !== null));
  }, [overlaps]);

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
      {/* Selettore Mese/Settimana */}
      <div className="flex gap-2">
        {(
          [
            { key: "mese", label: "Mese" },
            { key: "settimana", label: "Settimana" },
          ] as { key: ViewMode; label: string }[]
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
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

      {/* Legenda per bambino
          TRAMA BETA v1.1.1 (UI Refinement, punto 10) — legenda più
          compatta (meno padding/gap): stessa informazione, meno spazio
          verticale prima del calendario vero e proprio. */}
      {kids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-white px-3 py-2">
          {kidLegend.map((k) => (
            <div key={k.kidId} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${DOT_BG[k.accentColor ?? "sky"]}`} />
              <span className="text-[11.5px] font-semibold text-ink-2">{k.kidName}</span>
            </div>
          ))}
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
            <div className="font-poppins text-sm font-bold text-ink">{activeMonth.label}</div>
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
              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  disabled={!cell.inSeason}
                  onClick={() => setSelectedDay(isSelected ? null : cell)}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] active:scale-95 ${
                    isSelected
                      ? "bg-trama-lilac/20 font-bold text-ink"
                      : isToday
                        ? "border border-trama-violet font-semibold text-ink"
                        : cell.inSeason
                          ? "text-ink"
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
        <div className="flex flex-col gap-1.5">
          {weeks.map((w) => {
            const hasConflict = conflictWeekIndexes.has(w.index);
            const isSelected = selectedDay?.weekIndex === w.index;
            return (
              <button
                key={w.index}
                type="button"
                onClick={() =>
                  setSelectedDay(
                    isSelected
                      ? null
                      : {
                          dateIso: w.startDate,
                          dayOfMonth: 0,
                          weekIndex: w.index,
                          weekLabel: w.label,
                          weekStartDate: w.startDate,
                          weekEndDate: w.endDate,
                          inSeason: true,
                          covered: w.covered,
                          dismissed: w.dismissed,
                          activityName: w.activityName,
                          kids: w.coveredKids
                            .map((ck) => kids.find((k) => k.id === ck.kidId))
                            .filter((k): k is Kid => Boolean(k))
                            .map((k) => ({
                              kidId: k.id,
                              kidName: k.name,
                              accentColor: k.accentColor ?? "sky",
                            })),
                          hasConflict,
                        }
                  )
                }
                className={`flex items-center gap-3 rounded-xl p-3 text-left active:bg-black/[0.06] ${
                  isSelected ? "bg-trama-lilac/20" : w.dismissed ? "bg-bg" : "bg-white"
                }`}
              >
                <div className="w-16 flex-shrink-0 whitespace-nowrap text-[11.5px] font-bold text-ink">
                  Sett. {w.index}
                </div>
                {/* TRAMA BETA v1.1.1 (FINAL VISUAL CONFORMANCE PASS, punto
                    12) — segnalazione: questa riga comunicava "coperta da
                    un bambino" SOLO con un pallino colorato (il nome era
                    leggibile solo via title/tooltip, inutile su touch) —
                    niente distingueva lo stato senza già sapere a memoria
                    quale colore appartiene a quale bambino dalla legenda
                    sopra. Ogni pallino ora porta anche il nome, in chip
                    compatte (dot + testo), non solo colore. */}
                <div className="flex flex-1 flex-wrap items-center gap-1">
                  {w.dismissed ? (
                    <span className="text-[11.5px] text-ink-3">Non ti serve</span>
                  ) : w.coveredKids.length > 0 ? (
                    w.coveredKids.map((ck) => {
                      const kid = kids.find((k) => k.id === ck.kidId);
                      if (!kid) return null;
                      return (
                        <span
                          key={ck.kidId}
                          className="flex items-center gap-1 rounded-full bg-bg px-1.5 py-0.5"
                        >
                          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${DOT_BG[kid.accentColor ?? "sky"]}`} />
                          <span className="text-[10.5px] font-semibold text-ink-2">{kid.name}</span>
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-[11.5px] text-ink-3">Scoperta</span>
                  )}
                </div>
                {hasConflict && <i className="ti ti-alert-triangle flex-shrink-0 text-[15px] text-[#9a6b00]" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Riepilogo del giorno/settimana selezionata */}
      {selectedDay && (
        <div className="rounded-2xl border border-[#E8EBF0] bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="font-poppins text-[13px] font-bold text-ink">
              {selectedDay.weekLabel ?? "Settimana"}
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
                              handleBulkAssign(opt.value, opt.familyPersonId ? opt.label : undefined, opt.familyPersonId);
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
                            onClick={() => handleBulkAssign("altro", bulkAltroText)}
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
