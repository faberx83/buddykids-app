"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Center, SocialLinks } from "@/lib/types";
import { DemoBadge } from "@/components/StatusBadge";
import { updateCenterProfileAction } from "@/app/actions/center";
import { GROUP_DISCOUNT_TIERS } from "@/lib/groups";
import AvatarUploadButton from "@/components/AvatarUploadButton";
import { MIN_DESCRIPTION } from "@/lib/centers/activation";
import PlaceAutocomplete from "@/components/nextgen/PlaceAutocomplete";
import { streetAddressText } from "@/lib/places/search";

// PORTALE CENTRI V2 (29/10/2026). Fabrizio: "anche la sezione profilo è
// vecchio stile". Col guscio nuovo (prop v2) stessi campi, stessa azione e
// stesso ritorno a Oggi, ma un riquadro per argomento (le stesse ancore delle
// righe di Centro), campi del portale centri, indirizzo con i suggerimenti
// come lato famiglie (la città si compila dal luogo scelto) e il pulsante
// sempre a portata. Senza guscio le classi di sempre (LEGACY_UI).
const LEGACY_UI = {
  input: "w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky",
  narrowInput: "w-24 rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky",
  section: "scroll-mt-32",
  sectionTitle: "mb-1 text-sm font-bold text-ink",
  intro: "mb-3 text-xs text-ink-2",
  label: "mb-1.5 block text-xs font-semibold text-ink-2",
  checkRow: "flex items-start gap-2.5 rounded-md bg-bg p-3 text-sm text-ink",
  socialBox: "flex items-center gap-2 rounded-md border border-[#E8EBF0] bg-bg px-3 py-2",
  tierLabel: "mb-1 text-[11px] text-ink-2",
};

const V2_UI: typeof LEGACY_UI = {
  input:
    "w-full min-h-[46px] rounded-xl border border-partner-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-partner-primary",
  narrowInput:
    "w-24 min-h-[46px] rounded-xl border border-partner-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-partner-primary",
  section:
    "scroll-mt-32 rounded-[18px] border border-partner-line bg-white p-5 target:border-partner-primary target:shadow-[0_0_0_3px_#E2F0EF]",
  sectionTitle: "mb-1 font-poppins text-[17px] font-semibold text-ink",
  intro: "mb-3.5 text-[13.5px] leading-snug text-ink-2",
  label: "mb-1.5 block text-[13px] font-semibold text-ink-2",
  checkRow:
    "flex items-start gap-3 rounded-xl border border-partner-line bg-partner-page p-3.5 text-[14.5px] text-ink [&_input]:h-[18px] [&_input]:w-[18px] [&_input]:accent-[#0E5A63]",
  socialBox: "flex min-h-[46px] items-center gap-2 rounded-xl border border-partner-line bg-white px-3.5 focus-within:border-partner-primary",
  tierLabel: "mb-1 text-[12.5px] text-ink-2",
};

const DEFAULT_FAMILY_TIERS = [10, 15, 20]; // 2°, 3°, 4°+ figlio

const socialFields: { key: keyof SocialLinks; label: string; icon: string; placeholder: string }[] = [
  { key: "instagram", label: "Instagram", icon: "ti-brand-instagram", placeholder: "https://instagram.com/..." },
  { key: "facebook", label: "Facebook", icon: "ti-brand-facebook", placeholder: "https://facebook.com/..." },
  { key: "tiktok", label: "TikTok", icon: "ti-brand-tiktok", placeholder: "https://tiktok.com/@..." },
  { key: "youtube", label: "YouTube", icon: "ti-brand-youtube", placeholder: "https://youtube.com/@..." },
  { key: "website", label: "Sito web", icon: "ti-world", placeholder: "https://..." },
];

