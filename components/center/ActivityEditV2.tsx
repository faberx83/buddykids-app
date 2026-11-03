"use client";

// TRAMA — PORTALE CENTRI V2, ATTIVITÀ APERTA (30/10/2026, tavola 7 del mock).
// Fabrizio: "Profilo e attività sono ancora vecchio style". Al posto del
// modulo lungo: in alto le azioni (Date e posti, Come la vedono le famiglie,
// Duplica), poi un elenco di righe con la sintesi di ogni parte; toccando una
// riga si apre un foglio con solo quei campi e "Salva". Stessa azione di
// salvataggio di sempre (updateActivityAction, che riceve la scheda intera),
// stesse certificazioni. Il modulo di prima (ActivityEditForm) resta per chi
// non ha il guscio V2.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Activity, CertificationItem, MealOption, ServiceOption, Tag } from "@/lib/types";
import { updateActivityAction } from "@/app/actions/center";
import { deleteCertificationAction, getCertificationDocumentUrlAction, submitCertificationAction } from "@/app/actions/certifications";
import { uploadCertificationDocument } from "@/lib/storage";
import CoverAndGalleryUploader from "@/components/CoverAndGalleryUploader";
import PartnerPageHeader from "@/components/center/PartnerPageHeader";
import PartnerSheet from "@/components/center/PartnerSheet";
import DuplicateActivityButton from "@/components/center/DuplicateActivityButton";
import PlaceAutocomplete from "@/components/nextgen/PlaceAutocomplete";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import { buildFamilyPreviewHref } from "@/lib/center/family-preview";
import { fullAddressText } from "@/lib/places/search";
import type { ActivityDateSummary } from "@/lib/data/activity-dates";
import {
  ACTIVITY_SECTIONS,
  BOOKING_MODE_V2,
  MEAL_V2,
  datesSummary,
  sectionSummaries,
  type ActivityEditState,
  type ActivitySectionKey,
  type BookingMode,
} from "@/lib/centers/activity-edit-v2";

const INPUT =
  "w-full min-h-[46px] rounded-xl border border-partner-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-partner-primary disabled:bg-partner-page";
const LABEL = "mb-1.5 block text-[13px] font-semibold text-ink-2";
const HINT = "mt-1.5 text-[12.5px] leading-snug text-ink-2";
const CHIP = "min-h-[40px] rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors";
const CHIP_ON = "border-partner-primary bg-partner-soft text-partner-primary";
const CHIP_OFF = "border-partner-line bg-white text-ink-2 hover:bg-partner-page";
const CHECK_ROW = "flex items-start gap-3 rounded-xl border border-partner-line bg-partner-page p-3.5 text-[14.5px] text-ink";
const CHECK = "mt-0.5 h-[18px] w-[18px] flex-shrink-0 accent-[#0E5A63]";

const SCHEDULE_COLORS = ["#4DAFEF", "#3ECFB2", "#FF8C5A", "#8B7CF8", "#52C87A", "#9CA3AF"];

// Stesso elenco del modulo di prima: capacità dichiarata del servizio pranzo, non dati dei bambini.
const DIETARY_OPTIONS = ["Senza glutine (celiachia)", "Senza lattosio", "Vegetariano", "Vegano", "Senza frutta a guscio", "Halal", "Kosher"];

const CERT_STATUS: Record<CertificationItem["status"], { label: string; cls: string }> = {
  pending: { label: "In verifica", cls: "bg-[#FFF3DC] text-[#7A4F00]" },
  approved: { label: "Approvata", cls: "bg-[#E6F6F0] text-[#146B4F]" },
  rejected: { label: "Rifiutata", cls: "bg-[#FBEAEA] text-[#B4361F]" },
};

type FormState = ActivityEditState & { accessibleNote: string; lat: number; lng: number };

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {children}
      {hint && <p className={HINT}>{hint}</p>}
    </div>
  );
}

