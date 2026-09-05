"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PlannerData } from "@/lib/data/planner";
import {
  KidOverlap,
  BudgetSummary,
  computePerKidCoverage,
  computeWeekStatus,
  weekIndexFromLabel,
  groupWeeksByMonth,
  getUpcomingWeeks,
  computeHeroWeeksSummary,
  formatItalianDayMonth,
} from "@/lib/nextgen/planner-insights";
import type { Mission } from "@/lib/nextgen/missions";
import type { SmartMatch } from "@/lib/nextgen/smart-search";
// "import type": queste due sono interfacce usate SOLO come tipo (prop
// types), mai come valore — con "import type" il compilatore le elimina
// sempre dal bundle client, garantendo che lib/data/responsibilities.ts e
// lib/data/plan-shares.ts (che importano lib/supabase/server) non vengano
// mai trascinati qui per errore (stesso bug di build causato da
// ADDRESS_KIND_LABELS/RESPONSIBLE_OPTIONS, vedi lib/nextgen/address-kinds.ts).
import type { WeekResponsibility, KidBookedDays } from "@/lib/data/responsibilities";
// TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS: stesso helper puro già
// usato dal Dettaglio Settimana (computeRolesToCover) e da Home — riusato
// qui per il gap di coordinamento stagionale, nessuna nuova formula.
import { computeCoordinationGap, computeOrganizationState } from "@/lib/nextgen/week-roles";
// TRAMA BETA v1.1.1 — FINAL GAP CLOSURE: FamilyPerson vive in
// responsibility-options.ts (modulo client-safe, nessun import
// lib/supabase/server) — import diretto, nessun rischio di bundle.
import type { FamilyPerson } from "@/lib/nextgen/responsibility-options";
import type { PlanShare } from "@/lib/data/plan-shares";
import type { PlannerMapPin } from "@/lib/data/planner-map";
import type { Reminder } from "@/lib/nextgen/reminders";
// "import type": stesso motivo di PlannerMapPin/WeekResponsibility qui sopra
// — ParentAddress è solo un tipo, quindi non trascina lib/data/addresses.ts
// (che importa lib/supabase/server) nel bundle client.
import type { ParentAddress } from "@/lib/nextgen/address-kinds";
// "import type": stesso motivo — ParentRole è solo un tipo (da
// lib/data/profile.ts, che importa lib/supabase/server), non trascina il
// modulo server nel bundle client.
import type { ParentRole } from "@/lib/data/profile";
import { Kid, CommunityItem, GroupItem } from "@/lib/types";
import { lightBgClasses } from "@/lib/colors";
// Wiring mancante segnalato da Fabrizio (26/08/2026): "Non mi serve" esiste
// da tempo lato LEGACY (components/PlannerView.tsx) — stessa azione server,
// stesso campo dati condiviso (profiles.dismissed_weeks, lib/data/planner.ts),
// ma qui in NEXTGEN lo stato "dismissed" era finora SOLO letto/mostrato
// (etichetta "Non ti serve"), mai impostabile: nessun bottone chiamava
// toggleWeekDismissedAction. Nessuna nuova azione: solo il bottone mancante.
import { toggleWeekDismissedAction } from "@/app/actions/profile";
import PageHeader from "@/components/PageHeader";
import NextgenBadge from "@/components/nextgen/NextgenBadge";
import PlannerModeTabs, { PlannerMode, PLANNER_MODES } from "@/components/nextgen/PlannerModeTabs";
import PlannerBudgetView from "@/components/nextgen/PlannerBudgetView";
import PlannerCalendarView from "@/components/nextgen/PlannerCalendarView";
import PlannerMapView from "@/components/nextgen/PlannerMapView";
import PlannerGroupsView from "@/components/nextgen/PlannerGroupsView";
import DecorativeIntroCard from "@/components/nextgen/DecorativeIntroCard";
import Link from "next/link";

// Segnalazione 24/08/2026 (Fabrizio): "la descrizione della sezione è
// sbagliata" — la card introduttiva sotto l'header aveva solo DUE varianti
// di testo (budget vs. tutto il resto), ma PLANNER_MODES ne ha 4
// (organizzazione/mappa/budget/gruppi, PlannerModeTabs.tsx). Su "Mappa" e
// "Gruppi" restava quindi visibile "La timeline completa della tua famiglia
// per l'estate" — testo pensato per Organizzazione, non pertinente per una
// mappa di centri/attività o per un riepilogo di community/gruppi. Una
// descrizione per modalità, così ogni sezione mostra il testo giusto.
const PLANNER_MODE_DESCRIPTIONS: Record<PlannerMode, string> = {
  organizzazione: "La timeline completa della tua famiglia per l'estate.",
  mappa: "Dove sono i centri e le attività della tua famiglia.",
  budget: "Quanto stai spendendo per questa estate.",
  gruppi: "Le community e i gruppi a cui la tua famiglia partecipa.",
};

const REMINDER_TONE_CLASSES: Record<Reminder["tone"], string> = {
  urgent: "bg-[#FDECEC] text-[#B02A2A]",
  warning: "bg-[#FFF7E8] text-[#9a6b00]",
  info: "bg-trama-lilac/20 text-trama-violet",
};

// SPRINT 3 (NEXTGEN) — Planner come "cuore dell'esperienza": timeline
// familiare completa (13 settimane), sovrapposizioni, settimana prioritaria
// da riempire, budget impegnato, consigli — tutto qui, non sparso fra Home e
// "Le mie prenotazioni" (LEGACY, che resta il posto per annullare/modificare,
// vedi link "Gestisci prenotazioni" in fondo). Riuso: ActivityCard, PageHeader,
// NextgenBadge, lightBgClasses — nessun componente visivo nuovo per le parti
// già esistenti altrove.
//
// SPRINT 5.1 (NEXTGEN) — "Family Planner" (PRD di Fabrizio): il Planner
// diventa il centro operativo, con 5 modalità sugli stessi dati.
// Organizzazione, Budget, Calendario, Mappa e — da Sprint 5.6 — Gruppi (vedi
// PlannerGroupsView, riepilogo di Community + Gruppi sconto, riuso puro dei
// dati già letti in Sprint 4) sono ora tutte funzionanti.
// weekIndexFromLabel spostato in lib/nextgen/planner-insights.ts (serve
// anche a lib/nextgen/reminders.ts per l'azione "week" dei promemoria).

