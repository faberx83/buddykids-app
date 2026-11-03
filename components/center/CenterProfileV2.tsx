"use client";

// TRAMA — PORTALE CENTRI V2, PROFILO DEL CENTRO A SEZIONI (03/11/2026).
// Fabrizio (30/10): "Profilo e attività sono ancora vecchio style". Senza
// sezione: l'elenco delle parti del profilo con la sintesi di ciascuna. Con
// ?sezione=…: solo quella parte, "Salva" sempre visibile, poi si torna alla
// pagina di partenza (Oggi o Centro) con una conferma. Stessa azione di
// sempre (updateCenterProfileAction, che riceve il profilo intero).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Center, SocialLinks } from "@/lib/types";
import { updateCenterProfileAction } from "@/app/actions/center";
import { GROUP_DISCOUNT_TIERS } from "@/lib/groups";
import AvatarUploadButton from "@/components/AvatarUploadButton";
import PlaceAutocomplete from "@/components/nextgen/PlaceAutocomplete";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import { MIN_DESCRIPTION } from "@/lib/centers/activation";
import { streetAddressText } from "@/lib/places/search";
import {
  PROFILE_SECTIONS,
  centerNameError,
  profileSectionHref,
  profileSummaries,
  type ProfileSectionKey,
} from "@/lib/centers/profile-v2";

const INPUT =
  "w-full min-h-[46px] rounded-xl border border-partner-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-partner-primary";
const NARROW = "w-24 min-h-[46px] rounded-xl border border-partner-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-partner-primary";
const LABEL = "mb-1.5 block text-[13px] font-semibold text-ink-2";
const HINT = "mt-1.5 text-[12.5px] leading-snug text-ink-2";
const CHECK_ROW = "flex items-start gap-3 rounded-xl border border-partner-line bg-partner-page p-3.5 text-[14.5px] text-ink";
const CHECK = "mt-0.5 h-[18px] w-[18px] flex-shrink-0 accent-[#0E5A63]";

const DEFAULT_FAMILY_TIERS = [10, 15, 20];

const SOCIAL_FIELDS: { key: keyof SocialLinks; label: string; icon: string; placeholder: string }[] = [
  { key: "website", label: "Sito web", icon: "ti-world", placeholder: "https://..." },
  { key: "instagram", label: "Instagram", icon: "ti-brand-instagram", placeholder: "https://instagram.com/..." },
  { key: "facebook", label: "Facebook", icon: "ti-brand-facebook", placeholder: "https://facebook.com/..." },
  { key: "tiktok", label: "TikTok", icon: "ti-brand-tiktok", placeholder: "https://tiktok.com/@..." },
  { key: "youtube", label: "YouTube", icon: "ti-brand-youtube", placeholder: "https://youtube.com/@..." },
];

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
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