export default function CenterProfileClient({
  center,
  dbId,
  v2 = false,
  placeSearch = false,
}: {
  center: Center;
  dbId: string | null;
  /** Portale centri V2 (guscio acceso). */
  v2?: boolean;
  /** Suggerimenti di indirizzo (solo V2). */
  placeSearch?: boolean;
}) {
  const router = useRouter();
  const ui = v2 ? V2_UI : LEGACY_UI;
  const [form, setForm] = useState({
    ...center,
    socialLinks: { ...center.socialLinks },
    multiweekDiscountPercent: center.multiweekDiscountPercent ?? 5,
    familyDiscountTiers: center.familyDiscountTiers ?? DEFAULT_FAMILY_TIERS,
    groupDiscountTiers: center.groupDiscountTiers ?? GROUP_DISCOUNT_TIERS.map((t) => ({ ...t })),
    cancellationWindowDays: center.cancellationWindowDays ?? 3,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function updateSocial(key: keyof SocialLinks, value: string) {
    setForm((f) => ({ ...f, socialLinks: { ...f.socialLinks, [key]: value || undefined } }));
    setSaved(false);
  }

  function updateFamilyTier(index: number, value: number) {
    setForm((f) => ({
      ...f,
      familyDiscountTiers: f.familyDiscountTiers.map((v, i) => (i === index ? value : v)),
    }));
    setSaved(false);
  }

  function updateGroupTierPercent(index: number, value: number) {
    setForm((f) => ({
      ...f,
      groupDiscountTiers: f.groupDiscountTiers.map((t, i) => (i === index ? { ...t, percent: value } : t)),
    }));
    setSaved(false);
  }

  return (
    <div>
      {!v2 && (
      <>
      {/* FINAL PRE-FREEZE WAVE (08/09/2026) — il titolo "Il mio centro" e lo
          stato demo sono ora nell'header di app/center/profile/page.tsx
          (nome reale del centro + città + stato pubblicazione), che rende
          questo titolo ridondante subito sopra. Tenuta solo la frase di
          contesto sul form, spostata come intestazione della sezione
          "Configurazione" — nessuna modifica al form/schema sotto. */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-bold text-ink">Configurazione</span>
        {!dbId && <DemoBadge />}
      </div>
      <p className="mb-3 text-xs text-ink-2">Queste informazioni sono visibili ai genitori nell&apos;app</p>
      </>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (!dbId) {
            setSaved(true);
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
            hasBar: Boolean(form.hasBar),
            accessible: Boolean(form.accessible),
            accessibleNote: form.accessibleNote ?? "",
            multiweekDiscountPercent: form.multiweekDiscountPercent,
            familyDiscountTiers: form.familyDiscountTiers,
            groupDiscountTiers: form.groupDiscountTiers,
            logoUrl: form.logoUrl,
            cancellationWindowDays: form.cancellationWindowDays,
          });
          setSaving(false);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSaved(true);
          // 28/10/2026, Fabrizio: "vorrei però che al salvataggio ritornasse
          // sulla dashboard" — sempre, non solo dalla card di attivazione.
          // In caso di errore si resta qui, con il messaggio.
          router.push("/center?salvato=profilo");
        }}
        className={v2 ? "space-y-4 pb-24" : "space-y-4 rounded-lg border border-[#E8EBF0] bg-white p-5"}
      >
        {v2 ? (
          <>
            <section id="contatti" aria-labelledby="p-contatti" className={`space-y-4 ${ui.section}`}>
              <h2 id="p-contatti" className={ui.sectionTitle}>
                Nome e contatti
              </h2>
              <div className="flex items-center gap-4">
                <AvatarUploadButton
                  folder="centers"
                  currentUrl={form.logoUrl}
                  onUploaded={(url) => update("logoUrl", url)}
                  size={64}
                  fallback={
                    <div className="flex h-full w-full items-center justify-center text-3xl" style={{ background: form.gradient }}>
                      {form.emoji}
                    </div>
                  }
                />
                <Field label="Nome del centro" className="flex-1" labelClass={ui.label}>
                  <input value={form.name} onChange={(e) => update("name", e.target.value)} className={ui.input} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email per le famiglie" labelClass={ui.label}>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => update("contactEmail", e.target.value)}
                    className={ui.input}
                  />
                </Field>
                <Field label="Telefono (facoltativo)" labelClass={ui.label}>
                  <input
                    type="tel"
                    value={form.contactPhone}
                    onChange={(e) => update("contactPhone", e.target.value)}
                    className={ui.input}
                  />
                </Field>
              </div>
            </section>

            <section id="indirizzo" aria-labelledby="p-indirizzo" className={`space-y-4 ${ui.section}`}>
              <h2 id="p-indirizzo" className={ui.sectionTitle}>
                Indirizzo
              </h2>
              <Field label="Via e numero" labelClass={ui.label}>
                <PlaceAutocomplete
                  id="center-address"
                  value={form.address}
                  onChange={(text) => update("address", text)}
                  onPick={(place) => {
                    if (place.city) update("city", place.city);
                  }}
                  pickText={(place) => streetAddressText(place, form.address)}
                  enabled={placeSearch}
                  placeholder="Es. Via Padova 21"
                  className={ui.input}
                />
              </Field>
              <p className="-mt-2 text-[12.5px] text-ink-2">Scrivete via e numero e sceglietela dai suggerimenti: il numero resta.</p>
              <Field label="Città" labelClass={ui.label}>
                <input value={form.city} onChange={(e) => update("city", e.target.value)} className={ui.input} />
              </Field>
            </section>

            <section id="descrizione" aria-labelledby="p-descrizione" className={ui.section}>
              <h2 id="p-descrizione" className={ui.sectionTitle}>
                Descrizione
              </h2>
              <p className={ui.intro}>Chi siete, dove siete, cosa vi rende speciali: è il primo testo che le famiglie leggono.</p>
              <label htmlFor="center-description" className="sr-only">
                Descrizione
              </label>
              <textarea
                id="center-description"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={5}
                className={ui.input}
              />
              {(form.description ?? "").trim().length < MIN_DESCRIPTION && (
                <p className="mt-1.5 text-[12.5px] text-ink-2">
                  Almeno {MIN_DESCRIPTION} caratteri: ne mancano {MIN_DESCRIPTION - (form.description ?? "").trim().length}
                </p>
              )}
            </section>
          </>
        ) : (
        <>
        <div className="flex items-center gap-4">
          <AvatarUploadButton
            folder="centers"
            currentUrl={form.logoUrl}
            onUploaded={(url) => update("logoUrl", url)}
            size={64}
            fallback={
              <div
                className="flex h-full w-full items-center justify-center text-3xl"
                style={{ background: form.gradient }}
              >
                {form.emoji}
              </div>
            }
          />
          <Field label="Nome del centro" className="flex-1" id="contatti">
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Città">
            <input
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </Field>
          <Field label="Indirizzo" id="indirizzo">
            <input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </Field>
        </div>

        <Field label="Descrizione" id="descrizione">
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={4}
            className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
          />
          {/* 28/10/2026: il controllo "Descrizione" dell'attivazione chiede
              almeno MIN_DESCRIPTION caratteri; prima non lo diceva da nessuna parte. */}
          {(form.description ?? "").trim().length < MIN_DESCRIPTION && (
            <p className="mt-1 text-xs text-ink-2">
              Almeno {MIN_DESCRIPTION} caratteri: ne mancano {MIN_DESCRIPTION - (form.description ?? "").trim().length}
            </p>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Email di contatto">
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) => update("contactEmail", e.target.value)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </Field>
          <Field label="Telefono">
            <input
              value={form.contactPhone}
              onChange={(e) => update("contactPhone", e.target.value)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </Field>
        </div>

        <div className="my-2 h-px bg-[#F0F2F5]" />
        </>
        )}

        <div id="accessibilita" className={ui.section}>
          <div className={ui.sectionTitle}>Accessibilità</div>
          <p className={ui.intro}>
            Indica se il centro è accessibile alle persone con disabilità: i genitori lo vedranno
            come badge nella scheda di ogni attività ospitata qui.
          </p>
          <label className={ui.checkRow}>
            <input
              type="checkbox"
              checked={Boolean(form.accessible)}
              onChange={(e) => update("accessible", e.target.checked)}
              className="mt-0.5"
            />
            <span>♿ Il centro è accessibile (rampe, bagno attrezzato, ecc.)</span>
          </label>
          {form.accessible && (
            <div className="mt-3">
              <Field label="Nota accessibilità (facoltativa)" labelClass={ui.label}>
                <input
                  value={form.accessibleNote ?? ""}
                  onChange={(e) => update("accessibleNote", e.target.value)}
                  placeholder="Es. Rampa d'accesso, bagno attrezzato"
                  className={ui.input}
                />
              </Field>
            </div>
          )}
        </div>

        {!v2 && <div className="my-2 h-px bg-[#F0F2F5]" />}

        <div id="social" className={ui.section}>
          <div className={ui.sectionTitle}>{v2 ? "Sito e social" : "Social"}</div>
          <p className={ui.intro}>
            Collega gli account social del centro: verranno mostrati nella pagina attività
            dell&apos;app.
          </p>
          <div className={v2 ? "grid gap-3 sm:grid-cols-2" : "grid grid-cols-2 gap-3"}>
            {socialFields.map((s) => (
              <Field key={s.key} label={s.label} labelClass={ui.label}>
                <div className={ui.socialBox}>
                  <i className={`ti ${s.icon} text-base text-ink-3`} />
                  <input
                    value={form.socialLinks?.[s.key] ?? ""}
                    onChange={(e) => updateSocial(s.key, e.target.value)}
                    placeholder={s.placeholder}
                    className={v2 ? "w-full bg-transparent text-[15px] outline-none" : "w-full bg-transparent text-sm outline-none"}
                  />
                </div>
              </Field>
            ))}
          </div>
        </div>

        {!v2 && <div className="my-2 h-px bg-[#F0F2F5]" />}

        <div id="sconti" className={ui.section}>
          <div className={ui.sectionTitle}>Sconti</div>
          <p className={ui.intro}>
            Personalizza gli sconti applicati alle prenotazioni delle famiglie per il tuo centro.
            Se non modifichi nulla restano i valori di default.
          </p>

          <Field
            label={v2 ? "Più settimane nella stessa prenotazione" : "Sconto multi-settimana (2+ settimane nella stessa prenotazione)"}
            labelClass={ui.label}
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={90}
                value={form.multiweekDiscountPercent}
                onChange={(e) => update("multiweekDiscountPercent", Number(e.target.value))}
                className={ui.narrowInput}
              />
              <span className="text-sm text-ink-2">%</span>
            </div>
          </Field>

          <div className="mt-3.5">
            <label className={ui.label}>
              {v2
                ? "Fratelli e sorelle nella stessa prenotazione (il primo paga il prezzo pieno)"
                : "Sconto famiglia (bambini della stessa famiglia nella stessa prenotazione — il 1° paga sempre il prezzo pieno)"}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {["2° figlio", "3° figlio", "4°+ figlio"].map((label, i) => (
                <div key={label}>
                  <div className={ui.tierLabel}>{label}</div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={form.familyDiscountTiers[i]}
                      onChange={(e) => updateFamilyTier(i, Number(e.target.value))}
                      className={ui.input}
                    />
                    <span className="text-sm text-ink-2">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3.5">
            <label className={ui.label}>
              {v2
                ? "Gruppi (per esempio una classe): sconto in base ai bambini iscritti"
                : "Sconto gruppo (Richiesta Gruppo — proporzionale al numero di bambini iscritti)"}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {form.groupDiscountTiers.map((tier, i) => (
                <div key={tier.minKids}>
                  <div className={ui.tierLabel}>{tier.minKids}+ bambini</div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={tier.percent}
                      onChange={(e) => updateGroupTierPercent(i, Number(e.target.value))}
                      className={ui.input}
                    />
                    <span className="text-sm text-ink-2">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {!v2 && <div className="my-2 h-px bg-[#F0F2F5]" />}

        <div id="cancellazioni" className={ui.section}>
          <div className={ui.sectionTitle}>Cancellazioni e modifiche</div>
          <p className={ui.intro}>
            Entro quanti giorni prima dell&apos;inizio della settimana un genitore può annullare o
            modificare una prenotazione in autonomia dall&apos;app. Oltre questo termine, il pulsante
            resta visibile ma disabilitato e invita il genitore a contattare direttamente il centro.
          </p>
          <Field label="Giorni di preavviso richiesti" labelClass={ui.label}>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={60}
                value={form.cancellationWindowDays}
                onChange={(e) => update("cancellationWindowDays", Number(e.target.value))}
                className={ui.narrowInput}
              />
              <span className="text-sm text-ink-2">giorni prima dell&apos;inizio settimana</span>
            </div>
          </Field>
        </div>

        {v2 ? (
          <div
            className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center gap-3 rounded-[18px] border border-partner-line bg-white/95 p-3 shadow-[0_6px_24px_rgba(14,90,99,0.10)] backdrop-blur md:bottom-4"
            data-testid="profile-save-bar"
          >
            <button
              type="submit"
              disabled={saving}
              className="min-h-[48px] flex-1 rounded-full bg-partner-primary px-5 text-[15px] font-bold text-white hover:bg-partner-primary-press disabled:opacity-60 sm:flex-none"
            >
              {saving ? "Salvo…" : "Salva e torna a Oggi"}
            </button>
            {error && (
              <p role="alert" className="w-full text-[13px] font-medium text-[#B4361F]">
                {error}
              </p>
            )}
            {saved && !error && (
              <p role="status" className="w-full text-[13px] text-ink-2">
                {dbId ? "Salvato. Torno a Oggi…" : "Salvato (demo), non viene registrato."}
              </p>
            )}
          </div>
        ) : (
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-sky px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC] disabled:opacity-60"
          >
            {saving ? "Salvo…" : "Salva e torna a Oggi"}
          </button>
          {error && <span className="text-xs font-medium text-orange">{error}</span>}
          {saved && !error && (
            <span className="text-xs font-medium text-green">
              {dbId ? "Salvato ✓ Torno a Oggi…" : "Salvato (demo), non viene registrato."}
            </span>
          )}
        </div>
        )}
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className,
  id,
  labelClass = LEGACY_UI.label,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Portale V2: classi dell'etichetta. */
  labelClass?: string;
  /** Ancora per le righe della sezione "Centro" del portale V2 (28/10/2026). */
  id?: string;
}) {
  return (
    <div id={id} className={`${id ? "scroll-mt-32 " : ""}${className ?? ""}`}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}
