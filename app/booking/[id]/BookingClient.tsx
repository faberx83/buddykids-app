"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StepIndicator from "@/components/StepIndicator";
import WeekCard from "@/components/WeekCard";
import KidRow from "@/components/KidRow";
import PayMethodCard from "@/components/PayMethodCard";
import { Activity, Kid, Week } from "@/lib/types";
import { createBookingAction } from "./actions";
import AddKidForm from "@/components/AddKidForm";

const paymentMethodMap: Record<string, "card" | "apple_pay" | "bank_transfer"> = {
  card: "card",
  apple: "apple_pay",
  bank: "bank_transfer",
};

export default function BookingClient({
  activity,
  weeks,
  kids: initialKids,
}: {
  activity: Activity;
  weeks: Week[];
  kids: Kid[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [kids, setKids] = useState<Kid[]>(initialKids);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>(
    weeks.filter((w) => !w.soldOut).slice(0, 2).map((w) => w.id)
  );
  const [selectedKids, setSelectedKids] = useState<string[]>([kids[0]?.id].filter(Boolean));
  const [payMethod, setPayMethod] = useState("card");
  const [showAddKid, setShowAddKid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nWeeks = selectedWeeks.length || 1;
  const subtotal = nWeeks * activity.pricePerWeek;
  const groupDiscount = nWeeks >= 2 ? Math.round(subtotal * 0.05) : 0;
  const shuttleCost = activity.shuttlePrice * nWeeks;
  const total = subtotal - groupDiscount + shuttleCost;

  const toggleWeek = (id: string) =>
    setSelectedWeeks((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );

  const toggleKid = (id: string) =>
    setSelectedKids((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );

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

    setSubmitting(true);
    setSubmitError(null);
    const result = await createBookingAction({
      activityDbId: activity.dbId,
      weekIds: selectedWeeks,
      kidIds: selectedKids,
      totalAmount: total,
      discountAmount: groupDiscount,
      shuttleIncluded: activity.shuttlePrice > 0,
      paymentMethod: paymentMethodMap[payMethod] ?? "card",
    });
    setSubmitting(false);

    if (result.error || !result.bookingId) {
      setSubmitError(result.error || "Qualcosa è andato storto, riprova.");
      return;
    }

    router.push(`/booking/${activity.id}/success?bookingId=${result.bookingId}`);
  };

  const kidNames = useMemo(
    () => kids.filter((k) => selectedKids.includes(k.id)).map((k) => k.name),
    [kids, selectedKids]
  );

  return (
    <div className="flex h-full min-h-screen flex-col sm:min-h-0 sm:flex-1">
      <PageHeader title="Prenota il tuo posto" backHref={`/activity/${activity.id}`} />
      <StepIndicator step={step} />

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-[18px]">
        {step === 1 && (
          <div>
            <div className="mb-1 text-base font-bold text-ink">Scegli le settimane</div>
            <div className="mb-4 text-[13px] text-ink-2">Puoi selezionare più settimane</div>
            <div className="mb-4 grid grid-cols-2 gap-2.5">
              {weeks.map((w) => (
                <WeekCard
                  key={w.id}
                  week={w}
                  selected={selectedWeeks.includes(w.id)}
                  onToggle={() => toggleWeek(w.id)}
                />
              ))}
            </div>
            <div className="rounded-md bg-bg p-3.5">
              <Row label={`${nWeeks} settiman${nWeeks === 1 ? "a" : "e"} × €${activity.pricePerWeek}`} value={`€${subtotal}`} />
              {groupDiscount > 0 && (
                <Row label="Sconto gruppo 🎉" value={`-€${groupDiscount}`} valueClass="text-green" />
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
            <div className="mb-1.5 mt-4 text-[13px] font-bold text-ink">Andiamo Insieme 🤝</div>
            <div className="mb-2.5 text-xs text-ink-2">Invita amici per sconti di gruppo</div>
            <div className="mt-2.5 flex cursor-pointer items-center gap-3 rounded-md border-[1.5px] border-[#E3F0FB] bg-sky-light p-3 transition-colors hover:border-sky">
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
                label={`${kidNames[0] ?? "Bambino"} — ${selectedKids.length} bambino${selectedKids.length === 1 ? "" : "i"}`}
                value={`×${selectedKids.length || 1}`}
              />
              {activity.shuttlePrice > 0 && (
                <Row label={`Navetta (${nWeeks} sett.)`} value={`€${shuttleCost}`} />
              )}
              {groupDiscount > 0 && (
                <Row label="Sconto gruppo" value={`-€${groupDiscount}`} valueClass="text-green" />
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