export default function CenterProfileV2({
  center,
  dbId,
  section,
  returnHref,
  from,
}: {
  center: Center;
  dbId: string | null;
  section: ProfileSectionKey | null;
  returnHref: string;
  from: "centro" | "oggi" | null;
}) {
  const router = useRouter();
  const showToast = useNextgenToast();
  const [form, setForm] = useState({
    name: center.name ?? "",
    city: center.city ?? "",
    address: center.address ?? "",
    description: center.description ?? "",
    contactEmail: center.contactEmail ?? "",
    contactPhone: center.contactPhone ?? "",
    logoUrl: center.logoUrl ?? null,
    socialLinks: { ...(center.socialLinks ?? {}) } as SocialLinks,
    hasBar: Boolean(center.hasBar),
    accessible: Boolean(center.accessible),
    accessibleNote: center.accessibleNote ?? "",
    multiweekDiscountPercent: center.multiweekDiscountPercent ?? 5,
    familyDiscountTiers: center.familyDiscountTiers ?? DEFAULT_FAMILY_TIERS,
    groupDiscountTiers: center.groupDiscountTiers ?? GROUP_DISCOUNT_TIERS.map((t) => ({ ...t })),
    cancellationWindowDays: center.cancellationWindowDays ?? 3,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const summaries = profileSummaries(
    {
      ...form,
      socialLinks: form.socialLinks as Record<string, string | undefined>,
    },
    MIN_DESCRIPTION
  );

  async function save() {
    setError(null);
    const nameProblem = centerNameError(form.name);
    if (nameProblem) {
      setNameError(nameProblem);
      document.getElementById("p-name")?.focus();
      return;
    }
    if (!dbId) {
      showToast("Salvato (demo), non viene registrato", "info");
      return;
    }
    setSaving(true);
    const result = await updateCenterProfileAction({
      centerDbId: dbId,
      name: form.name,
      city: form.city,
      address: form.address,
      description: form.description,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      socialLinks: form.socialLinks,
      hasBar: form.hasBar,
      accessible: form.accessible,
      accessibleNote: form.accessibleNote,
      multiweekDiscountPercent: form.multiweekDiscountPercent,
      familyDiscountTiers: form.familyDiscountTiers,
      groupDiscountTiers: form.groupDiscountTiers,
      logoUrl: form.logoUrl,
      cancellationWindowDays: form.cancellationWindowDays,
      // Le regole di cancellazione si confermano solo salvando la loro sezione,
      // non salvando (per esempio) il telefono.
      confirmsCancellation: section === "cancellazioni",
    }).catch(() => ({ error: "Non siamo riusciti a salvare, riprovate." }));
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    showToast("Salvato");
    // Si torna da dove si è partiti (Oggi o Centro), senza lasciare il modulo nella cronologia.
    router.replace(returnHref);
    router.refresh();
  }

  // ─── Senza sezione: l'elenco delle parti del profilo ───
  if (!section) {
    return (
      <div className="flex flex-col gap-5">
        {(["profilo", "regole"] as const).map((group) => (
          <section key={group} aria-labelledby={`pg-${group}`} className="flex flex-col gap-2">
            <h2 id={`pg-${group}`} className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">
              {group === "profilo" ? "Profilo del centro" : "Regole"}
            </h2>
            <ul className="overflow-hidden rounded-[18px] border border-partner-line bg-white">
              {PROFILE_SECTIONS.filter((s) => s.group === group).map((s, i, arr) => {
                const sum = summaries[s.key];
                return (
                  <li key={s.key} className={i < arr.length - 1 ? "border-b border-[#EEF2F1]" : ""}>
                    <Link
                      href={profileSectionHref(s.key)}
                      data-testid={`profile-section-${s.key}`}
                      className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-partner-page"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[15px] font-semibold text-ink">{s.title}</span>
                        <span className={`truncate text-[12.5px] ${sum.todo ? "font-semibold text-[#7A4F00]" : "text-ink-2"}`}>{sum.text}</span>
                      </span>
                      {sum.todo && <span className="rounded-full bg-[#FFF3DC] px-2.5 py-1 text-[12px] font-bold text-[#7A4F00]">Da fare</span>}
                      <i className="ti ti-chevron-right flex-shrink-0 text-[18px] text-ink-2" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  // ─── Una sezione ───
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="flex flex-col gap-4 pb-28"
      data-testid={`profile-editor-${section}`}
    >
      <div className="flex flex-col gap-4 rounded-[18px] border border-partner-line bg-white p-5">
        {section === "contatti" && (
          <>
            <Field label="Nome del centro" htmlFor="p-name">
              <input
                id="p-name"
                value={form.name}
                onChange={(e) => {
                  update("name", e.target.value);
                  if (nameError) setNameError(null);
                }}
                required
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? "p-name-error" : undefined}
                className={`${INPUT} ${nameError ? "border-[#B4361F]" : ""}`}
              />
              {nameError && (
                <p id="p-name-error" role="alert" className="mt-1.5 text-[13px] font-medium text-[#B4361F]">
                  {nameError}
                </p>
              )}
            </Field>
            <Field label="Città o zona" htmlFor="p-city">
              <input id="p-city" value={form.city} onChange={(e) => update("city", e.target.value)} className={INPUT} />
            </Field>
            <Field label="Email per le famiglie" htmlFor="p-email">
              <input id="p-email" type="email" value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} className={INPUT} />
            </Field>
            <Field label="Telefono (facoltativo)" htmlFor="p-phone">
              <input id="p-phone" type="tel" value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} className={INPUT} />
            </Field>
          </>
        )}

        {section === "indirizzo" && (
          <>
            <Field label="Via e numero" htmlFor="center-address" hint="Scrivete via e numero e sceglietela dai suggerimenti: il numero resta e la città si compila.">
              <PlaceAutocomplete
                id="center-address"
                value={form.address}
                onChange={(text) => update("address", text)}
                onPick={(place) => {
                  if (place.city) update("city", place.city);
                }}
                pickText={(place) => streetAddressText(place, form.address)}
                enabled
                placeholder="Es. Via Padova 21"
                className={INPUT}
              />
            </Field>
            <Field label="Città" htmlFor="p-city2">
              <input id="p-city2" value={form.city} onChange={(e) => update("city", e.target.value)} className={INPUT} />
            </Field>
          </>
        )}

        {section === "descrizione" && (
          <>
            <div className="flex items-center gap-4">
              <AvatarUploadButton
                folder="centers"
                currentUrl={form.logoUrl}
                onUploaded={(url) => update("logoUrl", url)}
                size={64}
                fallback={
                  <div className="flex h-full w-full items-center justify-center text-3xl" style={{ background: center.gradient }}>
                    {center.emoji}
                  </div>
                }
              />
              <p className="text-[13px] text-ink-2">Il logo compare accanto al nome del centro. Toccatelo per cambiarlo.</p>
            </div>
            <Field label="Descrizione" htmlFor="p-desc" hint="Chi siete, dove siete, cosa vi rende speciali: è il primo testo che le famiglie leggono.">
              <textarea id="p-desc" rows={6} value={form.description} onChange={(e) => update("description", e.target.value)} className={INPUT} />
            </Field>
            {form.description.trim().length < MIN_DESCRIPTION && (
              <p className="-mt-2 text-[12.5px] font-semibold text-[#7A4F00]">
                Almeno {MIN_DESCRIPTION} caratteri: ne mancano {MIN_DESCRIPTION - form.description.trim().length}
              </p>
            )}
          </>
        )}

        {section === "accessibilita" && (
          <>
            <p className="text-[13.5px] text-ink-2">Le famiglie lo vedono su ogni vostra attività.</p>
            <label className={CHECK_ROW}>
              <input type="checkbox" checked={form.accessible} onChange={(e) => update("accessible", e.target.checked)} className={CHECK} />
              <span>Il centro è accessibile alle persone con disabilità</span>
            </label>
            {form.accessible && (
              <Field label="Nota (facoltativa)" htmlFor="p-accnote">
                <input
                  id="p-accnote"
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

        {section === "social" && (
          <>
            {SOCIAL_FIELDS.map((s) => (
              <Field key={s.key} label={s.label} htmlFor={`p-${s.key}`}>
                <div className="flex min-h-[46px] items-center gap-2 rounded-xl border border-partner-line bg-white px-3.5 focus-within:border-partner-primary">
                  <i className={`ti ${s.icon} text-[18px] text-ink-2`} aria-hidden="true" />
                  <input
                    id={`p-${s.key}`}
                    type="url"
                    inputMode="url"
                    value={form.socialLinks?.[s.key] ?? ""}
                    onChange={(e) => update("socialLinks", { ...form.socialLinks, [s.key]: e.target.value || undefined })}
                    placeholder={s.placeholder}
                    className="w-full bg-transparent text-[15px] outline-none"
                  />
                </div>
              </Field>
            ))}
          </>
        )}

        {section === "cancellazioni" && (
          <>
            <p className="text-[13.5px] leading-snug text-ink-2">
              Fino a quanti giorni prima dell&apos;inizio una famiglia può annullare o cambiare la prenotazione da sola, in app. Dopo, il pulsante resta
              visibile ma spento e invita a contattarvi.
            </p>
            <Field label="Giorni di preavviso" htmlFor="p-cancel">
              <div className="flex items-center gap-2">
                <input
                  id="p-cancel"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={60}
                  value={form.cancellationWindowDays}
                  onChange={(e) => update("cancellationWindowDays", Number(e.target.value))}
                  className={NARROW}
                />
                <span className="text-[14px] text-ink-2">giorni prima</span>
              </div>
            </Field>
            <p className="text-[12.5px] text-ink-2">Salvando confermate queste regole anche per l&apos;attivazione del centro.</p>
          </>
        )}

        {section === "sconti" && (
          <>
            <p className="text-[13.5px] text-ink-2">Valgono per tutte le vostre attività. Se non cambiate nulla restano questi valori.</p>
            <Field label="Più settimane nella stessa prenotazione" htmlFor="p-multi">
              <div className="flex items-center gap-2">
                <input
                  id="p-multi"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={90}
                  value={form.multiweekDiscountPercent}
                  onChange={(e) => update("multiweekDiscountPercent", Number(e.target.value))}
                  className={NARROW}
                />
                <span className="text-[14px] text-ink-2">%</span>
              </div>
            </Field>
            <div>
              <span className={LABEL}>Fratelli e sorelle nella stessa prenotazione (il primo paga il prezzo pieno)</span>
              <div className="grid grid-cols-3 gap-3">
                {["2° figlio", "3° figlio", "4° e oltre"].map((label, i) => (
                  <div key={label}>
                    <label htmlFor={`p-fam-${i}`} className="mb-1 block text-[12.5px] text-ink-2">
                      {label}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        id={`p-fam-${i}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={90}
                        value={form.familyDiscountTiers[i]}
                        onChange={(e) =>
                          update(
                            "familyDiscountTiers",
                            form.familyDiscountTiers.map((v, j) => (j === i ? Number(e.target.value) : v))
                          )
                        }
                        className={INPUT}
                      />
                      <span className="text-[14px] text-ink-2">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span className={LABEL}>Gruppi (per esempio una classe), in base ai bambini iscritti</span>
              <div className="grid grid-cols-3 gap-3">
                {form.groupDiscountTiers.map((t, i) => (
                  <div key={t.minKids}>
                    <label htmlFor={`p-grp-${i}`} className="mb-1 block text-[12.5px] text-ink-2">
                      {t.minKids}+ bambini
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        id={`p-grp-${i}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={90}
                        value={t.percent}
                        onChange={(e) =>
                          update(
                            "groupDiscountTiers",
                            form.groupDiscountTiers.map((g, j) => (j === i ? { ...g, percent: Number(e.target.value) } : g))
                          )
                        }
                        className={INPUT}
                      />
                      <span className="text-[14px] text-ink-2">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[12.5px] text-ink-2">
              Le promozioni di un periodo preciso sono in{" "}
              <Link href="/center/promotions" className="font-semibold text-partner-primary">
                Promozioni
              </Link>
              .
            </p>
          </>
        )}
      </div>

      <div
        className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center gap-3 rounded-[18px] border border-partner-line bg-white/95 p-3 shadow-[0_6px_24px_rgba(14,90,99,0.10)] backdrop-blur md:bottom-4"
        data-testid="profile-save-bar"
      >
        <button
          type="submit"
          disabled={saving}
          className="min-h-[48px] flex-1 rounded-full bg-partner-primary px-5 text-[15px] font-bold text-white hover:bg-partner-primary-press disabled:opacity-60 sm:flex-none"
        >
          {saving ? "Salvo…" : from === "oggi" ? "Salva e torna a Oggi" : "Salva"}
        </button>
        <Link href={returnHref} replace className="min-h-[44px] px-2 py-3 text-[14px] font-semibold text-ink-2">
          Annulla
        </Link>
        {error && (
          <p role="alert" className="w-full text-[13px] font-medium text-[#B4361F]">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
