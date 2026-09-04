"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StepIndicator from "@/components/StepIndicator";
import WeekCard from "@/components/WeekCard";
import KidRow from "@/components/KidRow";
import PayMethodCard from "@/components/PayMethodCard";
import { Activity, DayAvailability, Kid, Week } from "@/lib/types";
import { createBookingAction, BookingWeekConflict } from "./actions";
import { cancelBookingAction } from "@/app/actions/bookings";
import AddKidForm from "@/components/AddKidForm";
import { ComingSoonBadge } from "@/components/StatusBadge";
import { buildFamilyTiers, familyDiscountAmount } from "@/lib/family-discount";
import { calculateDayBookingCost, dayPrice } from "@/lib/day-pricing";
import type { EligibleInviteDiscount } from "@/lib/data/invites";

const paymentMethodMap: Record<string, "card" | "apple_pay" | "bank_transfer"> = {
  card: "card",
  apple: "apple_pay",
  bank: "bank_transfer",
};

// "Prenotabile" = questa attività copre davvero questa settimana della
// stagione, ci sono ancora posti, e non è già coperta da una prenotazione
// confermata di questo genitore per la stessa attività (altrimenti sarebbe
// possibile prenotarla due volte) — le altre (offered:false, soldOut,
// bookedWeekIds) sono mostrate ma non selezionabili.
function bookable(w: Week, bookedWeekIds: Set<string>): boolean {
  return w.offered !== false && !w.soldOut && !bookedWeekIds.has(w.id);
}