export default function PlannerClient({
  planner,
  kids,
  overlaps,
  budget,
  priorityIndex,
  todayIso,
  recommendations,
  missions,
  reminders,
  seasonBudgetTarget,
  parentRole,
  responsibilities,
  coordinationBookedDays,
  familyPeople,
  existingShares,
  mapPins,
  communities,
  groups,
  addresses,
}: {
  planner: PlannerData;
  kids: Kid[];
  overlaps: KidOverlap[];
  budget: BudgetSummary;
  priorityIndex: number | null;
  // BUG CORRETTO 06/08/2026 (segnalato da Fabrizio) — data odierna (server,
  // stessa già usata per i Promemoria) per marcare le settimane già
  // trascorse come "past" (chiuse) invece di "scoperta"/"priorità".
  todayIso: string;
  recommendations: SmartMatch[];
  missions: Mission[];
  reminders: Reminder[];
  seasonBudgetTarget: number | null;
  // TRAMA BETA v1.1.1 (UI Refinement, punto 15) — già letto server-side da
  // getParentProfile() in page.tsx, ora anche passato a valle per
  // risolvere "Mamma"/"Papà" nel selettore Chi fa cosa (PlannerCalendarView).
  parentRole: ParentRole | null;
  responsibilities: WeekResponsibility[];
  // TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS: dati grezzi stagionali
  // (stessa fonte di "Chi fa cosa?", INVARIATA) per il gap di coordinamento
  // — derivato via computeCoordinationGap, stessa convenzione di
  // heroWeeks/priorityWeek (raw data via props, derivato via useMemo).
  coordinationBookedDays: KidBookedDays[];
  // TRAMA BETA v1.1.1 — FINAL GAP CLOSURE (punto 6): persone custom
  // persistenti del genitore, già lette server-side (getFamilyPeopleForParent,
  // page.tsx) — passate a valle per popolare il selettore "Chi fa cosa?"
  // (PlannerCalendarView) con le chip già note, senza dover ridigitare un
  // nome già usato in una settimana precedente.
  familyPeople: FamilyPerson[];
  existingShares: PlanShare[];
  mapPins: PlannerMapPin[];
  communities: CommunityItem[];
  groups: GroupItem[];
  addresses: ParentAddress[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // SPRINT CORRETTIVO — deep-link da /nextgen/planner/logistica ("Condivisione
  // piano" apre direttamente la modalita' Calendario, dove quella feature
  // vive davvero, invece di lasciare l'utente in Organizzazione a cercarla).
  // Fallback silenzioso su "organizzazione" se il valore non e' valido.
  const initialModeParam = searchParams.get("mode");
  const initialMode: PlannerMode = PLANNER_MODES.some((m) => m.key === initialModeParam)
    ? (initialModeParam as PlannerMode)
    : "organizzazione";
  const [mode, setMode] = useState<PlannerMode>(initialMode);
  // FEATURE (richiesta Fabrizio 04/09/2026, "swipe vs sinistra o destra... nel
  // planner cambi visualizzazione"): swipe orizzontale su tutta la pagina
  // Planner cicla tra le modalità PLANNER_MODES (stesso ordine dei tab:
  // organizzazione/mappa/budget/gruppi). Decisione presa solo al touchend
  // (nessun preventDefault/drag live durante il gesto, stesso principio "non
  // toccare lo scroll verticale nativo" già rispettato altrove in questo
  // file) — soglia orizzontale minima + dominanza su verticale per non
  // scattare durante uno scroll normale della pagina. Le strisce con scroll
  // orizzontale proprio (tab chip, "Parti da" della Mappa) sono escluse via
  // l'attributo data-swipe-ignore (vedi PlannerModeTabs.tsx/PlannerMapView.tsx),
  // altrimenti scorrerle trascinerebbe anche la modalità.
  const swipeTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const SWIPE_MIN_DX = 60;

  function handlePlannerTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-swipe-ignore]")) {
      swipeTouchStartRef.current = null;
      return;
    }
    const t = e.touches[0];
    swipeTouchStartRef.current = { x: t.clientX, y: t.clientY };
  }

  function handlePlannerTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const start = swipeTouchStartRef.current;
    swipeTouchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const currentIndex = PLANNER_MODES.findIndex((m) => m.key === mode);
    if (currentIndex === -1) return;
    if (dx < 0 && currentIndex < PLANNER_MODES.length - 1) {
      setMode(PLANNER_MODES[currentIndex + 1].key);
    } else if (dx > 0 && currentIndex > 0) {
      setMode(PLANNER_MODES[currentIndex - 1].key);
    }
  }
  // TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS (§8): deep-link opzionale
  // verso una settimana specifica dentro Calendario/Chi fa cosa (dalla CTA
  // "N passaggi da assegnare" di Home o dell'alert di coordinamento qui
  // sotto) — stessa tecnica di ?mode=, un solo useState letto una volta al
  // mount, nessun override successivo. Validato contro le settimane reali
  // dentro PlannerCalendarView (qui restiamo una stringa "grezza").
  const initialWeekParam = searchParams.get("week");
  // BUGFIX (segnalato da Fabrizio: "non fa accadere nulla il click" sull'alert
  // di coordinamento nel Coverage Hero) — ROOT CAUSE: quell'alert è un <Link>
  // verso /nextgen/planner?mode=calendario&week=..., ma essendo la STESSA
  // route già montata, Next.js App Router non rimonta PlannerClient: l'URL
  // cambia ma mode/calendarExpanded/initialWeekParam sono tutti calcolati UNA
  // SOLA VOLTA al mount (useState(initial...)), quindi restano quelli di
  // prima — nessun effetto visibile, anche se l'URL in barra è corretto.
  // Fix: quel click ora aggiorna direttamente questo stato locale (vedi
  // weekOverride sotto e il bottone al posto del Link, più giù) invece di
  // affidarsi a una navigazione same-route che l'App Router non propaga.
  const [weekOverride, setWeekOverride] = useState<string | null>(initialWeekParam);

  // Wiring "Non ti serve" (26/08/2026, richiesto da Fabrizio dopo aver
  // verificato che l'azione esisteva solo lato LEGACY, components/PlannerView.tsx):
  // override locale, per data di inizio settimana, sovrapposto a
  // planner.weeks[].dismissed — stesso pattern di "optimistic update" già
  // usato da PlannerView (LEGACY): la UI cambia subito al click, la verità
  // resta comunque il campo persistito (profiles.dismissed_weeks), letto da
  // capo ad ogni caricamento server (router.refresh() dopo il salvataggio,
  // cosi' anche priorityIndex — calcolato server-side in page.tsx — si
  // riallinea se la settimana appena esclusa/ripristinata era quella
  // "prioritaria"). Non serve toccare planner.coveredNeededCount/totalCount:
  // "Non ti serve" si usa solo su settimane NON coperte (vedi rendering
  // sotto, stessa regola di PlannerView), quindi il numeratore "coperte" non
  // cambia mai per questa azione, solo il denominatore "necessarie", già
  // ricalcolato qui sotto da neededCount.
  const [dismissedOverrides, setDismissedOverrides] = useState<Record<string, boolean>>({});
  const [savingWeek, setSavingWeek] = useState<string | null>(null);
  const weeks = useMemo(
    () =>
      planner.weeks.map((w) =>
        w.startDate in dismissedOverrides ? { ...w, dismissed: dismissedOverrides[w.startDate] } : w
      ),
    [planner.weeks, dismissedOverrides]
  );
  async function toggleDismissed(week: (typeof weeks)[number]) {
    const nextDismissed = !week.dismissed;
    setDismissedOverrides((cur) => ({ ...cur, [week.startDate]: nextDismissed }));
    setSavingWeek(week.startDate);
    await toggleWeekDismissedAction(week.startDate, nextDismissed);
    setSavingWeek(null);
    // Riallinea priorityIndex/eventuali altri valori calcolati server-side
    // (page.tsx) con la nuova esclusione/ripristino — stesso identificatore
    // di settimana (startDate), nessun redirect, nessuna perdita di scroll
    // (Next.js preserva lo stato di scroll su router.refresh()).
    router.refresh();
  }

  const perKidCoverage = useMemo(() => computePerKidCoverage({ ...planner, weeks }, kids), [planner, weeks, kids]);

  // SPRINT CORRETTIVO — Calendario non e' piu' un tab a se stante: vive qui,
  // dentro Organizzazione, dietro un riquadro pieghevole. Se si arriva da
  // ?mode=calendario (link "Condivisione piano" dell'hub Logistica), il
  // riquadro parte gia' aperto invece di lasciare l'utente a cercarlo.
  //
  // PLANNER BETA v1.1 — il default "sempre aperto" introdotto in un fix
  // precedente della stessa giornata è stato rivalutato durante
  // l'implementazione di questa wave: la suite Playwright esistente
  // (family-planner-5-3/5-6, planner-calendar-5-2, planner-logistica,
  // planner-organizzazione-semplificata TC-N100 — oltre 15 punti di test)
  // presuppone deliberatamente un riquadro chiuso di default e verifica il
  // click che lo apre. La visibilità/scopribilità del contenuto (l'obiettivo
  // reale della segnalazione di Fabrizio) resta risolta dall'etichetta
  // esplicita "Calendario e Chi fa cosa?" + dalla settimana corrente
  // preselezionata all'apertura (PlannerCalendarView) — non dal default
  // espanso, che qui si ripristina per non introdurre una regressione ampia
  // sulla suite di test a fronte di un guadagno UX marginale aggiuntivo.
  const [calendarExpanded, setCalendarExpanded] = useState(
    initialModeParam === "calendario" || Boolean(initialWeekParam)
  );
  // SPRINT CORRETTIVO — "Ogni barra del bambino... deve portare ad un
  // dettaglio del piano (per bambino)": click su una barra apre/chiude un
  // pannello inline con le singole settimane di quel bambino (copertura
  // derivata da planner.weeks, nessuna nuova query).
  const [expandedKidId, setExpandedKidId] = useState<string | null>(null);
  // PLANNER BETA v1.1 (Wave 1, punto 2B "Riduzione ridondanze") — "Copertura
  // per bambino" resta disponibile ma non più visibile di default: l'intera
  // card (non solo il dettaglio per singolo bambino, già gestito da
  // expandedKidId sopra) è ora dietro questo secondo livello di disclosure.
  // L'intestazione "Copertura per bambino" resta sempre presente come
  // bottone di apertura (nessuna informazione nascosta, solo un click in
  // più per chi ha più di un figlio e vuole il dettaglio).
  const [kidCoverageOpen, setKidCoverageOpen] = useState(false);
  // PLANNER BETA v1.1 (Wave 1, punto 2B/4) — la Timeline completa (tutte le
  // settimane della stagione) non è più il contenuto di default
  // dell'Overview: diventa consultazione secondaria dietro "Vedi tutte le
  // settimane". Il contenuto/comportamento della Timeline (raggruppamento
  // per mese, Riempi/Non mi serve, righe cliccabili) resta INVARIATO — solo
  // la sua visibilità di default cambia.
  const [timelineOpen, setTimelineOpen] = useState(false);
  // SPRINT CORRETTIVO — "...o lo stato per settimana deve portare ad un
  // dettaglio del piano (per settimana)": click su un alert con azione
  // "week" (es. promemoria di sovrapposizione) scorre fino alla riga
  // corrispondente della Timeline e la evidenzia per un istante.
  // PLANNER BETA v1.1 — la striscia "Stato per settimana" che generava
  // questa azione è stata rimossa (funzione assorbita da "Prossime
  // settimane da completare", vedi sotto): l'unico chiamante rimasto di
  // jumpToWeek è l'azione "week" degli alert (allAlerts, es. promemoria di
  // sovrapposizione) — grep eseguito su tutto app/nextgen prima di
  // rimuovere la striscia: nessun altro punto del prodotto dipende da essa.
  const [highlightedWeekIndex, setHighlightedWeekIndex] = useState<number | null>(null);
  // SPRINT 2 (feedback Fabrizio: "la Timeline potrebbe raggruppare per
  // mese, espandibile per vedere le singole settimane con le date") — la
  // Timeline ora è raggruppata per mese, quindi "saltare" a una settimana
  // deve prima aprire il mese che la contiene, altrimenti la riga bersaglio
  // non esiste ancora nel DOM (mese collassato) e lo scroll fallirebbe in
  // silenzio.
  const monthGroups = useMemo(() => groupWeeksByMonth(weeks), [weeks]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    const target = weeks.find((w) => w.index === priorityIndex) ?? weeks.find((w) => !w.covered && !w.dismissed);
    const key = target?.startDate.slice(0, 7);
    return new Set(key ? [key] : []);
  });
  function monthKeyForWeek(index: number): string | undefined {
    return weeks.find((w) => w.index === index)?.startDate.slice(0, 7);
  }
  function jumpToWeek(index: number) {
    // PLANNER BETA v1.1 — la Timeline è ora dietro "Vedi tutte le
    // settimane" (timelineOpen, default chiuso): un'azione "week" deve
    // prima aprirla, altrimenti la riga bersaglio non esiste nel DOM.
    setTimelineOpen(true);
    const monthKey = monthKeyForWeek(index);
    if (monthKey) setExpandedMonths((cur) => (cur.has(monthKey) ? cur : new Set(cur).add(monthKey)));
    setHighlightedWeekIndex(index);
    // Il riquadro Timeline e il mese appena espanso devono prima
    // renderizzare le loro righe prima che lo scroll possa trovare
    // l'elemento bersaglio nel DOM.
    window.setTimeout(() => {
      document.getElementById(`week-row-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    window.setTimeout(() => setHighlightedWeekIndex((cur) => (cur === index ? null : cur)), 1600);
  }
  // SPRINT CORRETTIVO — "vorrei semplificare le notifiche, sono troppe": prima
  // Promemoria (fino a 4) e Missioni (fino a 3) si impilavano entrambe per
  // intero, fino a 7 banner uno sopra l'altro. Ora se ne mostra UNA sola (la
  // piu' urgente: un Promemoria se presente, altrimenti la prima Missione),
  // con un link "Mostra tutti" per chi vuole vedere il resto — nessun dato
  // perso, solo meno rumore visivo di default.
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  // SPRINT 7 (feedback Fabrizio: "troppe card di notifica, serve una X per
  // chiuderle") — dismiss locale (solo per la sessione corrente: sono avvisi
  // ricalcolati ad ogni caricamento dai dati reali, non serve persistenza,
  // altrimenti un avviso ancora vero tornerebbe comunque al refresh
  // successivo dando l'impressione di un bug "non si chiude mai davvero").
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
  // SPRINT CORRETTIVO (feedback Fabrizio: "le notifiche nascoste devono
  // avere una CTA e un routing") — ogni alert porta con sé l'azione già
  // calcolata dalla sua funzione di dominio (lib/nextgen/reminders.ts /
  // missions.ts): "week" scorre alla riga della Timeline, "mode" cambia tab
  // (es. Budget), "link" naviga altrove. Le missioni "success" restano senza
  // action (sono solo rassicurazione, nessuna azione sensata).
  const allAlerts = useMemo(
    () =>
      [
        ...reminders.map((r) => ({ id: r.id, emoji: r.emoji, text: r.text, className: REMINDER_TONE_CLASSES[r.tone], action: r.action })),
        ...missions.map((m) => ({
          id: m.id,
          emoji: m.emoji,
          text: m.text,
          className: m.tone === "success" ? "bg-[#E8F9EE] text-ink" : "bg-trama-lilac/20 text-ink",
          action: m.action,
        })),
      ].filter((a) => !dismissedAlertIds.has(a.id)),
    [reminders, missions, dismissedAlertIds]
  );

  const overlapsByWeekIndex = useMemo(() => {
    const map = new Map<number, KidOverlap[]>();
    for (const o of overlaps) {
      const idx = weekIndexFromLabel(o.weekLabel);
      if (idx === null) continue;
      const list = map.get(idx) ?? [];
      list.push(o);
      map.set(idx, list);
    }
    return map;
  }, [overlaps]);

  const neededCount = weeks.filter((w) => !w.dismissed).length;
  // BUGFIX (segnalato da Fabrizio: "5 di 4 settimane coperte") —
  // planner.coveredCount conta anche settimane coperte ma "non ti servono"
  // (dismissed), quindi il rapporto poteva superare il 100%.
  // coveredNeededCount esclude le dismissed anche al numeratore.
  const progressPercent = neededCount > 0 ? Math.round((planner.coveredNeededCount / neededCount) * 100) : 0;
  const priorityWeek = weeks.find((w) => w.index === priorityIndex) ?? null;
  // TRAMA BETA v1.1.1 — FINAL HERO SEMANTIC FIX: quale rapporto mostrare
  // come metrica primaria del Coverage Hero (vedi commento sulla card più
  // sotto e computeHeroWeeksSummary in lib/nextgen/planner-insights.ts).
  const heroWeeks = useMemo(() => computeHeroWeeksSummary(weeks, todayIso), [weeks, todayIso]);
  // PLANNER BETA v1.1 (Wave 1, punto 4) — "Prossime settimane da
  // completare": max 3, stesso identico dataset weeks, nessuna nuova query.
  const upcomingWeeks = useMemo(
    () => getUpcomingWeeks(weeks, todayIso, 3, kids.length, priorityIndex),
    [weeks, todayIso, kids.length, priorityIndex]
  );
  // TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS (§9): "3 su 3 organizzate"
  // (copertura ATTIVITÀ, sopra) è una dimensione diversa da "sappiamo chi fa
  // Andata/Ritorno per ogni child-day prenotato?" (copertura COORDINAMENTO).
  // computeCoordinationGap riusa computeRolesToCover (già usato dal Dettaglio
  // Settimana) una volta per settimana futura rilevante — nessuna nuova
  // query, nessun secondo calcolo divergente.
  const coordinationGap = useMemo(
    () => computeCoordinationGap(weeks, coordinationBookedDays, responsibilities, todayIso),
    [weeks, coordinationBookedDays, responsibilities, todayIso]
  );
  // Copertura ATTIVITÀ "complete" nello stesso senso già usato dalla riga
  // "Tutto organizzato" del Coverage Hero sotto: nessuna settimana futura
  // prioritaria da riempire (priorityWeek null), oppure stagione di fatto
  // conclusa (nessuna settimana futura rilevante — in quel caso
  // coordinationGap.totalMissing è comunque già 0, la stessa identica
  // finestra "futuro/rilevante" di computeHeroWeeksSummary non ha nulla da
  // aggregare). L'attività resta sempre prioritaria: un gap di coordinamento
  // non deve mai mascherare un gap di attività più fondamentale (§6 CASO C).
  const activityCoverageComplete = heroWeeks.hasFutureRelevant ? priorityWeek === null : true;
  const organizationState = computeOrganizationState(activityCoverageComplete, coordinationGap.totalMissing);

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Planner" onBack={() => router.push("/nextgen")} showBrandIcon />
      <div className="px-5 py-4" onTouchStart={handlePlannerTouchStart} onTouchEnd={handlePlannerTouchEnd}>
        {/* SPRINT 7 — stessa texture decorativa (due cerchi) della hero
            card di Home, vedi DecorativeIntroCard.
            FIX (segnalato da Fabrizio con screenshot, 24/08/2026) — il
            ribbon "Beta" (NextgenBadge) è tagliato dal bordo arrotondato:
            NextgenBadge è position:absolute e si aggancia al primo
            antenato position:relative, che dovrebbe essere sempre
            .app-shell (vedi il commento in NextgenBadge.tsx) — ma
            DecorativeIntroCard è ANCH'ESSA relative+overflow-hidden
            (per i due cerchi decorativi), quindi quando NextgenBadge
            veniva montato AL SUO INTERNO si agganciava lì invece che
            allo shell, e overflow-hidden lo tagliava. Stesso bug di
            fondo di TC-N638 (menu Scatta foto), causa diversa.
            Fix: NextgenBadge ora è un FRATELLO di DecorativeIntroCard,
            non un figlio — risale di nuovo fino a .app-shell com'era
            inteso, senza toccare NextgenBadge.tsx o DecorativeIntroCard.tsx
            (che restano invariati e continuano a funzionare per tutti gli
            altri usi, es. Home/Admin/Center, mai stati rotti). */}
        <NextgenBadge />
        {/* TRAMA BETA v1.1.1 (UI Refinement, punto 2) — segnalazione: il box
            descrittivo occupava uno spazio hero prima ancora della vera
            informazione utile (copertura reale). Per la modalità
            Organizzazione la card introduttiva viene rimossa: la Coverage
            Hero (subito sotto, dentro il branch "organizzazione") diventa
            il primo contenuto e assorbe quel ruolo. Per le altre 3 modalità
            (Mappa/Budget/Gruppi) — fuori dal perimetro di questa revisione,
            "NON tornare a ridisegnare l'architettura" — la card resta
            invariata. */}
        {mode !== "organizzazione" && (
          <DecorativeIntroCard className="mb-4">
            {/* Audit font (31/08/2026, screenshot di Fabrizio su questa esatta
                riga): text-xs (12px) era piccolo per una descrizione
                introduttiva di sezione — portato a text-sm (14px), stessa
                dimensione applicata alla gemella identica in
                SearchDiscoveryClient.tsx per restare consistenti. */}
            <p className="text-sm text-ink-2">{PLANNER_MODE_DESCRIPTIONS[mode]}</p>
          </DecorativeIntroCard>
        )}

        <PlannerModeTabs mode={mode} onChange={setMode} />

        {mode === "mappa" && <PlannerMapView pins={mapPins} addresses={addresses} />}

        {mode === "gruppi" && <PlannerGroupsView communities={communities} groups={groups} />}

        {mode === "budget" && <PlannerBudgetView budget={budget} seasonBudgetTarget={seasonBudgetTarget} />}

        {mode === "organizzazione" && (
        <>
        {/* PLANNER BETA v1.1 (Wave 1, punto 2A "Header/Hero") — la sintesi di
            copertura stagionale è ora il PRIMO contenuto di Organizzazione
            (prima degli alert), cosi' "come siamo messi?" è visibile senza
            scroll significativo. Stessi dati/calcolo di prima (planner.
            coveredNeededCount/neededCount/progressPercent, invariati), solo
            riposizionati.
            TRAMA BETA v1.1.1 (FINAL VISUAL CONFORMANCE PASS, punti 1-2) —
            ripristinato l'hero come card compatta con titolo stagione +
            riga "Prossimo passo", per allinearlo al mockup HD approvato
            (era regredito a "X di Y settimane coperte" + barra nuda, senza
            più il ruolo di vero hero). "Prossimo passo" NON usa più solo
            progressPercent>=100 per decidere se rassicurare: quella soglia
            confronta contro l'INTERA stagione (comprese le settimane ormai
            passate, mai più prenotabili), mentre "cosa resta davvero da
            fare" è già disponibile in priorityWeek (stessa fonte della CTA
            "Riempi settimana" sotto) — se non c'è alcuna settimana
            prioritaria, non c'è nulla di azionabile, quindi va mostrata la
            rassicurazione ANCHE con un progressPercent basso (es. "3 di
            16": le 13 settimane restanti sono semplicemente già passate,
            non "da fare"). Verificato con una query read-only reale
            sull'account di test (parent_id 19fb4a74…, kid "Lino", oggi
            2026-09-02): le uniche 3 settimane non ancora trascorse
            (Sett. 14/15/16, Sett. 15 su "Giorni spot" parziali) sono TUTTE
            già coperte da prenotazioni confermate — zero settimane future
            scoperte, quindi "Prossime settimane da completare"/"Riempi
            settimana"/"Suggerimenti per te" non comparivano perché non
            c'era nulla da mostrare (comportamento CORRETTO del filtro
            !covered && !dismissed && !isPast, non un bug), ma l'hero non lo
            comunicava — da qui la sensazione di "non conforme"/rotto.
            TRAMA BETA v1.1.1 — FINAL HERO SEMANTIC FIX (02/09/2026): quel
            fix aveva risolto SOLO la riga "Prossimo passo", non la metrica
            primaria sopra — restava possibile mostrare insieme "3 di 16
            settimane organizzate" (rapporto storico basso, comprese le 13
            settimane passate mai più prenotabili) E "Tutto organizzato"
            (perché priorityWeek è null): due segnali che sembrano
            contraddirsi. Fix: quando esiste almeno una settimana futura
            rilevante (heroWeeks.hasFutureRelevant — stesso perimetro
            !dismissed/!isPast già usato da upcomingWeeks/priorityWeek, non
            toccati), la card diventa "PROSSIME SETTIMANE" e la metrica
            primaria è futureCovered/futureTotal, non più il rapporto
            sull'intera stagione (che resta disponibile solo come nota
            secondaria discreta, quando aggiunge informazione reale). Se
            invece NON esiste alcuna settimana futura rilevante (stagione di
            fatto conclusa), niente "Prossimo passo" artificiale: si mostra
            uno stato conclusivo coerente basato sul rapporto stagionale
            reale. */}
        <div className="mb-4 rounded-2xl bg-white p-4">
          {heroWeeks.hasFutureRelevant ? (
            <>
              <div className="mb-2 font-poppins text-[11px] font-bold uppercase tracking-wide text-ink-3">
                Prossime settimane
              </div>
              <div className="flex items-center justify-between text-[13px] font-semibold text-ink-2">
                <span>
                  {heroWeeks.futureCovered} su {heroWeeks.futureTotal} organizzate
                </span>
              </div>
              <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-[#EEF0F4]">
                <div
                  className="h-full rounded-full bg-trama-violet transition-all"
                  style={{ width: `${heroWeeks.futurePercent}%` }}
                />
              </div>
              <div className="mt-2.5 flex items-center gap-1.5 text-[12.5px]">
                {priorityWeek ? (
                  <>
                    <i className="ti ti-bolt flex-shrink-0 text-[14px] text-trama-violet" />
                    <span className="font-semibold text-ink">
                      Prossimo passo:{" "}
                      <span className="font-medium text-ink-2">
                        completa la Settimana {priorityWeek.index}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <i className="ti ti-circle-check-filled flex-shrink-0 text-[14px] text-green" />
                    <span className="font-semibold text-green">
                      Tutto organizzato
                      {heroWeeks.lastFutureEndDate
                        ? ` fino al ${formatItalianDayMonth(heroWeeks.lastFutureEndDate)}.`
                        : "."}
                    </span>
                  </>
                )}
              </div>
              {/* TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS (§9): alert di
                  coordinamento, SECONDARIO rispetto a un eventuale gap di
                  attività (mostrato SOLO nel ramo "priorityWeek null" sopra —
                  mai insieme al box "Prossimo passo: completa la Settimana
                  N", coerente con PLANNER-ORG-05: nessuna CTA doppia/in
                  competizione). Compatto, una riga, nessuna nuova maxi-card
                  — stesso pattern visivo delle altre righe di questo hero. */}
              {organizationState === "coordination_gap" && (
                <button
                  type="button"
                  onClick={() => {
                    // BUGFIX (vedi commento su weekOverride sopra) — stato
                    // locale aggiornato direttamente, mai una navigazione
                    // same-route: apre il pannello, seleziona la settimana
                    // del gap, e ci scorre sopra (stesso pattern di jumpToWeek
                    // più sotto per gli alert "week").
                    setMode("organizzazione");
                    setCalendarExpanded(true);
                    setWeekOverride(coordinationGap.firstGapWeekStartDate);
                    window.setTimeout(() => {
                      document.getElementById("planner-calendario-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 80);
                  }}
                  className="mt-2 flex w-full items-center gap-1.5 text-left text-[12.5px] active:opacity-70"
                >
                  <i className="ti ti-alert-triangle-filled flex-shrink-0 text-[14px] text-trama-orange" />
                  <span className="font-semibold text-ink">
                    {coordinationGap.totalMissing === 1 ? "1 passaggio da assegnare" : `${coordinationGap.totalMissing} passaggi da assegnare`}
                    {" — "}
                    <span className="font-medium text-ink-2">Settimana {coordinationGap.firstGapWeekIndex}</span>
                  </span>
                  <i className="ti ti-chevron-right ml-auto flex-shrink-0 text-ink-3" />
                </button>
              )}
              {/* Nota storica/stagionale: SOLO secondaria e discreta (mai
                  KPI primario), mostrata solo se aggiunge davvero
                  informazione rispetto al rapporto "prossime settimane"
                  appena mostrato sopra (stagione con settimane passate). */}
              {neededCount !== heroWeeks.futureTotal && (
                <div className="mt-2 text-[11px] text-ink-3">
                  {planner.coveredNeededCount} di {neededCount} nella stagione
                  {neededCount < planner.totalCount && ` · ${planner.totalCount - neededCount} non ti servono`}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-2 font-poppins text-[11px] font-bold uppercase tracking-wide text-ink-3">
                Stagione {weeks[0]?.startDate.slice(0, 4) ?? ""}
              </div>
              <div className="flex items-center justify-between text-[13px] font-semibold text-ink-2">
                <span>{planner.coveredNeededCount} di {neededCount} settimane organizzate</span>
                {neededCount < planner.totalCount && (
                  <span>{planner.totalCount - neededCount} non ti servono</span>
                )}
              </div>
              <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-[#EEF0F4]">
                <div
                  className="h-full rounded-full bg-trama-violet transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-2.5 flex items-center gap-1.5 text-[12.5px]">
                <i className="ti ti-flag-filled flex-shrink-0 text-[14px] text-ink-3" />
                <span className="font-semibold text-ink-2">Stagione conclusa.</span>
              </div>
            </>
          )}
        </div>

        {/* SPRINT CORRETTIVO — un solo avviso mostrato di default (il più
            urgente), "Mostra tutti" per il resto. Vedi allAlerts sopra.
            PLANNER BETA v1.1, punto 3 "Alert" — le sovrapposizioni non hanno
            più un box indipendente (vedi rimozione più sotto): entrano già
            in questo stesso sistema tramite computeOverlapReminders
            (lib/nextgen/reminders.ts), che genera un Promemoria per
            sovrapposizione con azione "link" verso /nextgen/prenotazioni —
            nessun nuovo box alert introdotto. */}
        {/* TRAMA BETA v1.1.1 (FINAL VISUAL CONFORMANCE PASS, punto 4) —
            "Altri N avvisi" deve leggersi collegato semanticamente alla
            card alert sopra: gap ridotto da 1.5 (6px) a 1 (4px), stesso
            peso visivo del link (nessuna nuova classe di enfasi). */}
        {allAlerts.length > 0 && (
          <div className="mb-4 flex flex-col gap-1">
            {(showAllAlerts ? allAlerts : allAlerts.slice(0, 1)).map((a) => {
              // SPRINT 7 — spazio a destra riservato alla X di dismiss, cosi'
              // non si sovrappone al testo o alla freccina di azione.
              const rowClass = `flex w-full items-start gap-2.5 rounded-2xl p-3.5 pr-10 text-left ${a.className}`;
              const inner = (
                <>
                  <span className="text-base leading-none">{a.emoji}</span>
                  <span className="flex-1 text-[12.5px] font-medium">{a.text}</span>
                  {a.action && <i className="ti ti-chevron-right flex-shrink-0 text-base opacity-60" />}
                </>
              );
              // SPRINT 7 (feedback Fabrizio: "troppe notifiche, serve una X
              // per chiuderle") — bottone di chiusura assoluto, SOPRA la
              // card cliccabile (non dentro di essa): un <button> annidato
              // in un altro elemento interattivo (Link/button) non è valido
              // HTML e comunque farebbe scattare anche l'azione del
              // genitore al click. stopPropagation, per sicurezza, se mai il
              // markup cambiasse in futuro.
              const dismissButton = (
                <button
                  type="button"
                  aria-label="Nascondi questo avviso"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDismissedAlertIds((cur) => new Set(cur).add(a.id));
                  }}
                  className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-current opacity-60 active:scale-90 active:opacity-100"
                >
                  <i className="ti ti-x text-[14px]" />
                </button>
              );
              if (!a.action) {
                return (
                  <div key={a.id} className="relative">
                    <div className={rowClass}>{inner}</div>
                    {dismissButton}
                  </div>
                );
              }
              if (a.action.type === "link") {
                return (
                  <div key={a.id} className="relative">
                    <Link href={a.action.href} className={`${rowClass} active:scale-[0.99]`}>
                      {inner}
                    </Link>
                    {dismissButton}
                  </div>
                );
              }
              const action = a.action;
              return (
                <div key={a.id} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (action.type === "week") jumpToWeek(action.index);
                      else if (action.type === "mode") setMode(action.mode);
                    }}
                    className={`${rowClass} active:scale-[0.99]`}
                  >
                    {inner}
                  </button>
                  {dismissButton}
                </div>
              );
            })}
            {/* TRAMA BETA v1.1.1 (UI Refinement, punto 3) — segnalazione:
                "Mostra tutti (6)" sembrava un link scollegato dall'avviso
                sopra. Testo reso contestuale ("Altri N avvisi", N = avvisi
                nascosti, non il totale) invece di ripetere il conteggio
                assoluto — nessuna nuova card, stessa azione/stato
                (showAllAlerts) di prima. */}
            {allAlerts.length > 1 && (
              <button
                type="button"
                onClick={() => setShowAllAlerts((v) => !v)}
                className="self-start text-[11.5px] font-semibold text-trama-violet active:bg-black/[0.04]"
              >
                {showAllAlerts ? "Mostra meno" : `Altri ${allAlerts.length - 1} avvis${allAlerts.length - 1 === 1 ? "o" : "i"}`}
              </button>
            )}
          </div>
        )}

        {/* PLANNER BETA v1.1 (Wave 1, punto 4) — "Prossime settimane da
            completare" sostituisce la Timeline completa come contenuto di
            default: max 3 righe, filtro !covered && !dismissed && !isPast
            (getUpcomingWeeks, lib/nextgen/planner-insights.ts), ordinate per
            index. Ogni riga apre il Dettaglio Settimana (Wave 2). Nessuna
            "Riempi"/"Non mi serve" per riga qui (quella ripetizione resta
            solo nella Timeline completa, consultazione secondaria sotto
            "Vedi tutte le settimane") — l'unica azione diretta è la CTA
            dominante subito sotto, riferita alla settimana prioritaria. */}
        {upcomingWeeks.length > 0 ? (
          <div className="mb-3">
            <div className="mb-2.5 font-poppins text-sm font-bold text-ink">Prossime settimane da completare</div>
            <div className="flex flex-col gap-1.5">
              {upcomingWeeks.map((w) => (
                <Link
                  key={w.index}
                  href={`/nextgen/planner/settimana/${w.startDate}`}
                  className={`flex items-center gap-3 rounded-xl p-3 active:bg-black/[0.06] ${
                    w.status === "priority" ? "bg-trama-lilac/20" : "bg-white"
                  }`}
                >
                  <div className="flex-shrink-0">
                    <div className="whitespace-nowrap text-[12.5px] font-bold text-ink">Settimana {w.index}</div>
                    <div className="whitespace-nowrap text-[10.5px] text-ink-2">{w.dateRange}</div>
                  </div>
                  <div className="min-w-0 flex-1 text-[12px] font-medium text-ink-2">{w.statusLabel}</div>
                  <i className="ti ti-chevron-right flex-shrink-0 text-base text-ink-3" />
                </Link>
              ))}
            </div>
          </div>
        ) : null /* nessuna settimana da completare: la rassicurazione "Tutto sotto controllo" è già nell'hero sopra */}

        {/* PLANNER BETA v1.1 (Wave 1, punto 5) — CTA dominante, UNA sola per
            l'Overview: agisce direttamente sulla settimana prioritaria,
            stesso comportamento/link diretto verso Scopri già esistente
            (mai passato dal Dettaglio Settimana — vedi commento del
            prompt: "Il flusso più frequente resta Planner → Riempi
            settimana → Scopri filtrato"). Mostrata solo se esiste una
            settimana prioritaria da riempire. */}
        {priorityWeek && (
          <Link
            href={`/nextgen/search?week=${priorityWeek.startDate}`}
            className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-trama-violet py-3 text-[13.5px] font-bold text-white active:scale-[0.98]"
          >
            <i className="ti ti-bolt text-[15px]" />
            Riempi settimana
          </Link>
        )}

        {/* PLANNER BETA v1.1 (Wave 1, punto 6) — "Suggerimenti — NO
            mini-Scopri": niente più griglia ActivityCard qui, solo un
            teaser leggero che apre il Dettaglio Settimana della settimana
            prioritaria (dove il primo suggerimento è mostrato in evidenza,
            vedi Wave 2). recommendations è già calcolata server-side solo
            per priorityWeek (page.tsx) — se non c'è nessuna settimana
            prioritaria, recommendations è già vuota per costruzione.
            TRAMA BETA v1.1.1 (UI Refinement, punto 5) — il teaser era una
            card bg-white a piena larghezza, che competeva visivamente con
            la CTA dominante "Riempi settimana" appena sopra. Convertito in
            un semplice link testuale terziario (nessun container, icona
            discreta), coerente con "non deve competere con la CTA
            primaria". Stesso href/comportamento/dato, solo peso visivo
            ridotto. */}
        {recommendations.length > 0 && priorityWeek && (
          <Link
            href={`/nextgen/planner/settimana/${priorityWeek.startDate}`}
            className="mb-3 flex items-center gap-1.5 self-start text-[12.5px] font-semibold text-trama-violet active:bg-black/[0.04]"
          >
            <i className="ti ti-sparkles text-[13px]" />
            Suggerimenti per te · {recommendations.length}
            <i className="ti ti-chevron-right text-[13px]" />
          </Link>
        )}

        {/* PLANNER BETA v1.1 (Wave 1, punto 4) — "Vedi tutte le settimane":
            riapre la Timeline completa (tutte le settimane, invariata),
            spostata più sotto come consultazione secondaria invece che
            contenuto di default. */}
        <button
          type="button"
          onClick={() => setTimelineOpen((v) => !v)}
          className="mb-4 self-start text-[12px] font-semibold text-trama-violet active:bg-black/[0.04]"
          aria-expanded={timelineOpen}
        >
          {timelineOpen ? "Nascondi elenco completo" : "Vedi tutte le settimane"}
          <i className={`ti ${timelineOpen ? "ti-chevron-up" : "ti-chevron-down"} ml-1 text-[13px]`} />
        </button>

        {/* Copertura per bambino — "Sofia 7/8 settimane" (mockup condiviso
            da Fabrizio): solo se c'è più di un bambino, altrimenti è un
            doppione della card di copertura sopra.
            SPRINT CORRETTIVO: aggiunto "Mancano Settimana X, Y" (mockup
            "2. Calendario") + click sulla barra apre/chiude il dettaglio
            settimana-per-settimana di quel bambino, sotto.
            PLANNER BETA v1.1 (Wave 1, punto 2B) — l'intera card è ora
            dietro un secondo livello di disclosure (kidCoverageOpen,
            default chiuso): l'intestazione resta sempre visibile come
            bottone di apertura, cosi' nessuna informazione sparisce, solo
            un click in più per il dettaglio riservato alle famiglie con
            più di un figlio. */}
        {kids.length > 1 && (
          <div className="mb-4 rounded-2xl bg-white p-4">
            <button
              type="button"
              onClick={() => setKidCoverageOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
              aria-expanded={kidCoverageOpen}
            >
              <span className="font-poppins text-[13px] font-bold text-ink">Copertura per bambino</span>
              <i className={`ti ${kidCoverageOpen ? "ti-chevron-up" : "ti-chevron-down"} text-[15px] text-ink-3`} />
            </button>
            {kidCoverageOpen && (
            <div className="mt-2.5 flex flex-col gap-2.5">
              {perKidCoverage.map((k) => {
                const percent = k.neededCount > 0 ? Math.round((k.coveredCount / k.neededCount) * 100) : 0;
                const done = k.coveredCount === k.neededCount && k.neededCount > 0;
                const isExpanded = expandedKidId === k.kidId;
                return (
                  <div key={k.kidId}>
                    <button
                      type="button"
                      onClick={() => setExpandedKidId(isExpanded ? null : k.kidId)}
                      className="w-full rounded-xl text-left active:bg-black/[0.06]"
                      aria-expanded={isExpanded}
                    >
                      <div className="mb-1 flex items-center justify-between text-[12.5px]">
                        <span className="font-semibold text-ink">{k.kidName}</span>
                        <span className={done ? "font-semibold text-green" : "text-ink-2"}>
                          {done ? "Tutto organizzato! 🎉" : `${k.coveredCount}/${k.neededCount} settimane`}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EEF0F4]">
                        <div
                          className={`h-full rounded-full ${done ? "bg-green" : "bg-orange-mid/60"}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      {!done && k.missingIndexes.length > 0 && (
                        <p className="mt-1 text-[11px] text-ink-3">
                          Mancano Settimana {k.missingIndexes.join(", ")}
                        </p>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="mt-2 flex flex-wrap gap-1.5 rounded-xl bg-bg p-2.5">
                        {weeks
                          .filter((w) => !w.dismissed)
                          .map((w) => {
                            const covered = w.coveredKids.some((c) => c.kidId === k.kidId);
                            return (
                              <span
                                key={w.index}
                                className={`rounded-full px-2 py-1 text-[10.5px] font-semibold ${
                                  covered ? "bg-[#E8F9EE] text-green" : "bg-white text-ink-3"
                                }`}
                              >
                                {w.index}
                              </span>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* SPRINT CORRETTIVO (feedback Fabrizio): "anche Planner-Calendario
            finirebbero a collassare nella stessa sezione" — Mese/Settimana +
            "Chi fa cosa?" + "Condivisione piano" (PlannerCalendarView,
            invariato) restano tutti raggiungibili da qui, dietro questo
            riquadro pieghevole, invece che da un tab a sé. Bottone chiamato
            "Calendario" di proposito: stesso testo del vecchio tab, cosi il
            click per aprirlo resta identico a prima. */}
        <div className="mb-4" id="planner-calendario-section">
          <button
            type="button"
            onClick={() => setCalendarExpanded((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left active:bg-black/[0.06]"
            aria-expanded={calendarExpanded}
          >
            <span className="flex items-start gap-2">
              <i className="ti ti-calendar mt-0.5 text-[16px] text-trama-violet" />
              <span>
                <span className="block font-poppins text-[13px] font-bold text-ink">Calendario e Chi fa cosa?</span>
                <span className="block text-[11px] font-medium text-ink-2">
                  Mese, settimana e chi accompagna ogni giorno
                </span>
              </span>
            </span>
            <i className={`ti ${calendarExpanded ? "ti-chevron-up" : "ti-chevron-down"} flex-shrink-0 text-[16px] text-ink-3`} />
          </button>
          {calendarExpanded && (
            <div className="mt-3">
              <PlannerCalendarView
                weeks={weeks}
                kids={kids}
                overlaps={overlaps}
                responsibilities={responsibilities}
                existingShares={existingShares}
                parentRole={parentRole}
                familyPeople={familyPeople}
                // TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS (§8): deep-link
                // verso la settimana con il primo gap di coordinamento (dalla
                // query string ?week= all'apertura da Home, O dal click
                // sull'alert qui sopra, che aggiorna weekOverride
                // direttamente — vedi BUGFIX su weekOverride più sopra).
                // PlannerCalendarView valida che corrisponda a una settimana
                // reale prima di usarlo, e reagisce anche ai CAMBI di questo
                // prop dopo il mount (non solo al valore iniziale).
                initialWeekStartDate={weekOverride}
              />
            </div>
          )}
        </div>

        {/* PLANNER BETA v1.1 — il box "Sovrapposizioni da controllare"
            (informativo, non azionabile di per sé) è stato rimosso: le
            sovrapposizioni sono già segnalate dal sistema di alert sopra
            (computeOverlapReminders in lib/nextgen/reminders.ts genera un
            Promemoria per sovrapposizione, azione "link" verso
            /nextgen/prenotazioni) — un secondo box con lo stesso contenuto
            era la ridondanza esplicitamente da eliminare (punto 3 della
            revisione: "le sovrapposizioni devono entrare nello stesso
            sistema [alert], NON creare nuovi box alert indipendenti"). */}

        {/* 3. Timeline familiare — tutte le settimane della stagione.
            SPRINT 2 (feedback Fabrizio: "13 righe piatte sono tante da
            scorrere, si potrebbero raggruppare per mese?") — raggruppata
            per mese, ogni mese pieghevole (aperto di default quello con la
            settimana prioritaria o la prima scoperta, vedi expandedMonths
            sopra). "Estiva {anno}" nel titolo: stesso anno stagionale già
            calcolato da lib/data/season-year.ts, dedotto qui dalla prima
            settimana (nessuna nuova query).
            PLANNER BETA v1.1 (Wave 1, punto 2B/4) — non più visibile di
            default: consultazione secondaria dietro "Vedi tutte le
            settimane" (timelineOpen). Contenuto/comportamento interno
            INVARIATO (Riempi/Non mi serve/Ripristina per riga, righe
            cliccabili verso la prenotazione, week-row-N per lo scroll di
            jumpToWeek). */}
        {timelineOpen && (
        <div className="mb-4">
          <div className="mb-2.5 font-poppins text-sm font-bold text-ink">
            Timeline della stagione{weeks[0] && ` — Estiva ${weeks[0].startDate.slice(0, 4)}`}
          </div>
          <div className="flex flex-col gap-2">
            {monthGroups.map((group) => {
              const isMonthExpanded = expandedMonths.has(group.monthKey);
              const monthNeeded = group.weeks.filter((w) => !w.dismissed).length;
              const monthCovered = group.weeks.filter((w) => w.covered && !w.dismissed).length;
              return (
                <div key={group.monthKey} className="overflow-hidden rounded-xl bg-white">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMonths((cur) => {
                        const next = new Set(cur);
                        if (next.has(group.monthKey)) next.delete(group.monthKey);
                        else next.add(group.monthKey);
                        return next;
                      })
                    }
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left active:bg-black/[0.06]"
                    aria-expanded={isMonthExpanded}
                  >
                    <span className="font-poppins text-[12.5px] font-bold text-ink">{group.monthLabel}</span>
                    <span className="flex items-center gap-2">
                      {monthNeeded > 0 && (
                        <span className="text-[11px] font-semibold text-ink-3">
                          {monthCovered}/{monthNeeded}
                        </span>
                      )}
                      <i className={`ti ${isMonthExpanded ? "ti-chevron-up" : "ti-chevron-down"} text-[15px] text-ink-3`} />
                    </span>
                  </button>
                  {isMonthExpanded && (
                    <div className="flex flex-col gap-1.5 px-1.5 pb-1.5">
                      {group.weeks.map((w) => {
                        const hasOverlap = overlapsByWeekIndex.has(w.index);
                        // FIX (segnalato da Fabrizio: "c'è qualcosa che non
                        // quadra, né nei dati né nei colori" — screenshot con
                        // la striscia "Stato per settimana" che mostrava
                        // sky/"in attesa" per una settimana, mentre la riga
                        // Timeline sotto la stessa settimana la mostrava
                        // arancione/"manca 1 bambino"): questa riga calcolava
                        // il proprio stato con una isPartial locale che
                        // ignorava del tutto w.awaitingPartnerConfirmation
                        // (Sprint 4, DEC-42) — le due viste potevano quindi
                        // disaccordarsi sulla stessa settimana. Ora entrambe
                        // usano la STESSA computeWeekStatus, garantendo che
                        // striscia e Timeline siano sempre coerenti.
                        const status = computeWeekStatus(
                          { ...w, isPast: w.endDate < todayIso },
                          kids.length,
                          hasOverlap,
                          w.index === priorityIndex
                        );
                        const isPartial = status === "partial";
                        const isAwaiting = status === "awaiting";
                        // BUG CORRETTO 06/08/2026 (segnalato da Fabrizio): una
                        // settimana scoperta ma già passata non è più
                        // "azionabile" — niente più CTA "Riempi", niente più
                        // sfondo "priorità".
                        const isPastUncovered = status === "past";
                        const color = w.activityTagColor ?? "sky";
                        const rowBg = w.dismissed
                          ? "bg-white"
                          : w.covered
                            ? isAwaiting
                              ? "bg-sky-light"
                              : isPartial || hasOverlap
                                ? "bg-[#FFF7E8]"
                                : lightBgClasses[color]
                            : isPastUncovered
                              ? "bg-bg"
                              : w.index === priorityIndex
                                ? "bg-trama-lilac/20"
                                : "bg-white";

                        // SPRINT CORRETTIVO — id + anello viola temporaneo:
                        // bersaglio dello scroll-to + evidenziazione quando
                        // si clicca la barra corrispondente in "Stato per
                        // settimana" sopra.
                        const isHighlighted = highlightedWeekIndex === w.index;
                        // SPRINT 2 (feedback Fabrizio: "la riga di una
                        // settimana coperta non porta da nessuna parte") —
                        // stesso pattern già usato in components/PlannerView.tsx
                        // (LEGACY): hover/active feedback + apertura della
                        // scheda attività quando esiste uno slug reale.
                        const rowContent = (
                          <>
                            {/* SEGNALAZIONE DI FABRIZIO: "settimana 12 e 13
                                vanno a capo" — con una larghezza fissa
                                (84px) "Settimana 12"/"Settimana 13" (12
                                caratteri, più larghi di "Settimana 1".."Settimana 9")
                                arrivavano al limite e andavano a capo.
                                whitespace-nowrap + larghezza automatica
                                (solo flex-shrink-0, nessun width fisso): la
                                colonna si allarga quanto serve, il testo non
                                va mai a capo, qualunque sia il numero della
                                settimana.
                                TRAMA BETA v1.1.1 (FINAL VISUAL CONFORMANCE
                                PASS, punto 5) — "Settimana N" + range date su
                                UNA sola riga ("Sett. 3 · GIU 15-19") invece di
                                due righe impilate: la Timeline completa
                                occupava troppo spazio verticale ("5
                                settimane passate quasi un'intera viewport").
                                Stesso identico dato (w.index/w.dateRange),
                                solo compattato — nessuna informazione persa. */}
                            <div className="flex-shrink-0 whitespace-nowrap text-[12px] font-bold text-ink">
                              Sett. {w.index} <span className="font-medium text-ink-3">· {w.dateRange}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              {w.dismissed ? (
                                <span className="text-[12px] text-ink-3">Non ti serve</span>
                              ) : w.covered ? (
                                // BUGFIX (segnalato da Fabrizio: "la scritta si
                                // sovrappone" sull'icona a destra, testo lungo
                                // tipo "in attesa di conferma del centro") —
                                // "truncate" di Tailwind (overflow/ellipsis/
                                // nowrap) non ha alcun effetto su un elemento
                                // inline di default: senza "block" lo span non
                                // viene mai vincolato alla larghezza del
                                // contenitore flex-1, quindi il testo lungo
                                // trabocca visivamente sopra le icone a destra
                                // invece di troncarsi con "…".
                                <span className="block truncate text-[12.5px] font-semibold text-ink">
                                  {w.activityName}
                                  {/* "awaiting" ha priorità: comunica prima
                                      che il centro non ha ancora risposto,
                                      il conteggio bambini scoperti è un
                                      dettaglio secondario in quel caso.
                                      FIX (TRAMA FINAL HARDENING CLOSURE,
                                      04/09/2026) — "partial" scatta anche
                                      per w.dayBookingOnly (settimana coperta
                                      SOLO da Giorni spot, vedi
                                      lib/data/planner.ts), dove TUTTI i
                                      bambini possono già essere coperti
                                      (kids.length - coveredKids.length = 0):
                                      prima di questo fix il testo diceva
                                      comunque "manca 0 bambino/i", una frase
                                      senza senso. Ora mostra il conteggio
                                      SOLO se davvero manca almeno un
                                      fratello, altrimenti la stessa
                                      etichetta generica "Confermata
                                      parzialmente" già usata altrove
                                      nell'app per lo stesso stato
                                      (PARTNER_DECISION_LABEL.partial,
                                      lib/booking-response/effective-decision.ts). */}
                                  {isAwaiting
                                    ? " · in attesa di conferma del centro"
                                    : isPartial &&
                                      (kids.length - w.coveredKids.length > 0
                                        ? ` · manca ${kids.length - w.coveredKids.length} bambino/i`
                                        : " · confermata parzialmente")}
                                </span>
                              ) : isPastUncovered ? (
                                <span className="text-[12px] font-medium text-ink-3">Settimana passata</span>
                              ) : (
                                <span className="text-[12px] font-medium text-ink-3">
                                  Scoperta{w.index === priorityIndex ? " · priorità" : ""}
                                </span>
                              )}
                            </div>
                            {/* BUGFIX (segnalato da Fabrizio: "se non mi
                                serve perché c'è il triangolino?") — il
                                triangolo ignorava completamente lo stato
                                "dismissed": una settimana "Non ti serve" con
                                una sovrapposizione rilevata lo mostrava
                                comunque, in contraddizione con la riga
                                stessa. Il segnale resta comunque visibile
                                nel box "Sovrapposizioni da controllare"
                                sopra. */}
                            {/* BUGFIX (segnalato da Fabrizio: "se non mi
                                serve perché c'è il triangolino?") — il
                                triangolo ignorava completamente lo stato
                                "dismissed": una settimana "Non ti serve" con
                                una sovrapposizione rilevata lo mostrava
                                comunque, in contraddizione con la riga
                                stessa. Il segnale resta comunque visibile
                                nel box "Sovrapposizioni da controllare"
                                sopra. */}
                            {hasOverlap && !w.dismissed && (
                              <i className="ti ti-alert-triangle flex-shrink-0 text-base text-[#9a6b00]" />
                            )}
                            {w.covered && !hasOverlap && (
                              // FIX: una settimana "awaiting" è prenotata ma
                              // NON ancora accettata dal centro — mostrare
                              // uno spuntone verde/arancione (come per
                              // covered/partial) comunicherebbe "fatto",
                              // fuorviante. Icona a orologio + colore sky,
                              // coerente con la barra "Stato per settimana".
                              <i
                                className={`ti ${isAwaiting ? "ti-clock-filled" : "ti-circle-check-filled"} flex-shrink-0 text-[18px] ${
                                  isAwaiting ? "text-sky" : isPartial ? "text-[#9a6b00]" : "text-green"
                                }`}
                              />
                            )}
                            {/* SPRINT 2 (feedback Fabrizio: "la riga di una
                                settimana coperta non porta da nessuna
                                parte") — freccina di affordance SOLO quando
                                la riga è davvero cliccabile (attività con
                                slug reale), in aggiunta all'icona di stato
                                sopra, non al suo posto. */}
                            {w.covered && w.bookingId && (
                              <i className="ti ti-chevron-right flex-shrink-0 text-base text-ink-3" />
                            )}
                          </>
                        );

                        // FIX (Task #357, segnalato da Fabrizio: "il click porta
                        // alla sezione del centro... ma non mi dà info della mia
                        // prenotazione") — per una settimana coperta il click
                        // portava a /activity/{slug}, la scheda marketing
                        // "Prenota ora", che non mostra affatto lo stato della
                        // prenotazione già fatta (accettata/in attesa/rifiutata,
                        // azioni modifica/annulla). Decisione presa in coerenza
                        // con la documentazione TRAMA ONE (FEATURE_PARITY_MATRIX/
                        // DECISION_LOG DEC-06/DEC-42: il Planner resta una
                        // proiezione in sola lettura, senza stato mutabile
                        // proprio) — REUSE di "Le mie prenotazioni", che ha già
                        // stato/decisione/azioni per ogni prenotazione, invece di
                        // un nuovo pannello inline che duplicherebbe quella
                        // logica. ?bookingId= evidenzia/scrolla la prenotazione
                        // specifica (vedi PrenotazioniClient.tsx).
                        if (w.covered && w.bookingId) {
                          return (
                            <Link
                              key={w.index}
                              id={`week-row-${w.index}`}
                              href={`/nextgen/prenotazioni?bookingId=${w.bookingId}`}
                              className={`flex items-center gap-2.5 rounded-lg py-2 px-2.5 transition-colors hover:bg-black/[0.03] active:bg-black/[0.06] ${rowBg} ${
                                isHighlighted ? "ring-2 ring-trama-violet" : ""
                              }`}
                            >
                              {rowContent}
                            </Link>
                          );
                        }
                        // TRAMA BETA v1.1.1 (UI Refinement, punto 6) —
                        // "quando si espande la Timeline, non deve
                        // ricomparire il vecchio Planner denso... niente CTA
                        // 'Riempi' ripetute". La riga stessa diventa
                        // navigabile verso il Dettaglio Settimana (Wave 2 di
                        // Planner Beta v1.1): lì il genitore trova la stessa
                        // identica capability (suggerimento principale +
                        // "Vedi tutte in Scopri", entrambi con "?week=" già
                        // preselezionato) senza bisogno di un secondo bottone
                        // "Riempi" ripetuto per ogni riga. Nessuna capability
                        // persa, solo un salto indiretto in più — coerente
                        // con il modello di progressive disclosure già
                        // adottato per "Prossime settimane da completare".
                        // Righe "Non ti serve"/passate NON diventano
                        // navigabili (il Dettaglio Settimana non gestisce
                        // quegli stati in modo utile): restano righe
                        // informative, invariate. "Non mi serve"/"Ripristina"
                        // restano bottoni SEPARATI dal Link (mai annidati:
                        // un <button> dentro un <a> non è HTML valido).
                        return (
                          <div
                            key={w.index}
                            id={`week-row-${w.index}`}
                            className={`flex items-center gap-2.5 rounded-lg py-2 px-2.5 transition-shadow ${rowBg} ${
                              isHighlighted ? "ring-2 ring-trama-violet" : ""
                            }`}
                          >
                            {!w.dismissed && !isPastUncovered ? (
                              <Link
                                href={`/nextgen/planner/settimana/${w.startDate}`}
                                className="flex min-w-0 flex-1 items-center gap-2.5 active:bg-black/[0.06]"
                              >
                                {rowContent}
                                {/* Affordance di clickabilità — prima limitata
                                    alle sole righe coperte con bookingId,
                                    ora serve anche qui perché l'intera riga
                                    è diventata un link verso il Dettaglio
                                    Settimana. */}
                                {!(w.covered && w.bookingId) && (
                                  <i className="ti ti-chevron-right flex-shrink-0 text-base text-ink-3" />
                                )}
                              </Link>
                            ) : (
                              <div className="flex min-w-0 flex-1 items-center gap-2.5">{rowContent}</div>
                            )}
                            {/* Wiring "Non ti serve"/"Ripristina" (26/08/2026,
                                Fabrizio: l'azione esisteva solo lato LEGACY,
                                components/PlannerView.tsx — stessa azione
                                server toggleWeekDismissedAction, stesso campo
                                dati profiles.dismissed_weeks, mai raggiungibile
                                da qui prima d'ora). Stessa regola di
                                PlannerView: il toggle si mostra solo per
                                settimane NON coperte (una settimana coperta
                                mostra sempre lo stato reale della
                                prenotazione, mai un dismiss — qui non
                                arriverebbe comunque, quella coperta+bookingId
                                usa il ramo Link sopra) e mai per una settimana
                                già passata (isPastUncovered), che non è più
                                azionabile in nessun verso. */}
                            {w.dismissed ? (
                              <button
                                type="button"
                                onClick={() => toggleDismissed(w)}
                                disabled={savingWeek === w.startDate}
                                className="flex-shrink-0 text-[11px] font-semibold text-sky disabled:opacity-60"
                              >
                                Ripristina
                              </button>
                            ) : (
                              !w.covered &&
                              !isPastUncovered && (
                                <button
                                  type="button"
                                  onClick={() => toggleDismissed(w)}
                                  disabled={savingWeek === w.startDate}
                                  className="flex-shrink-0 text-[11px] font-medium text-ink-3 underline disabled:opacity-60"
                                >
                                  Non mi serve
                                </button>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* PLANNER BETA v1.1 (Wave 1, punto 6) — la card "Budget impegnato"
            era già stata rimossa in precedenza (vive solo nel tab Budget) e
            la griglia completa "Consigliate"/"Per riempire" (ActivityCard a
            elenco) che viveva qui in fondo alla pagina è stata rimossa in
            questa wave: sostituita dal teaser leggero "Suggerimenti per te
            · N" più in alto, che apre il Dettaglio Settimana. Nessuna
            griglia ActivityCard resta in Organizzazione: quella è
            esclusiva di Scopri. */}
        </>
        )}

      </div>
    </div>
  );
}
