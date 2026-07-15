"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StepIndicator from "@/components/StepIndicator";
import WeekCard from "@/components/WeekCard";
import KidRow from "@/components/KidRow";
import PayMethodCard from "@/components/PayMethodCard";
import { Activity, Kid, Week } from "@/lib/types";
import { createBookingAction, BookingWeekConflict } from "./actions";
import { cancelBookingAction } from "@/app/actions/bookings";
import AddKidForm from "@/components/AddKidForm";
import { ComingSoonBadge } from "@/components/StatusBadge";
import { buildFamilyTiers, familyDiscountAmount } from "@/lib/family-discount";
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
}: {
  activity: Activity;
  weeks: Week[];
  kids: Kid[];
  bookedWeekIds: string[];
  // Sconto invito ancora da usare per questo genitore (se si è registrato
  // con un codice invito del Gestore) — al massimo uno, si applica una sola
  // volta alla prima prenotazione idonea (vedi lib/data/invites.ts).
  inviteDiscount: EligibleInviteDiscount | null;
}) {
  const bookedWeekIds = useMemo(() => new Set(bookedWeekIdsList), [bookedWeekIdsList]);
  const router = useRouter();
  const searchParams = useSearchParams();
  // Impostato quando si arriva dal pulsante "Riempi" del Planner in Home,
  // per una settimana specifica (startDate ISO della settimana stagionale).
  const requestedWeekStart = searchParams.get("week");
  // Se in Home era selezionato un bambino specifico (famiglie con più
  // figli con esigenze diverse), lo ritroviamo qui e lo preselezioniamo al
  // posto del primo bambino della lista.
  const requestedKidId = searchParams.get("kid");

  // Settimana su cui centrare il selettore: quella richiesta dal Planner se
  // questa attività la copre davvero, altrimenti la prima disponibile —
  // altrimenti chi arriva da "Riempi" con una settimana precisa in mente si
  // ritroverebbe a dover ricercare da capo tra tutte le settimane.
  const focusWeek = useMemo(() => {
    if (requestedWeekStart) {
      const match = weeks.find((w) => w.startDate === requestedWeekStart);
      if (match) return match;
    }
    return weeks.find((w) => bookable(w, bookedWeekIds)) ?? weeks[0];
  }, [weeks, requestedWeekStart, bookedWeekIds]);

  // Vero solo se la settimana richiesta da "Riempi" esiste davvero qui ed è
  // prenotabile — usato per mostrare la conferma "Hai scelto già questa
  // settimana" invece di lasciare che l'utente debba accorgersene da solo
  // dal solo bordo colorato della card.
  const requestedWeekConfirmed = Boolean(
    requestedWeekStart &&
      focusWeek?.startDate === requestedWeekStart &&
      bookable(focusWeek, bookedWeekIds)
  );

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [kids, setKids] = useState<Kid[]>(initialKids);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>(() =>
    focusWeek && bookable(focusWeek, bookedWeekIds) ? [focusWeek.id] : []
  );
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

  const nWeeks = selectedWeeks.length || 1;
  const kidsCount = selectedKids.length || 1;
  // Prezzo di UN bambino (settimane × prezzo a settimana), usato come base
  // sia per il totale sia per calcolare lo sconto famiglia dal 2° bambino.
  const perChildSubtotal = nWeeks * activity.pricePerWeek;
  const subtotal = perChildSubtotal * kidsCount;
  // Il gestore può personalizzare la % multi-settimana per il proprio centro
  // (activity.centerMultiweekDiscountPercent) — 5% resta il default storico.
  const multiweekPercent = activity.centerMultiweekDiscountPercent ?? 5;
  const weekDiscount = nWeeks >= 2 ? Math.round(subtotal * (multiweekPercent / 100)) : 0;
  const familyTiers = buildFamilyTiers(activity.centerFamilyDiscountTiers);
  const familyDiscount = familyDiscountAmount(perChildSubtotal, kidsCount, familyTiers);
  // Sconto invito: sul subtotale prima degli altri sconti, come gli altri —
  // si applica una sola volta, indipendentemente da quante settimane/bambini.
  const inviteDiscountAmount = inviteDiscount
    ? Math.round(subtotal * (inviteDiscount.percent / 100))
    : 0;
  const groupDiscount = weekDiscount + familyDiscount + inviteDiscountAmount;
  const shuttleCost = activity.shuttlePrice * nWeeks * kidsCount;
  const total = subtotal - groupDiscount + shuttleCost;

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
      weekIds: selectedWeeks,
      kidIds: selectedKids,
      totalAmount: total,
      discountAmount: groupDiscount,
      shuttleIncluded: activity.shuttlePrice > 0,
      paymentMethod: paymentMethodMap[payMethod] ?? "card",
      inviteId: inviteDiscountAmount > 0 ? inviteDiscount?.inviteId : undefined,
      confirmOverlap,
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
    if (step < 3) {
      setStep((s) => (s + 1) as 1 | 2 | 3);
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
      setStep((s) => (s - 1) as 1 | 2 | 3);
      return;
    }
    router.back();
  }

  return (
    <div className="flex h-full min-h-screen flex-col sm:min-h-0 sm:flex-1">
      <PageHeader title="Prenota il tuo posto" onBack={handleBack} />
      <StepIndicator step={step} />

      <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto px-5 py-[18px]">
        {step === 1 && (
          <div>
            <div className="mb-1 text-base font-bold text-ink">Scegli le settimane</div>
            <div className="mb-3 text-[13px] text-ink-2">
              Puoi selezionare più settimane — stessa numerazione del Planner in Home
            </div>
            {requestedWeekConfirmed && focusWeek && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-sky-mid bg-sky-light px-3 py-2.5 text-[12px] font-medium text-ink">
                <i className="ti ti-circle-check-filled text-base text-sky" />
                Hai già scelto la <b>{focusWeek.label}</b> ({focusWeek.dates}) dal Planner — è selezionata qui sotto.
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
              className="mb-4 text-xs font-semibold text-sky"
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
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="mb-1 text-base font-bold text-ink">Chi partecipa?</div>
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
                className="flex cursor-pointer items-center gap-2.5 rounded-md border-[1.5px] border-dashed border-[#C5CDD8] p-3 text-[13px] font-medium text-ink-2 transition-colors hover:border-sky hover:text-sky"
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
            <div className="mt-2.5 flex items-center gap-3 rounded-md border-[1.5px] border-[#E3F0FB] bg-sky-light p-3 opacity-70 transition-colors">
              <div className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full bg-sky-light">
                <i className="ti ti-user-plus text-xl text-sky" />
              </div>
              <div>
                <div className="text-sm font-semibold text-sky">Invita un amico</div>
                <div className="text-xs text-ink-2">Ottieni -10% per ogni amico</div>
              </div>
              <i className="ti ti-share ml-auto text-lg text-sky" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="mb-1 text-base font-bold text-ink">Pagamento</div>
            <div className="mb-4 text-[13px] text-ink-2">Scegli il metodo di pagamento</div>
            <PayMethodCard
              icon="ti-credit-card"
              name="Carta di credito"
              sub="•••• •••• •••• 4242"
              selected={payMethod === "card"}
              onSelect={() => setPayMethod("card")}
            />
            <PayMethodCard
              icon="ti-brand-apple"
              name="Apple Pay"
              sub="Touch ID rapido"
              selected={payMethod === "apple"}
              onSelect={() => setPayMethod("apple")}
            />
            <PayMethodCard
              icon="ti-building-bank"
              name="Bonifico bancario"
              sub="IBAN: IT60 X054 2811..."
              selected={payMethod === "bank"}
              onSelect={() => setPayMethod("bank")}
            />
            <div className="mt-4 rounded-md bg-bg p-3.5">
              <Row label={`${activity.name} (${nWeeks} sett.)`} value={`€${subtotal}`} />
              <Row
                label={`${kidNames.join(", ") || "Bambino"} — ${selectedKids.length} bambino${selectedKids.length === 1 ? "" : "i"}`}
                value={`×${selectedKids.length || 1}`}
              />
              {activity.shuttlePrice > 0 && (
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
              <Row label="Totale" value={`€${total}`} total />
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
          disabled={submitting || (step === 2 && selectedKids.length === 0)}
          className="w-full rounded-lg bg-sky py-[15px] text-[15px] font-bold text-white transition-colors hover:bg-[#3A9FDC] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Attendere…" : step === 3 ? "Conferma e paga" : "Continua"}
        </button>
      </div>
    </div>
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
}: {
  label: string;
  value: string;
  valueClass?: string;
  total?: boolean;
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
      <span className={total ? "text-sky" : valueClass}>{value}</span>
    </div>
  );
}
