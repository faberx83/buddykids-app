"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, CertificationItem, MealOption, ServiceOption, Tag } from "@/lib/types";
import { categories as mockCategories } from "@/lib/mock-data";
import { DemoBadge } from "@/components/StatusBadge";
import { updateActivityAction } from "@/app/actions/center";
import {
  deleteCertificationAction,
  getCertificationDocumentUrlAction,
  submitCertificationAction,
} from "@/app/actions/certifications";
import { uploadCertificationDocument } from "@/lib/storage";
import CoverAndGalleryUploader from "@/components/CoverAndGalleryUploader";
import PartnerPageHeader from "@/components/center/PartnerPageHeader";
import PlaceAutocomplete from "@/components/nextgen/PlaceAutocomplete";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import { buildFamilyPreviewHref } from "@/lib/center/family-preview";
import { fullAddressText } from "@/lib/places/search";

// PORTALE CENTRI V2 (29/10/2026). Fabrizio: "anche la sezione attività è
// vecchio stile". Col guscio nuovo (prop v2, letta in page.tsx) stessa scheda,
// stessi campi e stessa azione di salvataggio, ma: titolo come le altre
// sezioni, riquadri e campi del portale centri, "giorni singoli" al posto di
// "Giorni spot", indirizzo con i suggerimenti (come lato famiglie, coordinate
// prese dal luogo scelto) e, dopo il salvataggio, ritorno all'elenco con una
// conferma. Senza guscio tutto come prima: le classi di sempre sono in LEGACY_UI.
const LEGACY_UI = {
  input: "w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky",
  card: "rounded-lg border border-[#E8EBF0] bg-white p-5",
  cardTitle: "text-sm font-bold text-ink",
  chip: "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
  chipOn: "border-sky bg-sky-light text-sky",
  chipOff: "border-[#E8EBF0] bg-bg text-ink-2",
  checkRow: "flex items-start gap-2.5 rounded-md bg-bg p-3 text-sm text-ink",
  label: "mb-1.5 block text-xs font-semibold text-ink-2",
  intro: "text-xs text-ink-2",
  smallInput: "rounded-md border border-[#E8EBF0] bg-bg px-2 py-1.5 text-xs outline-none focus:border-sky",
  serviceBox: "rounded-md bg-bg p-3",
  serviceInput: "w-full rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs outline-none focus:border-sky",
  softButton: "rounded-md bg-sky-light px-2.5 py-1.5 text-xs font-semibold text-sky",
  primaryButton: "rounded-md bg-sky px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60",
  link: "text-xs font-semibold text-sky",
};

const V2_UI: typeof LEGACY_UI = {
  input:
    "w-full min-h-[46px] rounded-xl border border-partner-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-partner-primary disabled:bg-partner-page",
  card: "rounded-[18px] border border-partner-line bg-white p-5",
  cardTitle: "font-poppins text-[17px] font-semibold text-ink",
  chip: "min-h-[38px] rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors",
  chipOn: "border-partner-primary bg-partner-soft text-partner-primary",
  chipOff: "border-partner-line bg-white text-ink-2 hover:bg-partner-page",
  checkRow:
    "flex items-start gap-3 rounded-xl border border-partner-line bg-partner-page p-3.5 text-[14.5px] text-ink [&_input]:h-[18px] [&_input]:w-[18px] [&_input]:accent-[#0E5A63]",
  label: "mb-1.5 block text-[13px] font-semibold text-ink-2",
  intro: "text-[13.5px] leading-snug text-ink-2",
  smallInput:
    "min-h-[42px] rounded-xl border border-partner-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-partner-primary",
  serviceBox: "rounded-xl border border-partner-line bg-partner-page p-3.5 [&_input[type=checkbox]]:accent-[#0E5A63]",
  serviceInput:
    "w-full min-h-[42px] rounded-xl border border-partner-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-partner-primary",
  softButton:
    "flex min-h-[38px] items-center gap-1 rounded-full border border-partner-line bg-white px-3.5 text-[13.5px] font-semibold text-partner-primary hover:bg-partner-soft",
  primaryButton:
    "min-h-[44px] rounded-full bg-partner-primary px-4 text-[14px] font-bold text-white hover:bg-partner-primary-press disabled:opacity-60",
  link: "text-[13.5px] font-semibold text-partner-primary",
};