export default function ActivityEditV2({
  activity,
  tags,
  certifications,
  dates,
  placeSearch,
}: {
  activity: Activity;
  tags: Tag[];
  certifications: CertificationItem[];
  dates: ActivityDateSummary;
  placeSearch: boolean;
}) {
  const router = useRouter();
  const showToast = useNextgenToast();

  const initial: FormState = {
    name: activity.name,
    ageRange: activity.ageRange,
    description: activity.description,
    tagIds: activity.tagIds,
    bookingMode: (activity.bookingMode ?? "mixed") as BookingMode,
    minDaysPerBooking: activity.minDaysPerBooking ?? null,
    spotsLeft: activity.spotsLeft ?? 0,
    showExactSpots: activity.showExactSpots ?? false,
    pricePerWeek: activity.pricePerWeek,
    shuttlePrice: activity.shuttlePrice,
    preService: activity.preService ?? { available: false, time: "07:30", priceExtra: 0 },
    postService: activity.postService ?? { available: false, time: "18:00", priceExtra: 0 },
    mealOption: (activity.mealOption ?? "none") as MealOption,
    mealPriceExtra: activity.mealPriceExtra ?? 0,
    dietaryOptions: activity.dietaryOptions ?? [],
    schedule: activity.schedule,
    address: activity.address,
    lat: activity.lat ?? 45.4642,
    lng: activity.lng ?? 9.19,
    coverImageUrl: activity.coverImageUrl ?? null,
    galleryUrls: activity.galleryUrls ?? [],
    hasBar: activity.centerHasBar ?? false,
    accessible: activity.centerAccessible ?? false,
    accessibleNote: activity.centerAccessibleNote ?? "",
  };

  // Ultima versione salvata e bozza del foglio aperto: chiudendo senza salvare si torna alla salvata.
  const [saved, setSaved] = useState<FormState>(initial);
  const [form, setForm] = useState<FormState>(initial);
  const [open, setOpen] = useState<ActivitySectionKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const tagLabel = useMemo(() => {
    const byId = new Map(tags.map((t) => [t.id, t.label]));
    return (id: string) => byId.get(id);
  }, [tags]);
  const summaries = sectionSummaries(saved, tagLabel);
  const dateLine = datesSummary(dates);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function updateService(key: "preService" | "postService", patch: Partial<ServiceOption>) {
    setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));
  }
  function toggleIn(key: "tagIds" | "dietaryOptions", value: string) {
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }));
  }

  function openSection(key: ActivitySectionKey) {
    setForm(saved);
    setError(null);
    setOpen(key);
  }
  function closeSection() {
    setForm(saved);
    setError(null);
    setOpen(null);
  }

  async function save() {
    setError(null);
    if (!activity.dbId) {
      setSaved(form);
      setOpen(null);
      showToast("Salvato (demo), non viene registrato", "info");
      return;
    }
    setSaving(true);
    const result = await updateActivityAction({
      activityDbId: activity.dbId,
      name: form.name,
      ageRange: form.ageRange,
      pricePerWeek: form.pricePerWeek,
      shuttlePrice: form.shuttlePrice,
      description: form.description,
      spotsLeft: form.spotsLeft,
      showExactSpots: form.showExactSpots,
      hasBar: form.hasBar,
      accessible: form.accessible,
      accessibleNote: form.accessibleNote,
      dietaryOptions: form.dietaryOptions,
      tagIds: form.tagIds,
      address: form.address,
      lat: form.lat,
      lng: form.lng,
      mealOption: form.mealOption,
      mealPriceExtra: form.mealOption === "none" ? 0 : form.mealPriceExtra,
      preService: form.preService,
      postService: form.postService,
      schedule: form.schedule,
      coverImageUrl: form.coverImageUrl,
      galleryUrls: form.galleryUrls,
      bookingMode: form.bookingMode,
      minDaysPerBooking: form.minDaysPerBooking,
    }).catch(() => ({ error: "Non siamo riusciti a salvare, riprovate." }));
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(form);
    setOpen(null);
    showToast("Salvato");
    router.refresh();
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocateError("Il browser non supporta la posizione.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        update("lat", Number(pos.coords.latitude.toFixed(5)));
        update("lng", Number(pos.coords.longitude.toFixed(5)));
      },
      () => {
        setLocating(false);
        setLocateError("Posizione non disponibile: riabilitatela dalle impostazioni del sito.");
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${form.lng - 0.01}%2C${form.lat - 0.01}%2C${form.lng + 0.01}%2C${
    form.lat + 0.01
  }&layer=mapnik&marker=${form.lat}%2C${form.lng}`;

  // ─── Certificazioni (stesse azioni del modulo di prima) ───
  const [certList, setCertList] = useState(certifications);
  const [certLabel, setCertLabel] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certSaving, setCertSaving] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [certOpen, setCertOpen] = useState(false);

  async function submitCertification() {
    setCertError(null);
    if (!certLabel.trim() || !activity.dbId) return;
    setCertSaving(true);
    let documentPath: string | null = null;
    if (certFile) {
      const upload = await uploadCertificationDocument(activity.centerDbId || activity.centerId, certFile);
      if (upload.error) {
        setCertSaving(false);
        setCertError(upload.error);
        return;
      }
      documentPath = upload.path;
    }
    const result = await submitCertificationAction(activity.dbId, certLabel, documentPath);
    setCertSaving(false);
    if (result.error) {
      setCertError(result.error);
      return;
    }
    setCertList((prev) => [
      {
        id: `temp-${Date.now()}`,
        activityId: activity.dbId!,
        activityName: activity.name,
        centerName: "",
        label: certLabel.trim(),
        status: "pending",
        documentPath: documentPath ?? undefined,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setCertLabel("");
    setCertFile(null);
    setCertOpen(false);
    showToast("Richiesta inviata a TRAMA");
  }

  async function removeCertification(id: string) {
    if (!activity.dbId) return;
    setCertList((prev) => prev.filter((c) => c.id !== id));
    await deleteCertificationAction(activity.dbId, id);
  }

  async function viewCertificationDocument(path: string) {
    const result = await getCertificationDocumentUrlAction(path);
    if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    else setCertError(result.error || "Impossibile aprire il documento");
  }

  const sectionTitle = ACTIVITY_SECTIONS.find((s) => s.key === open)?.title ?? "";

  return (
    <div className="flex max-w-2xl flex-col gap-5" data-testid="activity-edit-v2">
      <PartnerPageHeader
        title={saved.name || "Attività"}
        subtitle={[saved.ageRange ? `${saved.ageRange} anni` : "", BOOKING_MODE_V2[saved.bookingMode].label.toLowerCase()].filter(Boolean).join(" · ")}
      />

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Link
          href={buildFamilyPreviewHref(activity.id, "attivita")}
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-partner-line bg-white px-3.5 text-[13.5px] font-semibold text-partner-primary hover:bg-partner-soft"
        >
          <i className="ti ti-eye text-[17px]" aria-hidden="true" /> Anteprima
        </Link>
        <DuplicateActivityButton activitySlug={activity.id} name={saved.name} />
      </div>

      {/* Date e posti: la riga più importante, in evidenza se mancano */}
      <Link
        href={`/center/activities/${activity.id}/calendar`}
        data-testid="activity-dates-row"
        className={`flex min-h-[64px] items-center gap-3 rounded-[18px] border px-4 py-3 transition-colors ${
          dateLine.missing ? "border-[#E8C77A] bg-[#FFF8E8] hover:bg-[#FFF3DC]" : "border-partner-line bg-white hover:bg-partner-page"
        }`}
      >
        <span
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
            dateLine.missing ? "bg-[#FFF3DC] text-[#7A4F00]" : "bg-partner-soft text-partner-primary"
          }`}
        >
          <i className="ti ti-calendar-event text-[20px]" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold text-ink">Date e posti</span>
          <span className={`text-[13px] ${dateLine.missing ? "font-semibold text-[#7A4F00]" : "text-ink-2"}`}>{dateLine.text}</span>
        </span>
        <i className="ti ti-chevron-right text-[18px] text-ink-2" aria-hidden="true" />
      </Link>

      <section aria-labelledby="att-sezioni" className="flex flex-col gap-2">
        <h2 id="att-sezioni" className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">
          La scheda per le famiglie
        </h2>
        <ul className="overflow-hidden rounded-[18px] border border-partner-line bg-white">
          {ACTIVITY_SECTIONS.map((s, i) => {
            const sum = summaries[s.key];
            return (
              <li key={s.key} className={i < ACTIVITY_SECTIONS.length - 1 ? "border-b border-[#EEF2F1]" : ""}>
                <button
                  type="button"
                  onClick={() => openSection(s.key)}
                  aria-haspopup="dialog"
                  data-testid={`activity-section-${s.key}`}
                  // Guida iniziale dei centri (lib/walkthrough/registry.ts): stessi bersagli del modulo di prima.
                  data-spotlight={s.key === "info" ? "configure_weeks" : s.key === "servizi" ? "configure_pricing" : undefined}
                  className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-partner-page"
                >
                  <i className={`ti ${s.icon} flex-shrink-0 text-[20px] text-partner-primary`} aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-semibold text-ink">{s.title}</span>
                    <span className={`truncate text-[12.5px] ${sum.todo ? "font-semibold text-[#7A4F00]" : "text-ink-2"}`}>{sum.text}</span>
                  </span>
                  {sum.todo && <span className="rounded-full bg-[#FFF3DC] px-2.5 py-1 text-[12px] font-bold text-[#7A4F00]">Da fare</span>}
                  <i className="ti ti-chevron-right flex-shrink-0 text-[18px] text-ink-2" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="att-cert" className="flex flex-col gap-3 rounded-[18px] border border-partner-line bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="att-cert" className="text-[15px] font-semibold text-ink">
            Certificazioni del servizio
          </h2>
          <button
            type="button"
            onClick={() => setCertOpen(true)}
            aria-haspopup="dialog"
            className="min-h-[40px] rounded-full px-2 text-[13.5px] font-semibold text-partner-primary"
          >
            Richiedi
          </button>
        </div>
        <p className="text-[12.5px] leading-snug text-ink-2">Le famiglie vedono il bollino solo dopo la verifica di TRAMA.</p>
        {certList.length === 0 ? (
          <p className="text-[13.5px] text-ink-2">Nessuna certificazione richiesta.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {certList.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2.5">
                <span className="min-w-0 flex-1 text-[14px] text-ink">
                  {c.label}
                  {c.status === "rejected" && c.adminNote && <span className="block text-[12.5px] text-[#B4361F]">Motivo: {c.adminNote}</span>}
                </span>
                {c.documentPath && (
                  <button type="button" onClick={() => viewCertificationDocument(c.documentPath!)} className="text-[13px] font-semibold text-partner-primary">
                    Documento
                  </button>
                )}
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${CERT_STATUS[c.status].cls}`}>{CERT_STATUS[c.status].label}</span>
                {c.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => removeCertification(c.id)}
                    aria-label={`Ritira la richiesta ${c.label}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-partner-page"
                  >
                    <i className="ti ti-trash text-[17px]" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {certError && !certOpen && <p className="text-[13px] text-[#B4361F]">{certError}</p>}
      </section>

      {/* ─── Foglio di una sezione ─── */}
      <PartnerSheet
        open={open !== null}
        onClose={closeSection}
        title={sectionTitle}
        footer={
          <div className="flex flex-col gap-2">
            {error && (
              <p role="alert" className="text-[13px] font-medium text-[#B4361F]">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                data-testid="activity-section-save"
                data-spotlight="publish"
                className="min-h-[48px] flex-1 rounded-full bg-partner-primary text-[15px] font-bold text-white hover:bg-partner-primary-press disabled:opacity-60"
              >
                {saving ? "Salvo…" : "Salva"}
              </button>
              <button type="button" onClick={closeSection} className="min-h-[48px] rounded-full px-4 text-[14px] font-semibold text-ink-2">
                Annulla
              </button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {open === "info" && (
            <>
              <Field label="Nome dell'attività" htmlFor="a-name">
                <input id="a-name" value={form.name} onChange={(e) => update("name", e.target.value)} className={INPUT} />
              </Field>
              <Field label="Età" htmlFor="a-age" hint="Per esempio 6-11.">
                <input id="a-age" value={form.ageRange} onChange={(e) => update("ageRange", e.target.value)} className={INPUT} />
              </Field>
              <Field label="Descrizione" htmlFor="a-desc" hint="Cosa fanno i bambini, con chi, cosa rende speciale questa attività.">
                <textarea id="a-desc" rows={5} value={form.description} onChange={(e) => update("description", e.target.value)} className={INPUT} />
              </Field>
              <div>
                <span className={LABEL}>Argomenti (aiutano le famiglie a trovarvi)</span>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Argomenti">
                  {tags.map((t) => {
                    const on = form.tagIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleIn("tagIds", t.id)}
                        className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {open === "iscrizione" && (
            <>
              <div role="radiogroup" aria-label="Come ci si iscrive" className="flex flex-col gap-2">
                {(Object.keys(BOOKING_MODE_V2) as BookingMode[]).map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 ${
                      form.bookingMode === m ? "border-partner-primary bg-partner-soft" : "border-partner-line bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="booking-mode"
                      checked={form.bookingMode === m}
                      onChange={() => update("bookingMode", m)}
                      className={CHECK}
                    />
                    <span className="flex flex-col">
                      <span className="text-[15px] font-semibold text-ink">{BOOKING_MODE_V2[m].label}</span>
                      <span className="text-[12.5px] text-ink-2">{BOOKING_MODE_V2[m].hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              {form.bookingMode !== "week_only" && (
                <Field label="Minimo di giorni per prenotazione (facoltativo)" htmlFor="a-min">
                  <input
                    id="a-min"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="Nessun minimo"
                    value={form.minDaysPerBooking ?? ""}
                    onChange={(e) => update("minDaysPerBooking", e.target.value === "" ? null : Number(e.target.value))}
                    className={INPUT}
                  />
                </Field>
              )}
              <label className={CHECK_ROW}>
                <input type="checkbox" checked={form.showExactSpots} onChange={(e) => update("showExactSpots", e.target.checked)} className={CHECK} />
                <span>
                  Mostrare alle famiglie quanti posti restano
                  <span className="block text-[12.5px] text-ink-2">Altrimenti vedono solo &quot;Posti disponibili&quot;. I posti di ogni giorno si cambiano in Date e posti.</span>
                </span>
              </label>
              {form.showExactSpots && (
                <Field label="Posti rimasti da mostrare" htmlFor="a-spots">
                  <input
                    id="a-spots"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={form.spotsLeft}
                    onChange={(e) => update("spotsLeft", Number(e.target.value))}
                    className={INPUT}
                  />
                </Field>
              )}
            </>
          )}

          {open === "prezzi" && (
            <>
              <Field label="Prezzo a settimana (€)" htmlFor="a-price" hint="I prezzi dei singoli giorni si cambiano in Date e posti.">
                <input
                  id="a-price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={form.pricePerWeek}
                  onChange={(e) => update("pricePerWeek", Number(e.target.value))}
                  className={INPUT}
                />
              </Field>
              <Field label="Navetta, a settimana (€)" htmlFor="a-shuttle" hint="0 = navetta non disponibile.">
                <input
                  id="a-shuttle"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={form.shuttlePrice}
                  onChange={(e) => update("shuttlePrice", Number(e.target.value))}
                  className={INPUT}
                />
              </Field>
              <p className="text-[13px] text-ink-2">
                Sconti per più settimane e fratelli valgono per tutto il centro:{" "}
                <Link href="/center/profile?sezione=sconti" className="font-semibold text-partner-primary">
                  Sconti
                </Link>
                . Per le promo:{" "}
                <Link href="/center/promotions" className="font-semibold text-partner-primary">
                  Promozioni
                </Link>
                .
              </p>
            </>
          )}

          {open === "servizi" && (
            <>
              {(
                [
                  ["preService", "Ingresso anticipato", "Dalle"],
                  ["postService", "Uscita posticipata", "Fino alle"],
                ] as const
              ).map(([key, title, timeLabel]) => (
                <div key={key} className="flex flex-col gap-3 rounded-xl border border-partner-line bg-partner-page p-3.5">
                  <label className="flex items-center gap-3 text-[15px] font-semibold text-ink">
                    <input
                      type="checkbox"
                      checked={form[key].available}
                      onChange={(e) => updateService(key, { available: e.target.checked })}
                      className={CHECK}
                    />
                    {title}
                  </label>
                  {form[key].available && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={timeLabel} htmlFor={`${key}-t`}>
                        <input
                          id={`${key}-t`}
                          type="time"
                          value={form[key].time}
                          onChange={(e) => updateService(key, { time: e.target.value })}
                          className={INPUT}
                        />
                      </Field>
                      <Field label="Costo a settimana (€)" htmlFor={`${key}-p`}>
                        <input
                          id={`${key}-p`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={form[key].priceExtra}
                          onChange={(e) => updateService(key, { priceExtra: Number(e.target.value) })}
                          className={INPUT}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              ))}
              <div>
                <span className={LABEL}>Pranzo</span>
                <div role="radiogroup" aria-label="Pranzo" className="flex flex-wrap gap-2">
                  {(Object.keys(MEAL_V2) as MealOption[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={form.mealOption === m}
                      onClick={() => update("mealOption", m)}
                      className={`${CHIP} ${form.mealOption === m ? CHIP_ON : CHIP_OFF}`}
                    >
                      {MEAL_V2[m]}
                    </button>
                  ))}
                </div>
              </div>
              {form.mealOption !== "none" && (
                <Field label="Costo del pranzo a settimana (€)" htmlFor="a-meal" hint="Sopra 0 la famiglia lo sceglie quando prenota; a 0 è solo un'informazione.">
                  <input
                    id="a-meal"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={form.mealPriceExtra}
                    onChange={(e) => update("mealPriceExtra", Number(e.target.value))}
                    className={INPUT}
                  />
                </Field>
              )}
              {form.mealOption !== "none" && (
                <div>
                  <span className={LABEL}>Diete che il pranzo sa gestire</span>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Diete gestite">
                    {DIETARY_OPTIONS.map((o) => {
                      const on = form.dietaryOptions.includes(o);
                      return (
                        <button key={o} type="button" aria-pressed={on} onClick={() => toggleIn("dietaryOptions", o)} className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}>
                          {o}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {open === "giornata" && (
            <>
              <p className="text-[13.5px] text-ink-2">Gli orari della giornata come li leggono le famiglie.</p>
              <ul className="flex flex-col gap-2">
                {form.schedule.map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`sch-t-${i}`}>
                      Orario
                    </label>
                    <input
                      id={`sch-t-${i}`}
                      value={s.time}
                      onChange={(e) => update("schedule", form.schedule.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))}
                      placeholder="08:30"
                      className={`${INPUT} w-24 flex-shrink-0`}
                    />
                    <label className="sr-only" htmlFor={`sch-l-${i}`}>
                      Cosa si fa
                    </label>
                    <input
                      id={`sch-l-${i}`}
                      value={s.label}
                      onChange={(e) => update("schedule", form.schedule.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                      placeholder="Accoglienza"
                      className={`${INPUT} min-w-0 flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => update("schedule", form.schedule.filter((_, j) => j !== i))}
                      aria-label={`Togli ${s.label || "questa riga"}`}
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-partner-page"
                    >
                      <i className="ti ti-trash text-[18px]" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  update("schedule", [
                    ...form.schedule,
                    { time: "", label: "", color: SCHEDULE_COLORS[form.schedule.length % SCHEDULE_COLORS.length] },
                  ])
                }
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-dashed border-partner-line text-[14px] font-semibold text-partner-primary hover:bg-partner-page"
              >
                <i className="ti ti-plus text-[17px]" aria-hidden="true" /> Aggiungi un momento
              </button>
            </>
          )}

          {open === "luogo" && (
            <>
              <Field
                label="Indirizzo"
                htmlFor="activity-address"
                hint="Scrivete il nome del posto o via e numero e sceglietelo dai suggerimenti: il numero resta e la mappa si aggiorna."
              >
                <PlaceAutocomplete
                  id="activity-address"
                  value={form.address}
                  onChange={(text) => update("address", text)}
                  onPick={(place) => {
                    update("lat", Number(place.lat.toFixed(5)));
                    update("lng", Number(place.lng.toFixed(5)));
                  }}
                  pickText={(place) => fullAddressText(place, form.address)}
                  enabled={placeSearch}
                  placeholder="Es. Via Padova 21, Milano"
                  className={INPUT}
                />
              </Field>
              <div className="overflow-hidden rounded-xl border border-partner-line">
                <iframe key={mapSrc} title="Anteprima mappa" src={mapSrc} className="h-48 w-full" loading="lazy" />
              </div>
              <details className="text-[13px] text-ink-2">
                <summary className="cursor-pointer select-none py-1 font-semibold text-partner-primary">Il punto sulla mappa non è giusto?</summary>
                <div className="mt-2 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={locating}
                    className="flex min-h-[40px] items-center gap-1.5 self-start rounded-full border border-partner-line bg-white px-3.5 text-[13.5px] font-semibold text-partner-primary"
                  >
                    <i className={`ti ${locating ? "ti-loader-2 animate-spin" : "ti-map-pin"} text-[16px]`} aria-hidden="true" />
                    {locating ? "Localizzo…" : "Usa la posizione di questo dispositivo"}
                  </button>
                  {locateError && <p className="text-[12.5px] text-[#B4361F]">{locateError}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Latitudine" htmlFor="a-lat">
                      <input id="a-lat" type="number" step="0.0001" value={form.lat} onChange={(e) => update("lat", Number(e.target.value))} className={INPUT} />
                    </Field>
                    <Field label="Longitudine" htmlFor="a-lng">
                      <input id="a-lng" type="number" step="0.0001" value={form.lng} onChange={(e) => update("lng", Number(e.target.value))} className={INPUT} />
                    </Field>
                  </div>
                </div>
              </details>
            </>
          )}

          {open === "foto" && (
            <>
              <p className="text-[13.5px] text-ink-2">La copertina è la prima cosa che vedono le famiglie; la galleria scorre nella scheda.</p>
              <CoverAndGalleryUploader
                folder="activities"
                coverUrl={form.coverImageUrl}
                galleryUrls={form.galleryUrls}
                onCoverChange={(url) => update("coverImageUrl", url)}
                onGalleryChange={(urls) => update("galleryUrls", urls)}
              />
            </>
          )}

          {open === "centro" && (
            <>
              <p className="text-[13.5px] text-ink-2">Valgono per tutto il centro: le famiglie le vedono su ogni vostra attività.</p>
              <label className={CHECK_ROW}>
                <input type="checkbox" checked={form.accessible} onChange={(e) => update("accessible", e.target.checked)} className={CHECK} />
                <span>Il centro è accessibile alle persone con disabilità</span>
              </label>
              {form.accessible && (
                <Field label="Nota sull'accessibilità (facoltativa)" htmlFor="a-acc">
                  <input
                    id="a-acc"
                    value={form.accessibleNote}
                    onChange={(e) => update("accessibleNote", e.target.value)}
                    placeholder="Es. rampa d'accesso, bagno attrezzato"
                    className={INPUT}
                  />
                </Field>
              )}
              <label className={CHECK_ROW}>
                <input type="checkbox" checked={form.hasBar} onChange={(e) => update("hasBar", e.target.checked)} className={CHECK} />
                <span>C&apos;è un bar o un punto ristoro</span>
              </label>
            </>
          )}
        </div>
      </PartnerSheet>

      {/* ─── Richiesta di una certificazione ─── */}
      <PartnerSheet
        open={certOpen}
        onClose={() => setCertOpen(false)}
        title="Richiedi una certificazione"
        subtitle="TRAMA la verifica prima di mostrarla alle famiglie."
        footer={
          <div className="flex flex-col gap-2">
            {certError && (
              <p role="alert" className="text-[13px] font-medium text-[#B4361F]">
                {certError}
              </p>
            )}
            <button
              type="button"
              onClick={submitCertification}
              disabled={certSaving || !certLabel.trim() || !activity.dbId}
              className="min-h-[48px] rounded-full bg-partner-primary text-[15px] font-bold text-white hover:bg-partner-primary-press disabled:opacity-60"
            >
              {certSaving ? "Invio…" : "Invia a TRAMA"}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Cosa certifica" htmlFor="cert-label" hint="Per esempio: istruttori con brevetto FISE di equitazione.">
            <input id="cert-label" value={certLabel} onChange={(e) => setCertLabel(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Documento (facoltativo)" htmlFor="cert-file" hint="PDF o foto, fino a 10 MB. Lo vedete solo voi e TRAMA.">
            <input
              id="cert-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
              className="block w-full text-[13.5px] text-ink-2"
            />
          </Field>
        </div>
      </PartnerSheet>
    </div>
  );
}