export default function BookingClient({
  activity,
  weeks,
  kids: initialKids,
  bookedWeekIds: bookedWeekIdsList,
  inviteDiscount,
  days = [],
  nextgen = false,
}: {
  activity: Activity;
  weeks: Week[];
  kids: Kid[];
  bookedWeekIds: string[];
  // Sconto invito ancora da usare per questo genitore (se si è registrato
  // con un codice invito del Gestore) — al massimo uno, si applica una sola
  // volta alla prima prenotazione idonea (vedi lib/data/invites.ts).
  inviteDiscount: EligibleInviteDiscount | null;
  // TRAMA ONE Build Sprint 3 — "Giorni spot": disponibilità giorno-per-
  // giorno, valorizzata da app/booking/[id]/page.tsx solo quando
  // bookingMode !== "week_only". Vuoto per ogni altra attività — nessun
  // cambio di comportamento lì.
  days?: DayAvailability[];
  // nextgen (01/09/2026, segnalazione Fabrizio "grafica legacy" nel flusso di
  // prenotazione): non esiste /nextgen/booking/... dedicata, Legacy e
  // NextGen linkano entrambi a /booking/[id] — il flag è risolto server-side
  // in app/booking/[id]/page.tsx (stesso resolver TRAMA_ONE_ENABLED di
  // resolveHomeHref() in .../success/page.tsx) e passato qui. Default false:
  // nessun impatto sul call site quando il flag risolve a false.
  nextgen?: boolean;
}) {
  const accentBg = nextgen ? "bg-trama-violet" : "bg-sky";
  const accentText = nextgen ? "text-trama-violet" : "text-sky";
  const accentLight = nextgen ? "bg-trama-lilac/20" : "bg-sky-light";
  const accentBorder = nextgen ? "border-trama-lilac/50" : "border-sky-mid";
  const accentHoverBg = nextgen ? "hover:bg-[#594F9E]" : "hover:bg-[#3A9FDC]";
  const accentHoverText = nextgen ? "hover:text-trama-violet" : "hover:text-sky";
  const accentHoverBorder = nextgen ? "hover:border-trama-violet" : "hover:border-sky";
  const titleCls = nextgen ? "font-poppins text-base font-bold text-ink" : "text-base font-bold text-ink";
  const bookedWeekIds = useMemo(() => new Set(bookedWeekIdsList), [bookedWeekIdsList]);
  const router = useRouter();
  const searchParams = useSearchParams();
  // Impostato quando si arriva dal pulsante "Riempi" del Planner in Home,
  // per una settimana specifica (startDate ISO della settimana stagionale).
  const requestedWeekStart = searchParams.get("week");
  // BUG CORRETTO 07/08/2026 (segnalato da Fabrizio: "se selezionano più
  // settimane come si comporta?") — Scopri (SearchDiscoveryClient) permette
  // di selezionare PIÙ settimane nel filtro "Riempi", ma questa pagina
  // capiva solo una singola "?week=". "?weeks=<start1>,<start2>" (plurale,
  // vedi app/activity/[id]/DetailClient.tsx#bookingHref) le porta avanti
  // tutte; "?week=" singolare resta supportato per compatibilità con i link
  // già esistenti (es. missions.ts, Home).
  const requestedWeekStartsParam = searchParams.get("weeks");
  const requestedWeekStarts = useMemo(() => {
    if (requestedWeekStartsParam) return requestedWeekStartsParam.split(",").filter(Boolean);
    return requestedWeekStart ? [requestedWeekStart] : [];
  }, [requestedWeekStartsParam, requestedWeekStart]);
  // Se in Home era selezionato un bambino specifico (famiglie con più
  // figli con esigenze diverse), lo ritroviamo qui e lo preselezioniamo al
  // posto del primo bambino della lista.
  const requestedKidId = searchParams.get("kid");

  // TRAMA ONE Build Sprint 3 — "context object" leggero: source/cid arrivano
  // dal dettaglio attività (a sua volta dalla card di Ricerca), propagati
  // qui e poi passati a createBookingAction per un log server-side
  // correlato (event "booking_created", vedi actions.ts e
  // lib/telemetry/correlation.ts). Facoltativi.
  const sourceParam = searchParams.get("source");
  const cidParam = searchParams.get("cid");

  // TRAMA ONE Build Sprint 3 — "Giorni spot": presente SOLO quando il
  // genitore ha scelto giorni singoli nella scheda attività (DetailClient) —
  // in quel caso questa prenotazione è "a giorni", non a settimana: lo step 1
  // mostra il riepilogo dei giorni scelti invece della griglia settimanale, e
  // selectedWeeks resta sempre vuoto (vedi inizializzazione più sotto).
  const requestedDayDates = useMemo(() => {
    const raw = searchParams.get("days");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams]);
  const dayBookingMode = requestedDayDates.length > 0;
  const selectedDayRows = useMemo(
    () =>
      days
        .filter((d) => requestedDayDates.includes(d.date))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [days, requestedDayDates]
  );
  const daysCostPerChild = useMemo(
    () => calculateDayBookingCost(days, requestedDayDates, activity.pricePerWeek),
    [days, requestedDayDates, activity.pricePerWeek]
  );

  // Settimana su cui centrare il selettore: quella richiesta dal Planner se
  // questa attività la copre davvero, altrimenti la prima disponibile —
  // altrimenti chi arriva da "Riempi" con una settimana precisa in mente si
  // ritroverebbe a dover ricercare da capo tra tutte le settimane.
  const focusWeek = useMemo(() => {
    if (requestedWeekStarts.length > 0) {
      const match = weeks.find((w) => w.startDate === requestedWeekStarts[0]);
      if (match) return match;
    }
    return weeks.find((w) => bookable(w, bookedWeekIds)) ?? weeks[0];
  }, [weeks, requestedWeekStarts, bookedWeekIds]);

  // Quante delle settimane richieste da "Riempi"/Scopri esistono davvero
  // qui e sono prenotabili — usato per mostrare la conferma "Hai già scelto
  // queste settimane" invece di lasciare che l'utente debba accorgersene da
  // solo dal solo bordo colorato delle card.
  const requestedWeeksConfirmed = useMemo(
    () =>
      weeks.filter(
        (w) => Boolean(w.startDate) && requestedWeekStarts.includes(w.startDate!) && bookable(w, bookedWeekIds)
      ),
    [weeks, requestedWeekStarts, bookedWeekIds]
  );
  const requestedWeekConfirmed = requestedWeeksConfirmed.length > 0;

  // FEATURE servizi extra (segnalazione Fabrizio 04/09/2026: "il genitore
  // deve poter scegliere se accedere a tutti i servizi es. mensa,
  // pre-scuola") — "step" non è più fisso a 3: uno step "Servizi" in più
  // compare SOLO se l'attività offre almeno un servizio selezionabile (vedi
  // hasAnyService/stepSequence sotto), quindi il tipo diventa un numero
  // generico invece di 1|2|3.
  const [step, setStep] = useState<number>(1);
  const [kids, setKids] = useState<Kid[]>(initialKids);
  // Scelta esplicita del genitore per ciascun servizio extra, per l'INTERA
  // prenotazione (nessuna eccezione per singolo giorno/settimana, deciso con
  // Fabrizio) — default OFF: prima di questa feature la navetta veniva
  // inclusa/addebitata AUTOMATICAMENTE se il centro la offriva, mai una vera
  // scelta. Pre-scuola/post-scuola/mensa erano solo badge informativi, mai
  // selezionabili né addebitabili: ora lo sono, stesso principio.
  const [shuttleSelected, setShuttleSelected] = useState(false);
  const [preServiceSelected, setPreServiceSelected] = useState(false);
  const [postServiceSelected, setPostServiceSelected] = useState(false);
  const [mealSelected, setMealSelected] = useState(false);
  // BUG CORRETTO 07/08/2026 — se da Scopri arrivano più settimane
  // selezionate, le preseleziona TUTTE (quelle davvero prenotabili qui),
  // non solo la prima: prima l'utente doveva riselezionarle a mano una per
  // una, perdendo il senso stesso di aver scelto più settimane nel filtro.
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>(() => {
    if (dayBookingMode) return [];
    if (requestedWeeksConfirmed.length > 0) return requestedWeeksConfirmed.map((w) => w.id);
    return focusWeek && bookable(focusWeek, bookedWeekIds) ? [focusWeek.id] : [];
  });
  // Di default si vede solo la settimana scelta + quella prima/dopo (utile
  // per lo sconto multi-settimana) — "Vedi tutte" espande alla griglia
  // completa di 13 settimane, colorata come nel Planner.
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [selectedKids, setSelectedKids] = useState<string[]>(() => {
    if (requestedKidId && kids.some((k) => k.id === requestedKidId)) return [requestedKidId];
    return [kids[0]?.id].filter(Boolean) as string[];
  });
  const [payMethod, setPayMethod] = useState("card");
  const [showAddKid, setShowAddKid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Richiesta di Fabrizio: avviso (non bloccante) se il bambino ha già
  // un'altra attività nella stessa settimana. Se createBookingAction
  // restituisce dei conflitti, li mostriamo qui invece di un errore — il
  // genitore può annullare o confermare comunque (nel qual caso si
  // richiama l'azione con confirmOverlap:true).
  const [weekConflicts, setWeekConflicts] = useState<BookingWeekConflict[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Ogni cambio step riparte dall'inizio del contenuto: senza questo, se lo
  // step precedente era scrollato in basso (es. tanti bambini in lista), lo
  // step successivo appariva "tagliato" in alto, già scrollato a metà.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const visibleWeeks = useMemo(() => {
    if (showAllWeeks || !focusWeek) return weeks;
    const idx = weeks.findIndex((w) => w.id === focusWeek.id);
    if (idx === -1) return weeks;
    return weeks.slice(Math.max(0, idx - 1), idx + 2);
  }, [weeks, showAllWeeks, focusWeek]);

  // FIX (TRAMA FINAL HARDENING CLOSURE, segnalazione Fabrizio 04/09/2026 —
  // limite residuo dopo il fix del "Continua" bloccato senza settimane) —
  // per un'attività "mista" con settimane esaurite ma giorni spot ancora
  // disponibili, un genitore che clicca "Prenota ora" SENZA aver prima
  // scelto un giorno sulla scheda attività (dayBookingMode resta false,
  // derivato solo da "?days=" nell'URL — vedi requestedDayDates sopra)
  // atterrava qui sulla griglia settimane con OGNI card disabilitata:
  // "Continua" restava correttamente bloccato (nessuna prenotazione
  // sbagliata), ma senza alcun modo di procedere — un vicolo cieco
  // silenzioso, non un errore di integrità dati. hasBookableWeeks/
  // hasBookableDays permettono di riconoscere questo stato e offrire
  // un'uscita esplicita invece di lasciare la griglia bloccata (vedi
  // render sotto). Stesso identico filtro "reale" già usato da
  // DetailClient.tsx/app/activity/[id]/page.tsx per calcolare
  // hasAvailableDay — nessuna nuova regola di disponibilità.
  const hasBookableWeeks = useMemo(() => weeks.some((w) => bookable(w, bookedWeekIds)), [weeks, bookedWeekIds]);
  const hasBookableDays = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    return days.some((d) => d.isOpen && d.date >= todayIso && d.singleDayBookable && d.spotsLeft > 0);
  }, [days]);

  // FEATURE servizi extra — quali servizi ha senso offrire per QUESTA
  // attività/prenotazione. Niente su Giorni spot (dayBookingMode): stesso
  // principio già seguito per la navetta prima di questa feature ("niente
  // regola di proporzionamento a giorno singolo è stata definita... niente
  // costo navetta su Giorni spot invece di inventare una tariffa non
  // richiesta") — esteso qui a pre/post-scuola/mensa per coerenza.
  const canOfferShuttle = !dayBookingMode && activity.shuttlePrice > 0;
  const canOfferPreService = !dayBookingMode && Boolean(activity.preService?.available);
  const canOfferPostService = !dayBookingMode && Boolean(activity.postService?.available);
  // Mensa: mealOption è solo un'informazione statica (inclusa/pranzo al
  // sacco/nessuna) finché il gestore non imposta un sovrapprezzo > 0 — solo
  // allora diventa un servizio SELEZIONABILE dal genitore (vedi
  // ActivityEditForm.tsx e migration_37).
  const canOfferMeal =
    !dayBookingMode && activity.mealOption !== "none" && (activity.mealPriceExtra ?? 0) > 0;
  const hasAnyService = canOfferShuttle || canOfferPreService || canOfferPostService || canOfferMeal;
  // Sequenza di step dinamica: "Servizi" compare SOLO se hasAnyService, così
  // un'attività senza nessun servizio extra ha lo stesso wizard a 3 step di
  // sempre (nessun cambiamento visibile per chi non ne ha bisogno).
  const stepSequence = hasAnyService
    ? (["weeks", "services", "kids", "payment"] as const)
    : (["weeks", "kids", "payment"] as const);
  const stepLabels = hasAnyService
    ? ["Settimane", "Servizi", "Bambini", "Pagamento"]
    : ["Settimane", "Bambini", "Pagamento"];
  const totalSteps = stepSequence.length;
  const currentStepKind = stepSequence[Math.min(step, totalSteps) - 1];

  const nWeeks = selectedWeeks.length || 1;
  const kidsCount = selectedKids.length || 1;
  // Prezzo di UN bambino, usato come base sia per il totale sia per
  // calcolare lo sconto famiglia dal 2° bambino — a settimane (× prezzo a
  // settimana) come sempre, OPPURE a Giorni spot (somma dei giorni scelti,
  // sconto per-giorno già incluso — lib/day-pricing.ts) quando dayBookingMode.
  const perChildSubtotal = dayBookingMode ? daysCostPerChild : nWeeks * activity.pricePerWeek;
  const subtotal = perChildSubtotal * kidsCount;
  // Il gestore può personalizzare la % multi-settimana per il proprio centro
  // (activity.centerMultiweekDiscountPercent) — 5% resta il default storico.
  // Non si applica a Giorni spot: non è "multi-settimana", ed eventuali sconti
  // per-giorno sono già dentro daysCostPerChild.
  const multiweekPercent = activity.centerMultiweekDiscountPercent ?? 5;
  const weekDiscount =
    !dayBookingMode && nWeeks >= 2 ? Math.round(subtotal * (multiweekPercent / 100)) : 0;
  const familyTiers = buildFamilyTiers(activity.centerFamilyDiscountTiers);
  const familyDiscount = familyDiscountAmount(perChildSubtotal, kidsCount, familyTiers);
  // Sconto invito: sul subtotale prima degli altri sconti, come gli altri —
  // si applica una sola volta, indipendentemente da quante settimane/bambini.
  const inviteDiscountAmount = inviteDiscount
    ? Math.round(subtotal * (inviteDiscount.percent / 100))
    : 0;
  const groupDiscount = weekDiscount + familyDiscount + inviteDiscountAmount;
  // Navetta/pre-scuola/post-scuola/mensa: prezzo definito oggi solo "a
  // settimana" — nessuna regola di proporzionamento a giorno singolo è
  // stata definita (niente su Giorni spot, vedi canOffer* sopra). Da questa
  // feature (segnalazione Fabrizio "il genitore deve poter scegliere se
  // accedere a tutti i servizi") ciascuno è addebitato SOLO se il genitore
  // lo ha selezionato esplicitamente nello step "Servizi" — prima la
  // navetta veniva inclusa/addebitata automaticamente senza scelta.
  const shuttleCost = canOfferShuttle && shuttleSelected ? activity.shuttlePrice * nWeeks * kidsCount : 0;
  const preServiceCost =
    canOfferPreService && preServiceSelected ? (activity.preService?.priceExtra || 0) * nWeeks * kidsCount : 0;
  const postServiceCost =
    canOfferPostService && postServiceSelected ? (activity.postService?.priceExtra || 0) * nWeeks * kidsCount : 0;
  const mealCost = canOfferMeal && mealSelected ? (activity.mealPriceExtra || 0) * nWeeks * kidsCount : 0;
  const servicesCost = shuttleCost + preServiceCost + postServiceCost + mealCost;
  const total = subtotal - groupDiscount + servicesCost;

  const toggleWeek = (w: Week) => {
    if (!bookable(w, bookedWeekIds)) return;
    setSelectedWeeks((prev) =>
      prev.includes(w.id) ? prev.filter((id) => id !== w.id) : [...prev, w.id]
    );
  };

  const toggleKid = (id: string) =>
    setSelectedKids((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );

  const submitBooking = async (confirmOverlap: boolean) => {
    setSubmitting(true);
    setSubmitError(null);
    const result = await createBookingAction({
      activityDbId: activity.dbId!,
      weekIds: dayBookingMode ? [] : selectedWeeks,
      kidIds: selectedKids,
      dayBookings: dayBookingMode
        ? selectedDayRows
            .filter((d) => Boolean(d.id))
            .map((d) => ({ activityDayId: d.id!, price: dayPrice(d, activity.pricePerWeek) }))
        : undefined,
      totalAmount: total,
      discountAmount: groupDiscount,
      // FEATURE servizi extra: ora una scelta esplicita del genitore (stato
      // sopra), non più calcolata automaticamente da "l'attività la offre".
      shuttleIncluded: canOfferShuttle && shuttleSelected,
      preServiceIncluded: canOfferPreService && preServiceSelected,
      postServiceIncluded: canOfferPostService && postServiceSelected,
      mealIncluded: canOfferMeal && mealSelected,
      paymentMethod: paymentMethodMap[payMethod] ?? "card",
      inviteId: inviteDiscountAmount > 0 ? inviteDiscount?.inviteId : undefined,
      confirmOverlap,
      source: sourceParam ?? undefined,
      correlationId: cidParam ?? undefined,
    });
    setSubmitting(false);

    if (result.conflicts && result.conflicts.length > 0) {
      setWeekConflicts(result.conflicts);
      return;
    }

    if (result.error || !result.bookingId) {
      setSubmitError(result.error || "Qualcosa è andato storto, riprova.");
      return;
    }

    router.push(`/booking/${activity.id}/success?bookingId=${result.bookingId}`);
  };

  // SPRINT CORRETTIVO (feedback Fabrizio: "sullo stesso bambino forse va
  // introdotto un check più stringente") — invece del generico "Prosegui
  // comunque", una scelta esplicita: annullare TUTTE le prenotazioni
  // esistenti in conflitto (una per bambino/attività diversa, deduplicate
  // per id) prima di procedere con quella nuova. cancelBookingAction rispetta
  // già da sola la finestra di cancellazione per-centro: se una delle
  // vecchie non è più annullabile, si ferma e lo dice, senza creare
  // comunque la nuova prenotazione (l'utente può allora scegliere "Mantieni
  // entrambe" invece).
  const cancelOthersAndBook = async () => {
    if (!weekConflicts) return;
    setSubmitting(true);
    setSubmitError(null);
    const otherBookingIds = Array.from(new Set(weekConflicts.map((c) => c.otherBookingId)));
    for (const otherId of otherBookingIds) {
      const res = await cancelBookingAction(otherId);
      if (res.error) {
        setSubmitting(false);
        setSubmitError(`Non sono riuscito ad annullare una prenotazione esistente: ${res.error}`);
        return;
      }
    }
    await submitBooking(true);
  };

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep((s) => s + 1);
      return;
    }

    if (!activity.dbId) {
      // Modalità demo (Supabase non collegato o attività non reale): come prima.
      router.push(`/booking/${activity.id}/success`);
      return;
    }

    await submitBooking(false);
  };

  const kidNames = useMemo(
    () => kids.filter((k) => selectedKids.includes(k.id)).map((k) => k.name),
    [kids, selectedKids]
  );

  // BUG CORRETTO (segnalato da Fabrizio): l'header usava sempre
  // "backHref" -> router.push(`/activity/${activity.id}`), che ad OGNI
  // step (anche il 2°/3°) faceva un push verso il dettaglio invece di
  // tornare allo step precedente. Questo push aggiungeva una voce
  // DUPLICATA di "/activity/[id]" nella cronologia del browser subito
  // DOPO "/booking/[id]" — così, tornando poi sul dettaglio e cliccando LA
  // SUA freccia indietro (che usa correttamente router.back()), si
  // arrivava di nuovo sulla pagina di Prenotazione invece che alla
  // schermata precedente al dettaglio (Cerca/Home). Ora l'header: se lo
  // step è > 1 torna semplicemente allo step precedente (la "X annulla"
  // richiesta) invece di uscire dal flusso; solo dal primo step esce
  // davvero, con router.back() (nessuna voce duplicata, perché è arrivati
  // qui con un push da un <Link>, quindi "indietro" è sempre il dettaglio).
  function handleBack() {
    if (step > 1) {
      setStep((s) => s - 1);
      return;
    }
    router.back();
  }

  return (
    <div className="flex h-full min-h-screen flex-col sm:min-h-0 sm:flex-1">
      <PageHeader title="Prenota il tuo posto" onBack={handleBack} />
      <StepIndicator step={step} labels={stepLabels} nextgen={nextgen} />

      <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto px-5 py-[18px]">
        {currentStepKind === "weeks" && dayBookingMode && (
          <div>
            <div className={`mb-1 ${titleCls}`}>Giorni scelti</div>
            <div className="mb-3 text-[13px] text-ink-2">
              Hai selezionato questi giorni dalla scheda attività — torna indietro per cambiarli
            </div>
            {selectedDayRows.length === 0 ? (
              <p className="mb-3 text-xs font-medium text-orange">
                Nessuno dei giorni scelti risulta più disponibile — torna alla scheda attività e riprova.
              </p>
            ) : (
              <div className="mb-3 flex flex-wrap gap-2">
                {selectedDayRows.map((d) => {
                  const dateObj = new Date(d.date + "T00:00:00Z");
                  return (
                    <span
                      key={d.date}
                      className={`rounded-md ${accentLight} px-2.5 py-1.5 text-[12px] font-semibold text-ink`}
                    >
                      {dateObj.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" })}
                      {d.specialEmoji ? ` ${d.specialEmoji}` : ""}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="rounded-md bg-bg p-3.5">
              <Row
                label={`${selectedDayRows.length} giorn${selectedDayRows.length === 1 ? "o" : "i"} × ${kidsCount} bambin${kidsCount === 1 ? "o" : "i"}`}
                value={`€${subtotal}`}
              />
              {familyDiscount > 0 && (
                <Row label="Sconto famiglia 👨‍👩‍👧‍👦" value={`-€${familyDiscount}`} valueClass="text-green" />
              )}
              {inviteDiscountAmount > 0 && (
                <Row
                  label={`Sconto invito 🎁 (-${inviteDiscount!.percent}%)`}
                  value={`-€${inviteDiscountAmount}`}
                  valueClass="text-green"
                />
              )}
              <Row label="Totale stimato" value={`€${subtotal - groupDiscount}`} total nextgen={nextgen} />
            </div>
          </div>
        )}

        {/* FIX (TRAMA FINAL HARDENING CLOSURE) — vedi commento su
            hasBookableWeeks/hasBookableDays sopra: invece della griglia
            settimane con ogni card disabilitata (vicolo cieco silenzioso),
            un'uscita esplicita verso la scheda attività, dove il genitore
            può scegliere i giorni spot reali (se presenti) o vedere lo
            stato aggiornato di disponibilità. */}
        {currentStepKind === "weeks" && !dayBookingMode && !hasBookableWeeks && (
          <div>
            <div className={`mb-1 ${titleCls}`}>Nessuna settimana disponibile</div>
            <div className="mb-4 text-[13px] text-ink-2">
              {hasBookableDays
                ? "Le settimane intere per questa attività sono al momento esaurite, ma sono ancora disponibili singoli giorni spot."
                : "Al momento questa attività non ha disponibilità reale, né a settimana intera né a giorno singolo."}
            </div>
            <Link
              href={`/activity/${activity.id}`}
              className={`inline-block rounded-lg ${accentBg} px-5 py-3 text-[13px] font-bold text-white transition-all hover:scale-[0.97] ${accentHoverBg}`}
            >
              {hasBookableDays ? "Torna alla scheda per scegliere i giorni" : "Torna alla scheda attività"}
            </Link>
          </div>
        )}

        {currentStepKind === "weeks" && !dayBookingMode && hasBookableWeeks && (
          <div>
            <div className={`mb-1 ${titleCls}`}>Scegli le settimane</div>
            <div className="mb-3 text-[13px] text-ink-2">
              Puoi selezionare più settimane — stessa numerazione del Planner in Home
            </div>
            {requestedWeekConfirmed && requestedWeeksConfirmed.length === 1 && (
              <div className={`mb-3 flex items-center gap-2 rounded-lg border ${accentBorder} ${accentLight} px-3 py-2.5 text-[12px] font-medium text-ink`}>
                <i className={`ti ti-circle-check-filled text-base ${accentText}`} />
                Hai già scelto la <b>{requestedWeeksConfirmed[0].label}</b> ({requestedWeeksConfirmed[0].dates}) dal
                Planner — è selezionata qui sotto.
              </div>
            )}
            {requestedWeekConfirmed && requestedWeeksConfirmed.length > 1 && (
              <div className={`mb-3 flex items-center gap-2 rounded-lg border ${accentBorder} ${accentLight} px-3 py-2.5 text-[12px] font-medium text-ink`}>
                <i className={`ti ti-circle-check-filled text-base ${accentText}`} />
                Hai già scelto {requestedWeeksConfirmed.length} settimane da Scopri — sono selezionate qui sotto.
              </div>
            )}
            <div className="mb-2.5 flex flex-wrap items-center gap-2.5 text-[10px] text-ink-2">
              <Legend swatch="bg-white border-[#E8EBF0]" label="Disponibile" />
              <Legend swatch="bg-yellow-light border-yellow" label="Ultimi posti" />
              <Legend swatch="bg-orange-light border-orange-mid" label="Pieno" />
              <Legend swatch="bg-green-light border-green" label="Già prenotata" />
              <Legend swatch="bg-[#FAFBFD] border-dashed border-[#E8EBF0]" label="Non attiva qui" />
            </div>
            <div className="mb-2.5 grid grid-cols-2 gap-2.5">
              {visibleWeeks.map((w) => (
                <WeekCard
                  key={w.id}
                  week={w}
                  selected={selectedWeeks.includes(w.id)}
                  onToggle={() => toggleWeek(w)}
                  alreadyBooked={bookedWeekIds.has(w.id)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowAllWeeks((v) => !v)}
              className={`mb-4 text-xs font-semibold ${accentText}`}
            >
              {showAllWeeks ? "Mostra solo questa e le vicine" : `Vedi tutte le ${weeks.length} settimane`}
            </button>
            <div className="rounded-md bg-bg p-3.5">
              <Row
                label={`${nWeeks} settiman${nWeeks === 1 ? "a" : "e"} × €${activity.pricePerWeek} × ${kidsCount} bambin${kidsCount === 1 ? "o" : "i"}`}
                value={`€${subtotal}`}
              />
              {weekDiscount > 0 && (
                <Row label="Sconto multi-settimana" value={`-€${weekDiscount}`} valueClass="text-green" />
              )}
              {familyDiscount > 0 && (
                <Row label="Sconto famiglia 👨‍👩‍👧‍👦" value={`-€${familyDiscount}`} valueClass="text-green" />
              )}
              {inviteDiscountAmount > 0 && (
                <Row label={`Sconto invito 🎁 (-${inviteDiscount!.percent}%)`} value={`-€${inviteDiscountAmount}`} valueClass="text-green" />
              )}
              <Row
                label="Totale stimato"
                value={`€${subtotal - groupDiscount}`}
                total
                nextgen={nextgen}
              />
            </div>
          </div>
        )}

        {currentStepKind === "services" && (
          <div>
            <div className={`mb-1 ${titleCls}`}>Servizi extra</div>
            <div className="mb-4 text-[13px] text-ink-2">
              Scegli solo quelli che ti servono — il costo si somma al totale
            </div>
            {canOfferPreService && activity.preService && (
              <ServiceToggleRow
                icon="ti-sunrise"
                title="Ingresso anticipato"
                sub={`Disponibile da ${activity.preService.time}`}
                price={preServiceCost}
                priceLabel={`+€${activity.preService.priceExtra}/sett. × ${kidsCount}`}
                selected={preServiceSelected}
                onToggle={() => setPreServiceSelected((v) => !v)}
                accentBg={accentBg}
                accentBorder={accentBorder}
                accentLight={accentLight}
              />
            )}
            {canOfferPostService && activity.postService && (
              <ServiceToggleRow
                icon="ti-sunset-2"
                title="Uscita posticipata"
                sub={`Disponibile fino a ${activity.postService.time}`}
                price={postServiceCost}
                priceLabel={`+€${activity.postService.priceExtra}/sett. × ${kidsCount}`}
                selected={postServiceSelected}
                onToggle={() => setPostServiceSelected((v) => !v)}
                accentBg={accentBg}
                accentBorder={accentBorder}
                accentLight={accentLight}
              />
            )}
            {canOfferMeal && (
              <ServiceToggleRow
                icon="ti-tools-kitchen-2"
                title="Mensa"
                sub={activity.mealOption === "included" ? "Pasto seguito dal centro" : "Servizio pranzo"}
                price={mealCost}
                priceLabel={`+€${activity.mealPriceExtra}/sett. × ${kidsCount}`}
                selected={mealSelected}
                onToggle={() => setMealSelected((v) => !v)}
                accentBg={accentBg}
                accentBorder={accentBorder}
                accentLight={accentLight}
              />
            )}
            {canOfferShuttle && (
              <ServiceToggleRow
                icon="ti-bus"
                title="Navetta"
                sub="Trasporto da/verso il centro"
                price={shuttleCost}
                priceLabel={`+€${activity.shuttlePrice}/sett. × ${kidsCount}`}
                selected={shuttleSelected}
                onToggle={() => setShuttleSelected((v) => !v)}
                accentBg={accentBg}
                accentBorder={accentBorder}
                accentLight={accentLight}
              />
            )}
            {servicesCost > 0 && (
              <div className="mt-3 rounded-md bg-bg p-3.5">
                <Row label="Servizi extra selezionati" value={`€${servicesCost}`} />
              </div>
            )}
          </div>
        )}

        {currentStepKind === "kids" && (
          <div>
            <div className={`mb-1 ${titleCls}`}>Chi partecipa?</div>
            <div className="mb-4 text-[13px] text-ink-2">Seleziona bambini e aggiungi amici</div>
            <div className="mb-2.5 text-[13px] font-bold text-ink">I tuoi bambini</div>
            {kids.length === 0 && !showAddKid && (
              <p className="mb-2.5 text-xs text-ink-2">
                Non hai ancora aggiunto nessun bambino — aggiungine uno per continuare.
              </p>
            )}
            {kids.map((k) => (
              <KidRow
                key={k.id}
                kid={k}
                selected={selectedKids.includes(k.id)}
                onToggle={() => toggleKid(k.id)}
                nextgen={nextgen}
              />
            ))}

            {showAddKid ? (
              <AddKidForm
                onAdded={(kid) => {
                  setKids((prev) => [...prev, kid]);
                  setSelectedKids((prev) => [...prev, kid.id]);
                  setShowAddKid(false);
                }}
                onCancel={() => setShowAddKid(false)}
              />
            ) : (
              <div
                onClick={() => setShowAddKid(true)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-md border-[1.5px] border-dashed border-[#C5CDD8] p-3 text-[13px] font-medium text-ink-2 transition-colors ${accentHoverBorder} ${accentHoverText}`}
              >
                <i className="ti ti-plus text-xl" />
                Aggiungi bambino
              </div>
            )}
            <div className="mb-1.5 mt-4 flex items-center gap-1.5 text-[13px] font-bold text-ink">
              Andiamo Insieme 🤝
              <ComingSoonBadge />
            </div>
            <div className="mb-2.5 text-xs text-ink-2">Invita amici per sconti di gruppo</div>
            <div className={`mt-2.5 flex items-center gap-3 rounded-md border-[1.5px] ${accentBorder} ${accentLight} p-3 opacity-70 transition-colors`}>
              <div className={`flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full ${accentLight}`}>
                <i className={`ti ti-user-plus text-xl ${accentText}`} />
              </div>
              <div>
                <div className={`text-sm font-semibold ${accentText}`}>Invita un amico</div>
                <div className="text-xs text-ink-2">Ottieni -10% per ogni amico</div>
              </div>
              <i className={`ti ti-share ml-auto text-lg ${accentText}`} />
            </div>
          </div>
        )}

        {currentStepKind === "payment" && (
          <div>
            <div className={`mb-1 ${titleCls}`}>Pagamento</div>
            <div className="mb-4 text-[13px] text-ink-2">Scegli il metodo di pagamento</div>
            <PayMethodCard
              icon="ti-credit-card"
              name="Carta di credito"
              sub="•••• •••• •••• 4242"
              selected={payMethod === "card"}
              onSelect={() => setPayMethod("card")}
              nextgen={nextgen}
            />
            <PayMethodCard
              icon="ti-brand-apple"
              name="Apple Pay"
              sub="Touch ID rapido"
              selected={payMethod === "apple"}
              onSelect={() => setPayMethod("apple")}
              nextgen={nextgen}
            />
            <PayMethodCard
              icon="ti-building-bank"
              name="Bonifico bancario"
              sub="IBAN: IT60 X054 2811..."
              selected={payMethod === "bank"}
              onSelect={() => setPayMethod("bank")}
              nextgen={nextgen}
            />
            <div className="mt-4 rounded-md bg-bg p-3.5">
              <Row
                label={
                  dayBookingMode
                    ? `${activity.name} (${selectedDayRows.length} giorni)`
                    : `${activity.name} (${nWeeks} sett.)`
                }
                value={`€${subtotal}`}
              />
              <Row
                label={`${kidNames.join(", ") || "Bambino"} — ${selectedKids.length} bambino${selectedKids.length === 1 ? "" : "i"}`}
                value={`×${selectedKids.length || 1}`}
              />
              {preServiceCost > 0 && (
                <Row label={`Ingresso anticipato (${nWeeks} sett. × ${kidsCount})`} value={`€${preServiceCost}`} />
              )}
              {postServiceCost > 0 && (
                <Row label={`Uscita posticipata (${nWeeks} sett. × ${kidsCount})`} value={`€${postServiceCost}`} />
              )}
              {mealCost > 0 && (
                <Row label={`Mensa (${nWeeks} sett. × ${kidsCount})`} value={`€${mealCost}`} />
              )}
              {shuttleCost > 0 && (
                <Row label={`Navetta (${nWeeks} sett. × ${kidsCount})`} value={`€${shuttleCost}`} />
              )}
              {weekDiscount > 0 && (
                <Row label="Sconto multi-settimana" value={`-€${weekDiscount}`} valueClass="text-green" />
              )}
              {familyDiscount > 0 && (
                <Row label="Sconto famiglia 👨‍👩‍👧‍👦" value={`-€${familyDiscount}`} valueClass="text-green" />
              )}
              {inviteDiscountAmount > 0 && (
                <Row label={`Sconto invito 🎁 (-${inviteDiscount!.percent}%)`} value={`-€${inviteDiscountAmount}`} valueClass="text-green" />
              )}
              <Row label="Totale" value={`€${total}`} total nextgen={nextgen} />
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-[#F0F2F5] bg-white px-5 py-3.5 pb-5">
        {submitError && (
          <p className="mb-2 text-center text-xs font-medium text-orange">{submitError}</p>
        )}

        {/* Avviso prenotazioni sovrapposte — richiesta di Fabrizio: "evitare
            di farne multiple su diverse attività nella stessa settimana".
            Non è un blocco rigido (alcune famiglie vogliono davvero due
            attività nella stessa settimana, es. mattina/pomeriggio), ma
            SPRINT CORRETTIVO ("sullo stesso bambino forse va introdotto un
            check più stringente"): niente più un generico "Prosegui
            comunque" cliccabile senza pensarci — una scelta esplicita tra
            tenere entrambe le prenotazioni o annullare quella vecchia. */}
        {weekConflicts && weekConflicts.length > 0 && (
          <div className="mb-3 rounded-lg border border-orange-mid bg-orange-light px-3.5 py-3 text-[12.5px] text-ink">
            <div className="mb-1.5 flex items-center gap-1.5 font-bold text-[#9a5300]">
              <i className="ti ti-alert-triangle text-base" />
              Attenzione: settimana già impegnata
            </div>
            <ul className="mb-2.5 flex flex-col gap-1">
              {weekConflicts.map((c, i) => (
                <li key={i}>
                  <b>{c.kidName}</b> ha già <b>{c.otherActivityName}</b> nella <b>{c.weekLabel}</b>
                </li>
              ))}
            </ul>
            <p className="mb-2 text-[11.5px] text-[#7a5400]">Cosa vuoi fare?</p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => submitBooking(true)}
                className="rounded-lg bg-white py-2 text-[13px] font-bold text-ink disabled:opacity-50"
              >
                {submitting ? "Attendere…" : "Mantieni entrambe"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={cancelOthersAndBook}
                className="rounded-lg bg-ink py-2 text-[13px] font-bold text-white disabled:opacity-50"
              >
                {submitting ? "Attendere…" : "Annulla l'altra e prenota questa"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setWeekConflicts(null)}
                className="py-1 text-[12.5px] font-semibold text-ink-2 disabled:opacity-50"
              >
                Annulla (non prenotare)
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleNext}
          disabled={
            submitting ||
            (currentStepKind === "weeks" && dayBookingMode && selectedDayRows.length === 0) ||
            // FIX (TRAMA FINAL HARDENING CLOSURE, segnalazione live
            // 04/09/2026: "il tasto Prenota ora... e il flusso va avanti"
            // per un'attività senza nessuna settimana realmente
            // selezionabile) — il ramo "settimana intera" (!dayBookingMode)
            // non aveva MAI il proprio controllo equivalente: si poteva
            // premere "Continua" con zero settimane selezionate (tutte
            // "Non attiva qui"/esaurite) e proseguire fino al passo
            // Bambini/Pagamento con una prenotazione che non ha alcuna
            // settimana da associare. Stesso principio già applicato al
            // ramo giorni (riga sopra), qui semplicemente mancava.
            (currentStepKind === "weeks" && !dayBookingMode && selectedWeeks.length === 0) ||
            (currentStepKind === "kids" && selectedKids.length === 0)
          }
          className={`w-full rounded-lg ${accentBg} py-[15px] text-[15px] font-bold text-white transition-colors ${accentHoverBg} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {submitting ? "Attendere…" : currentStepKind === "payment" ? "Conferma e paga" : "Continua"}
        </button>
      </div>
    </div>
  );
}

// FEATURE servizi extra (segnalazione Fabrizio 04/09/2026) — una riga per
// servizio nel nuovo step "Servizi": tocco ovunque sulla riga per
// selezionare/deselezionare, stesso principio già usato per WeekCard/KidRow
// in questo stesso wizard (target di tocco grande, non solo la checkbox).
function ServiceToggleRow({
  icon,
  title,
  sub,
  price,
  priceLabel,
  selected,
  onToggle,
  accentBg,
  accentBorder,
  accentLight,
}: {
  icon: string;
  title: string;
  sub: string;
  price: number;
  priceLabel: string;
  selected: boolean;
  onToggle: () => void;
  accentBg: string;
  accentBorder: string;
  accentLight: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`mb-2.5 flex w-full items-center gap-3 rounded-lg border-[1.5px] p-3 text-left transition-colors ${
        selected ? `${accentBorder} ${accentLight}` : "border-[#E8EBF0] bg-white"
      }`}
    >
      <div
        className={`flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full ${
          selected ? accentBg : "bg-bg"
        }`}
      >
        <i className={`ti ${icon} text-lg ${selected ? "text-white" : "text-ink-2"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-ink">{title}</div>
        <div className="text-[11.5px] text-ink-2">{sub}</div>
        <div className="text-[11px] font-semibold text-ink-3">{priceLabel}</div>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        {price > 0 && <span className="text-[13px] font-bold text-ink">€{price}</span>}
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] ${
            selected ? `${accentBg} border-transparent` : "border-[#C5CDD8] bg-white"
          }`}
        >
          {selected && <i className="ti ti-check text-xs text-white" />}
        </div>
      </div>
    </button>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2.5 w-2.5 rounded-sm border ${swatch}`} />
      {label}
    </span>
  );
}

function Row({
  label,
  value,
  valueClass,
  total,
  nextgen,
}: {
  label: string;
  value: string;
  valueClass?: string;
  total?: boolean;
  // nextgen (audit layout legacy, 02/09/2026): "Totale"/"Totale stimato" era
  // rimasto hardcoded text-sky anche nelle chiamate con nextgen=true, unico
  // residuo blu legacy in un componente altrimenti già dual-mode.
  nextgen?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-1.5 text-[13px] ${
        total
          ? "mt-2 border-t border-[#E8EBF0] pt-2.5 text-[15px] font-bold text-ink"
          : "text-ink-2"
      }`}
    >
      <span>{label}</span>
      <span className={total ? (nextgen ? "text-trama-violet" : "text-sky") : valueClass}>{value}</span>
    </div>
  );
}