const UiContext = createContext(LEGACY_UI);

const CERTIFICATION_STATUS_LABEL: Record<CertificationItem["status"], { label: string; cls: string }> = {
  pending: { label: "In verifica", cls: "bg-orange-light text-trama-orange" },
  approved: { label: "Approvata", cls: "bg-green-light text-[#2d8f52]" },
  rejected: { label: "Rifiutata", cls: "bg-[#FBEAEA] text-[#C0392B]" },
};

const scheduleColors = ["#4DAFEF", "#3ECFB2", "#FF8C5A", "#8B7CF8", "#52C87A", "#9CA3AF"];

const mealLabels: Record<MealOption, string> = {
  included: "🍽️ Pasto incluso",
  packed: "🎒 Pranzo al sacco",
  none: "— Non fornito",
};

// TRAMA ONE Build Sprint 2 (DEC-32): le 3 modalità ammesse — "mixed" resta il
// default e corrisponde al comportamento di ogni attività prima di questo
// sprint (prenotabile sia a settimana che a Giorni spot).
const bookingModeLabels: Record<"week_only" | "day_only" | "mixed", { label: string; hint: string }> = {
  mixed: {
    label: "Settimana e Giorni spot",
    hint: "Il genitore può prenotare sia intere settimane che singoli Giorni spot (comportamento attuale).",
  },
  week_only: {
    label: "Solo a settimana",
    hint: "Il genitore può prenotare solo settimane intere, non singoli giorni.",
  },
  day_only: {
    label: "Solo Giorni spot",
    hint: "Il genitore può prenotare solo singoli giorni dal calendario, non settimane intere.",
  },
};

// Stesse tre modalità, parole del portale V2: niente "Giorni spot".
const bookingModeLabelsV2: typeof bookingModeLabels = {
  mixed: {
    label: "Settimane e giorni singoli",
    hint: "Le famiglie possono prenotare settimane intere oppure solo alcuni giorni.",
  },
  week_only: {
    label: "Solo settimane",
    hint: "Le famiglie prenotano solo settimane intere.",
  },
  day_only: {
    label: "Solo giorni singoli",
    hint: "Le famiglie scelgono i giorni dal calendario, senza settimane intere.",
  },
};

// Diete/intolleranze che il servizio pranzo dichiara di saper gestire — è una
// capacità del servizio (dichiarata dal gestore), non un dato sanitario di un
// bambino specifico: quello resta fuori scope (vedi piano Privacy/Compliance).
const DIETARY_OPTIONS = [
  "Senza glutine (celiachia)",
  "Senza lattosio",
  "Vegetariano",
  "Vegano",
  "Senza frutta a guscio",
  "Halal",
  "Kosher",
];

