"use client";

import { useState } from "react";
import Link from "next/link";
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
}: {
  activity: Activity;
  tags?: Tag[];
  certifications?: CertificationItem[];
}) {
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
    preService: activity.preService ?? { available: false, time: "07:30", priceExtra: 0 },
    postService: activity.postService ?? { available: false, time: "18:00", priceExtra: 0 },
    schedule: activity.schedule,
    coverImageUrl: activity.coverImageUrl ?? null,
    galleryUrls: activity.galleryUrls ?? [],
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
    <div className="max-w-2xl">
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
            preService: form.preService,
            postService: form.postService,
            schedule: form.schedule,
            coverImageUrl: form.coverImageUrl,
            galleryUrls: form.galleryUrls,
          });
          setSaving(false);
          if (result.error) {
            setSaveError(result.error);
            return;
          }
          setSaved(true);
        }}
        className="space-y-6"
      >
        <div className="space-y-4 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <div className="text-sm font-bold text-ink">Informazioni generali</div>

          <Field label="Nome attività">
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fascia d'età">
              <input
                value={form.ageRange}
                onChange={(e) => update("ageRange", e.target.value)}
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
              />
            </Field>
            <Field label="Posti rimasti (in evidenza)">
              <input
                type="number"
                min={0}
                disabled={!form.showExactSpots}
                value={form.spotsLeft}
                onChange={(e) => update("spotsLeft", Number(e.target.value))}
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky disabled:opacity-50"
              />
            </Field>
          </div>

          <label className="flex items-start gap-2.5 rounded-md bg-bg p-3 text-sm text-ink">
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
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
              />
            </Field>
            <Field label="Navetta (€/sett., 0 = non disponibile)">
              <input
                type="number"
                min={0}
                value={form.shuttlePrice}
                onChange={(e) => update("shuttlePrice", Number(e.target.value))}
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
              />
            </Field>
          </div>

          <Field label="Descrizione">
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={4}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </Field>
        </div>

        <div className="space-y-4 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <div className="text-sm font-bold text-ink">Immagini</div>
          <p className="text-xs text-ink-2">
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

        <div className="space-y-3 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <div className="text-sm font-bold text-ink">Tag</div>
          <p className="text-xs text-ink-2">
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
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-sky bg-sky-light text-sky"
                      : "border-[#E8EBF0] bg-bg text-ink-2"
                  }`}
                >
                  <span>{c.emoji}</span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <div className="text-sm font-bold text-ink">Certificazioni servizio</div>
          <p className="text-xs text-ink-2">
            Certificazioni specifiche del servizio esposto (es. &quot;Istruttori certificati FISE
            per equitazione&quot;, &quot;Allenatrici FIG&quot;) — non un elenco fisso, scrivi
            l&apos;etichetta che descrive la certificazione. Ogni richiesta viene verificata da un
            Admin piattaforma prima di diventare un badge visibile ai genitori.
          </p>

          <div className="space-y-2">
            {certList.map((cert) => (
              <div
                key={cert.id}
                className="flex flex-wrap items-center gap-2.5 rounded-md bg-bg p-3"
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
                    className="text-xs font-semibold text-sky"
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
              <p className="text-xs text-ink-2">Nessuna certificazione richiesta finora.</p>
            )}
          </div>

          <div className="grid gap-2 rounded-md border border-dashed border-[#E8EBF0] p-3 sm:grid-cols-[1fr_auto_auto]">
            <input
              value={certLabel}
              onChange={(e) => setCertLabel(e.target.value)}
              placeholder="Es. Istruttori certificati FISE per equitazione"
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
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
              className="rounded-md bg-sky px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
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

        <div className="space-y-4 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <div className="text-sm font-bold text-ink">Servizi extra e pasto</div>

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
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            >
              {(Object.entries(mealLabels) as [MealOption, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <label className="flex items-start gap-2.5 rounded-md bg-bg p-3 text-sm text-ink">
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

          <label className="flex items-start gap-2.5 rounded-md bg-bg p-3 text-sm text-ink">
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
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
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
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "border-sky bg-sky-light text-sky"
                        : "border-[#E8EBF0] bg-bg text-ink-2"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-ink">Agenda della giornata</div>
            <button
              type="button"
              onClick={addScheduleRow}
              className="rounded-md bg-sky-light px-2.5 py-1.5 text-xs font-semibold text-sky"
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
                  className="w-20 flex-shrink-0 rounded-md border border-[#E8EBF0] bg-bg px-2 py-1.5 text-xs outline-none focus:border-sky"
                />
                <input
                  value={s.label}
                  onChange={(e) => updateScheduleRow(i, { label: e.target.value })}
                  placeholder="Attività"
                  className="flex-1 rounded-md border border-[#E8EBF0] bg-bg px-2 py-1.5 text-xs outline-none focus:border-sky"
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
              <p className="text-xs text-ink-2">Nessuna voce in agenda — aggiungine una.</p>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-ink">Posizione</div>
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
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Latitudine">
              <input
                type="number"
                step="0.0001"
                value={form.lat}
                onChange={(e) => update("lat", Number(e.target.value))}
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
              />
            </Field>
            <Field label="Longitudine">
              <input
                type="number"
                step="0.0001"
                value={form.lng}
                onChange={(e) => update("lng", Number(e.target.value))}
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
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

        <div className="flex items-center gap-3 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-sky px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC] disabled:opacity-60"
          >
            {saving ? "Salvo…" : "Salva modifiche"}
          </button>
          {saveError && <span className="text-xs font-medium text-orange">{saveError}</span>}
          {saved && !saveError && (
            <span className="text-xs font-medium text-green">
              {activity.dbId
                ? "Salvato su Supabase ✓"
                : "Salvato (demo) — verrà scritto su Supabase quando collegato."}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-ink-2">{label}</label>
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
  return (
    <div className="rounded-md bg-bg p-3">
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
              className="w-full rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs outline-none focus:border-sky"
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] text-ink-2">Sovrapprezzo (€/sett.)</div>
            <input
              type="number"
              min={0}
              value={value.priceExtra}
              onChange={(e) => onChange({ priceExtra: Number(e.target.value) })}
              className="w-full rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs outline-none focus:border-sky"
            />
          </div>
        </div>
      )}
    </div>
  );
}