export default function ActivityEditForm({
  activity,
  tags = mockCategories,
  certifications = [],
  v2 = false,
  placeSearch = false,
}: {
  activity: Activity;
  tags?: Tag[];
  certifications?: CertificationItem[];
  /** Portale centri V2 (guscio acceso). */
  v2?: boolean;
  /** Suggerimenti di indirizzo (solo V2). */
  placeSearch?: boolean;
}) {
  const ui = v2 ? V2_UI : LEGACY_UI;
  const modeLabels = v2 ? bookingModeLabelsV2 : bookingModeLabels;
  const router = useRouter();
  const showToast = useNextgenToast();
  const [certList, setCertList] = useState(certifications);
  const [certLabel, setCertLabel] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certSaving, setCertSaving] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);

  async function submitCertification() {
    setCertError(null);
    if (!certLabel.trim()) return;
    if (!activity.dbId) {
      setCertError("Disponibile solo con Supabase collegato.");
      return;
    }
    setCertSaving(true);

    let documentPath: string | null = null;
    if (certFile) {
      // BUG CORRETTO: activity.centerId è lo SLUG del centro (routing), non
      // l'uuid reale richiesto dalla policy RLS dello storage bucket (che
      // confronta il path con l'uuid vero, public.current_center_id()) — usava
      // lo slug e falliva sempre con "new row violates row-level security
      // policy". centerDbId è l'uuid reale (vedi lib/types.ts).
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

  const [form, setForm] = useState({
    name: activity.name,
    ageRange: activity.ageRange,
    pricePerWeek: activity.pricePerWeek,
    shuttlePrice: activity.shuttlePrice,
    description: activity.description,
    spotsLeft: activity.spotsLeft ?? 0,
    showExactSpots: activity.showExactSpots ?? false,
    hasBar: activity.centerHasBar ?? false,
    accessible: activity.centerAccessible ?? false,
    accessibleNote: activity.centerAccessibleNote ?? "",
    dietaryOptions: activity.dietaryOptions ?? [],
    tagIds: activity.tagIds,
    address: activity.address,
    lat: activity.lat ?? 45.4642,
    lng: activity.lng ?? 9.19,
    mealOption: (activity.mealOption ?? "none") as MealOption,
    // Migration 37 (servizi extra in prenotazione, segnalazione Fabrizio
    // 04/09/2026) — un prezzo > 0 rende la mensa selezionabile dal genitore
    // nel wizard di prenotazione (come pre/post-scuola), invece della sola
    // informazione statica "inclusa"/"pranzo al sacco" di prima.
    mealPriceExtra: activity.mealPriceExtra ?? 0,
    preService: activity.preService ?? { available: false, time: "07:30", priceExtra: 0 },
    postService: activity.postService ?? { available: false, time: "18:00", priceExtra: 0 },
    schedule: activity.schedule,
    coverImageUrl: activity.coverImageUrl ?? null,
    galleryUrls: activity.galleryUrls ?? [],
    bookingMode: (activity.bookingMode ?? "mixed") as "week_only" | "day_only" | "mixed",
    minDaysPerBooking: activity.minDaysPerBooking ?? null,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // Stessa logica del "Usa posizione" della Home genitore (components/HomeFeed.tsx):
  // navigator.geolocation.getCurrentPosition, nessuna dipendenza esterna.
  // Qui riempie direttamente lat/lng dell'attività (l'anteprima mappa sotto
  // si aggiorna di conseguenza); l'indirizzo testuale resta modificabile a mano.
  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocateError("Il browser non supporta la geolocalizzazione.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        update("lat", Number(pos.coords.latitude.toFixed(4)));
        update("lng", Number(pos.coords.longitude.toFixed(4)));
      },
      () => {
        setLocating(false);
        setLocateError(
          "Posizione non disponibile: il browser non permette di richiederla di nuovo dopo un rifiuto. Vai nelle impostazioni del sito per riabilitarla."
        );
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function toggleTag(tagId: string) {
    update(
      "tagIds",
      form.tagIds.includes(tagId)
        ? form.tagIds.filter((t) => t !== tagId)
        : [...form.tagIds, tagId]
    );
  }

  function toggleDietaryOption(option: string) {
    update(
      "dietaryOptions",
      form.dietaryOptions.includes(option)
        ? form.dietaryOptions.filter((o) => o !== option)
        : [...form.dietaryOptions, option]
    );
  }

  function updateService(key: "preService" | "postService", patch: Partial<ServiceOption>) {
    update(key, { ...form[key], ...patch });
  }

  function updateScheduleRow(i: number, patch: Partial<(typeof form.schedule)[number]>) {
    update(
      "schedule",
      form.schedule.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  }

  function addScheduleRow() {
    update("schedule", [
      ...form.schedule,
      { time: "12:00", label: "Nuova attività", color: scheduleColors[form.schedule.length % scheduleColors.length] },
    ]);
  }

  function removeScheduleRow(i: number) {
    update(
      "schedule",
      form.schedule.filter((_, idx) => idx !== i)
    );
  }

  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${form.lng - 0.01}%2C${
    form.lat - 0.01
  }%2C${form.lng + 0.01}%2C${form.lat + 0.01}&layer=mapnik&marker=${form.lat}%2C${form.lng}`;

  return (
    <UiContext.Provider value={ui}>
    <div className={v2 ? "flex max-w-2xl flex-col gap-5 pb-24" : "max-w-2xl"}>
      {v2 ? (
        <>
          {/* "‹" in alto lo mette il guscio (torna alla pagina di prima). */}
          <PartnerPageHeader
            title={activity.name || "Attività"}
            subtitle="Quello che scrivete qui è quello che le famiglie leggono nella scheda."
            badge={!activity.dbId ? <DemoBadge /> : undefined}
          />
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/center/activities/${activity.id}/calendar`}
              className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-partner-primary px-4 text-[14px] font-bold text-white hover:bg-partner-primary-press"
            >
              <i className="ti ti-calendar-event text-[17px]" aria-hidden="true" /> Date e posti
            </Link>
            <Link
              href={buildFamilyPreviewHref(activity.id, "attivita")}
              className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-partner-line bg-white px-4 text-[14px] font-semibold text-partner-primary hover:bg-partner-soft"
            >
              <i className="ti ti-eye text-[17px]" aria-hidden="true" /> Come la vedono le famiglie
            </Link>
          </div>
        </>
      ) : (
      <>
      <Link
        href="/center/activities"
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-sky"
      >
        <i className="ti ti-arrow-left" /> Le tue attività
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <span className="text-2xl">{activity.emoji}</span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-ink">{activity.name}</h1>
            {!activity.dbId && <DemoBadge />}
          </div>
          <p className="text-sm text-ink-2">Modifica le informazioni pubblicate nell&apos;app</p>
        </div>
        <Link
          href={`/center/activities/${activity.id}/calendar`}
          className="ml-auto rounded-md bg-sky-light px-3.5 py-2 text-xs font-semibold text-sky"
        >
          Calendario disponibilità →
        </Link>
      </div>
      </>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaveError(null);
          if (!activity.dbId) {
            setSaved(true);
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
          });
          setSaving(false);
          if (result.error) {
            setSaveError(result.error);
            return;
          }
          setSaved(true);
          if (v2) {
            // Come il profilo: salvato, si torna all'elenco con una conferma.
            showToast("Attività salvata");
            router.push("/center/activities");
            router.refresh();
          }
        }}
        className={v2 ? "space-y-5" : "space-y-6"}
      >
        <div
          className={`space-y-4 ${ui.card}`}
          data-spotlight="configure_weeks"
        >
          <h2 className={ui.cardTitle}>Informazioni generali</h2>

          <Field label="Nome attività">
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className={ui.input}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fascia d'età">
              <input
                value={form.ageRange}
                onChange={(e) => update("ageRange", e.target.value)}
                className={ui.input}
              />
            </Field>
            <Field label="Posti rimasti (in evidenza)">
              <input
                type="number"
                min={0}
                disabled={!form.showExactSpots}
                value={form.spotsLeft}
                onChange={(e) => update("spotsLeft", Number(e.target.value))}
                className={`${ui.input} disabled:opacity-50`}
              />
            </Field>
          </div>

          <label className={ui.checkRow}>
            <input
              type="checkbox"
              checked={form.showExactSpots}
              onChange={(e) => update("showExactSpots", e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Mostra ai genitori il numero esatto di posti rimasti
              <br />
              <span className="text-xs text-ink-2">
                Se disattivato, la scheda attività mostra solo &quot;Posti disponibili&quot; senza numero.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Prezzo a settimana (€)">
              <input
                type="number"
                min={0}
                value={form.pricePerWeek}
                onChange={(e) => update("pricePerWeek", Number(e.target.value))}
                className={ui.input}
              />
            </Field>
            <Field label="Navetta (€/sett., 0 = non disponibile)">
              <input
                type="number"
                min={0}
                value={form.shuttlePrice}
                onChange={(e) => update("shuttlePrice", Number(e.target.value))}
                className={ui.input}
              />
            </Field>
          </div>

          <Field label="Descrizione">
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={4}
              className={ui.input}
            />
          </Field>
        </div>

        <div className={`space-y-4 ${ui.card}`}>
          <h2 className={ui.cardTitle}>Modalità di prenotazione</h2>
          {v2 ? (
            <p className={ui.intro}>Come le famiglie possono prenotare. Le date e i posti si scelgono in &quot;Date e posti&quot;.</p>
          ) : (
          <p className={ui.intro}>
            Scegli come i genitori possono prenotare questa attività. Il calendario
            disponibilità (Giorni spot) resta configurabile da qui sotto — questa scelta
            determina solo quali modalità sono ammesse in ricerca/prenotazione.
          </p>
          )}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(modeLabels) as [keyof typeof bookingModeLabels, { label: string; hint: string }][]).map(
              ([value, { label }]) => {
                const active = form.bookingMode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update("bookingMode", value)}
                    className={`${ui.chip} ${active ? ui.chipOn : ui.chipOff}`}
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>
          <p className={v2 ? "text-[13px] text-ink-2" : "text-[11px] text-ink-3"}>{modeLabels[form.bookingMode].hint}</p>

          {form.bookingMode !== "week_only" && (
            <Field label={v2 ? "Minimo di giorni per prenotazione (facoltativo)" : "Minimo giorni per prenotazione a Giorni spot (facoltativo)"}>
              <input
                type="number"
                min={0}
                placeholder="Nessun minimo"
                value={form.minDaysPerBooking ?? ""}
                onChange={(e) =>
                  update("minDaysPerBooking", e.target.value === "" ? null : Number(e.target.value))
                }
                className={ui.input}
              />
            </Field>
          )}
        </div>

        <div className={`space-y-4 ${ui.card}`}>
          <h2 className={ui.cardTitle}>Immagini</h2>
          <p className={ui.intro}>
            Copertina e galleria mostrate ai genitori nella scheda attività — se non carichi una
            copertina resta il gradiente colorato di default.
          </p>
          <CoverAndGalleryUploader
            folder="activities"
            coverUrl={form.coverImageUrl}
            galleryUrls={form.galleryUrls}
            onCoverChange={(url) => update("coverImageUrl", url)}
            onGalleryChange={(urls) => update("galleryUrls", urls)}
          />
        </div>

        <div className={`space-y-3 ${ui.card}`}>
          <h2 className={ui.cardTitle}>Tag</h2>
          <p className={ui.intro}>
            Seleziona uno o più tag: aiutano i genitori a trovare la tua attività nella ricerca.
            La lista dei tag disponibili è gestita dall&apos;Admin piattaforma.
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map((c) => {
              const active = form.tagIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleTag(c.id)}
                  className={`flex items-center gap-1.5 ${ui.chip} ${active ? ui.chipOn : ui.chipOff}`}
                >
                  <span>{c.emoji}</span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`space-y-3 ${ui.card}`}>
          <h2 className={ui.cardTitle}>Certificazioni servizio</h2>
          <p className={ui.intro}>
            Certificazioni specifiche del servizio esposto (es. &quot;Istruttori certificati FISE
            per equitazione&quot;, &quot;Allenatrici FIG&quot;) — non un elenco fisso, scrivi
            l&apos;etichetta che descrive la certificazione. Ogni richiesta viene verificata da un
            Admin piattaforma prima di diventare un badge visibile ai genitori.
          </p>

          <div className="space-y-2">
            {certList.map((cert) => (
              <div
                key={cert.id}
                className={`flex flex-wrap items-center gap-2.5 ${ui.serviceBox}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink">{cert.label}</div>
                  {cert.status === "rejected" && cert.adminNote && (
                    <div className="mt-0.5 text-[11px] text-orange">Motivo: {cert.adminNote}</div>
                  )}
                </div>
                {cert.documentPath && (
                  <button
                    type="button"
                    onClick={() => viewCertificationDocument(cert.documentPath!)}
                    className={ui.link}
                  >
                    <i className="ti ti-file-text" /> Documento
                  </button>
                )}
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${CERTIFICATION_STATUS_LABEL[cert.status].cls}`}
                >
                  {CERTIFICATION_STATUS_LABEL[cert.status].label}
                </span>
                {cert.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => removeCertification(cert.id)}
                    className="text-ink-3 hover:text-orange"
                    title="Ritira la richiesta"
                  >
                    <i className="ti ti-trash text-base" />
                  </button>
                )}
              </div>
            ))}
            {certList.length === 0 && (
              <p className={ui.intro}>Nessuna certificazione richiesta finora.</p>
            )}
          </div>

          <div className={`grid gap-2 border border-dashed p-3 sm:grid-cols-[1fr_auto_auto] ${v2 ? "rounded-xl border-partner-line" : "rounded-md border-[#E8EBF0]"}`}>
            <input
              value={certLabel}
              onChange={(e) => setCertLabel(e.target.value)}
              placeholder="Es. Istruttori certificati FISE per equitazione"
              className={ui.input}
            />
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
              className="w-full max-w-[220px] text-xs text-ink-2"
            />
            <button
              type="button"
              onClick={() => submitCertification()}
              disabled={certSaving || !certLabel.trim()}
              className={ui.primaryButton}
            >
              {certSaving ? "Invio…" : "Invia richiesta"}
            </button>
          </div>
          {certError && <p className="text-xs font-medium text-orange">{certError}</p>}
          <p className="text-[11px] text-ink-3">
            Documento facoltativo (PDF, JPG, PNG o WEBP, max 10MB) — caricato su uno storage
            privato, visibile solo a te e all&apos;Admin durante la verifica.
          </p>
        </div>

        <div
          className={`space-y-4 ${ui.card}`}
          data-spotlight="configure_pricing"
        >
          <h2 className={ui.cardTitle}>Servizi extra e pasto</h2>

          <div className="grid grid-cols-2 gap-4">
            <ServiceField
              title="Ingresso anticipato (pre-servizio)"
              value={form.preService}
              onChange={(patch) => updateService("preService", patch)}
              timeLabel="Disponibile da"
            />
            <ServiceField
              title="Uscita posticipata (post-servizio)"
              value={form.postService}
              onChange={(patch) => updateService("postService", patch)}
              timeLabel="Disponibile fino a"
            />
          </div>

          <Field label="Pasto">
            <select
              value={form.mealOption}
              onChange={(e) => update("mealOption", e.target.value as MealOption)}
              className={ui.input}
            >
              {(Object.entries(mealLabels) as [MealOption, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          {form.mealOption !== "none" && (
            <Field label="Sovrapprezzo mensa (€/sett., 0 = nessuna scelta da fare per il genitore)">
              <input
                type="number"
                min={0}
                value={form.mealPriceExtra}
                onChange={(e) => update("mealPriceExtra", Number(e.target.value))}
                className={ui.input}
              />
              <p className="mt-1 text-[11px] text-ink-3">
                Sopra 0€: il genitore la sceglie esplicitamente in prenotazione (come pre/post-scuola).
                A 0€: resta solo un&apos;informazione, come oggi.
              </p>
            </Field>
          )}

          <label className={ui.checkRow}>
            <input
              type="checkbox"
              checked={form.hasBar}
              onChange={(e) => update("hasBar", e.target.checked)}
              className="mt-0.5"
            />
            <span>
              🥤 Il centro ha un bar / punto ristoro
              <br />
              <span className="text-xs text-ink-2">
                Riguarda l&apos;intero centro, non solo questa attività: se il centro ha più
                attività pubblicate, l&apos;informazione vale per tutte.
              </span>
            </span>
          </label>

          <label className={ui.checkRow}>
            <input
              type="checkbox"
              checked={form.accessible}
              onChange={(e) => update("accessible", e.target.checked)}
              className="mt-0.5"
            />
            <span>
              ♿ Il centro è accessibile alle persone con disabilità
              <br />
              <span className="text-xs text-ink-2">
                Riguarda l&apos;intero centro, non solo questa attività: se il centro ha più
                attività pubblicate, l&apos;informazione vale per tutte.
              </span>
            </span>
          </label>
          {form.accessible && (
            <Field label="Nota accessibilità (facoltativa)">
              <input
                value={form.accessibleNote}
                onChange={(e) => update("accessibleNote", e.target.value)}
                placeholder="Es. Rampa d'accesso, bagno attrezzato"
                className={ui.input}
              />
            </Field>
          )}

          <div>
            <div className="mb-2 text-xs font-semibold text-ink-2">
              Diete speciali / intolleranze gestite dal servizio pranzo
            </div>
            <p className="mb-2 text-[11px] text-ink-3">
              Capacità dichiarata dal servizio (non un dato del singolo bambino): i genitori la
              vedranno come badge nella scheda attività.
            </p>
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map((option) => {
                const active = form.dietaryOptions.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleDietaryOption(option)}
                    className={`${ui.chip} ${active ? ui.chipOn : ui.chipOff}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className={`space-y-3 ${ui.card}`}>
          <div className="flex items-center justify-between">
            <h2 className={ui.cardTitle}>Agenda della giornata</h2>
            <button
              type="button"
              onClick={addScheduleRow}
              className={ui.softButton}
            >
              + Aggiungi
            </button>
          </div>
          <div className="space-y-2">
            {form.schedule.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: s.color }} />
                <input
                  value={s.time}
                  onChange={(e) => updateScheduleRow(i, { time: e.target.value })}
                  placeholder="08:00"
                  className={`w-20 flex-shrink-0 ${ui.smallInput}`}
                />
                <input
                  value={s.label}
                  onChange={(e) => updateScheduleRow(i, { label: e.target.value })}
                  placeholder="Attività"
                  className={`min-w-0 flex-1 ${ui.smallInput}`}
                />
                <button
                  type="button"
                  onClick={() => removeScheduleRow(i)}
                  className="flex-shrink-0 text-ink-3 hover:text-orange"
                >
                  <i className="ti ti-trash text-base" />
                </button>
              </div>
            ))}
            {form.schedule.length === 0 && (
              <p className={ui.intro}>Nessuna voce in agenda — aggiungine una.</p>
            )}
          </div>
        </div>

        {v2 ? (
          <div className={`space-y-3 ${ui.card}`} id="posizione">
            <h2 className={ui.cardTitle}>Dove si svolge</h2>
            <p className={ui.intro}>
              Scrivete il nome del posto o via e numero, poi sceglietelo dai suggerimenti: il numero resta e la mappa delle famiglie si aggiorna da sola.
            </p>
            <Field label="Indirizzo">
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
                className={ui.input}
              />
            </Field>
            <div className="overflow-hidden rounded-xl border border-partner-line">
              <iframe key={mapSrc} title="Anteprima mappa" src={mapSrc} className="h-48 w-full" loading="lazy" />
            </div>
            <details className="text-[13px] text-ink-2">
              <summary className="cursor-pointer select-none py-1 font-semibold text-partner-primary">
                Il punto sulla mappa non è giusto?
              </summary>
              <div className="mt-2 space-y-3">
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating}
                  className={ui.softButton}
                >
                  <i className={`ti ${locating ? "ti-loader-2 animate-spin" : "ti-map-pin"} text-[16px]`} aria-hidden="true" />
                  {locating ? "Localizzo…" : "Usa la posizione di questo dispositivo"}
                </button>
                {locateError && <p className="text-[12.5px] text-[#B4361F]">{locateError}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Latitudine">
                    <input type="number" step="0.0001" value={form.lat} onChange={(e) => update("lat", Number(e.target.value))} className={ui.input} />
                  </Field>
                  <Field label="Longitudine">
                    <input type="number" step="0.0001" value={form.lng} onChange={(e) => update("lng", Number(e.target.value))} className={ui.input} />
                  </Field>
                </div>
              </div>
            </details>
          </div>
        ) : (
        <div className={`space-y-3 ${ui.card}`}>
          <div className="flex items-center justify-between">
            <h2 className={ui.cardTitle}>Posizione</h2>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="flex items-center gap-1.5 rounded-full border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
            >
              <i className={`ti ${locating ? "ti-loader-2 animate-spin" : "ti-map-pin"} text-sm`} />
              {locating ? "Localizzo…" : "Usa posizione attuale"}
            </button>
          </div>
          {locateError && <p className="text-[11px] text-orange">{locateError}</p>}
          <Field label="Indirizzo">
            <input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              className={ui.input}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Latitudine">
              <input
                type="number"
                step="0.0001"
                value={form.lat}
                onChange={(e) => update("lat", Number(e.target.value))}
                className={ui.input}
              />
            </Field>
            <Field label="Longitudine">
              <input
                type="number"
                step="0.0001"
                value={form.lng}
                onChange={(e) => update("lng", Number(e.target.value))}
                className={ui.input}
              />
            </Field>
          </div>
          <div className="overflow-hidden rounded-md border border-[#E8EBF0]">
            <iframe
              key={mapSrc}
              title="Anteprima mappa"
              src={mapSrc}
              className="h-48 w-full"
              loading="lazy"
            />
          </div>
          <p className="text-[11px] text-ink-3">
            Anteprima con OpenStreetMap (nessuna chiave API richiesta). Aggiornabile in futuro con
            Google Maps o Mapbox se preferisci.
          </p>
        </div>

        )}

        {v2 ? (
          <div
            className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center gap-3 rounded-[18px] border border-partner-line bg-white/95 p-3 shadow-[0_6px_24px_rgba(14,90,99,0.10)] backdrop-blur md:bottom-4"
            data-testid="activity-save-bar"
          >
            <button
              type="submit"
              disabled={saving}
              data-spotlight="publish"
              className="min-h-[48px] flex-1 rounded-full bg-partner-primary px-5 text-[15px] font-bold text-white hover:bg-partner-primary-press disabled:opacity-60 sm:flex-none"
            >
              {saving ? "Salvo…" : "Salva modifiche"}
            </button>
            <Link href="/center/activities" className="min-h-[44px] px-2 py-3 text-[14px] font-semibold text-ink-2">
              Annulla
            </Link>
            {saveError && (
              <p role="alert" className="w-full text-[13px] font-medium text-[#B4361F]">
                {saveError}
              </p>
            )}
            {saved && !saveError && !activity.dbId && (
              <p className="w-full text-[13px] text-ink-2">Salvato (demo), non viene registrato.</p>
            )}
          </div>
        ) : (
        <div className="flex items-center gap-3 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <button
            type="submit"
            disabled={saving}
            data-spotlight="publish"
            className="rounded-md bg-sky px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC] disabled:opacity-60"
          >
            {saving ? "Salvo…" : "Salva modifiche"}
          </button>
          {saveError && <span className="text-xs font-medium text-orange">{saveError}</span>}
          {saved && !saveError && (
            <span className="text-xs font-medium text-green">
              {activity.dbId
                ? "Salvato ✓"
                : "Salvato (demo), non viene registrato."}
            </span>
          )}
        </div>
        )}
      </form>
    </div>
    </UiContext.Provider>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const ui = useContext(UiContext);
  return (
    <div>
      <label className={ui.label}>{label}</label>
      {children}
    </div>
  );
}

function ServiceField({
  title,
  value,
  onChange,
  timeLabel,
}: {
  title: string;
  value: ServiceOption;
  onChange: (patch: Partial<ServiceOption>) => void;
  timeLabel: string;
}) {
  const ui = useContext(UiContext);
  return (
    <div className={ui.serviceBox}>
      <label className="mb-2 flex items-center justify-between text-xs font-semibold text-ink">
        {title}
        <input
          type="checkbox"
          checked={value.available}
          onChange={(e) => onChange({ available: e.target.checked })}
          className="h-4 w-4 accent-sky"
        />
      </label>
      {value.available && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-[11px] text-ink-2">{timeLabel}</div>
            <input
              type="time"
              value={value.time}
              onChange={(e) => onChange({ time: e.target.value })}
              className={ui.serviceInput}
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] text-ink-2">Sovrapprezzo (€/sett.)</div>
            <input
              type="number"
              min={0}
              value={value.priceExtra}
              onChange={(e) => onChange({ priceExtra: Number(e.target.value) })}
              className={ui.serviceInput}
            />
          </div>
        </div>
      )}
    </div>
  );
}
