"use client";

import { useState } from "react";
import { Center, SocialLinks } from "@/lib/types";
import { DemoBadge } from "@/components/StatusBadge";
import { updateCenterProfileAction } from "@/app/actions/center";
import { GROUP_DISCOUNT_TIERS } from "@/lib/groups";
import AvatarUploadButton from "@/components/AvatarUploadButton";

const DEFAULT_FAMILY_TIERS = [10, 15, 20]; // 2°, 3°, 4°+ figlio

const socialFields: { key: keyof SocialLinks; label: string; icon: string; placeholder: string }[] = [
  { key: "instagram", label: "Instagram", icon: "ti-brand-instagram", placeholder: "https://instagram.com/..." },
  { key: "facebook", label: "Facebook", icon: "ti-brand-facebook", placeholder: "https://facebook.com/..." },
  { key: "tiktok", label: "TikTok", icon: "ti-brand-tiktok", placeholder: "https://tiktok.com/@..." },
  { key: "youtube", label: "YouTube", icon: "ti-brand-youtube", placeholder: "https://youtube.com/@..." },
  { key: "website", label: "Sito web", icon: "ti-world", placeholder: "https://..." },
];

export default function CenterProfileClient({ center, dbId }: { center: Center; dbId: string | null }) {
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
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-ink">Il mio centro</h1>
          {!dbId && <DemoBadge />}
        </div>
        <p className="text-sm text-ink-2">Queste informazioni sono visibili ai genitori nell&apos;app</p>
      </div>

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
        }}
        className="space-y-4 rounded-lg border border-[#E8EBF0] bg-white p-5"
      >
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
          <Field label="Nome del centro" className="flex-1">
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
          <Field label="Indirizzo">
            <input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
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

        <div>
          <div className="mb-1 text-sm font-bold text-ink">Accessibilità</div>
          <p className="mb-3 text-xs text-ink-2">
            Indica se il centro è accessibile alle persone con disabilità: i genitori lo vedranno
            come badge nella scheda di ogni attività ospitata qui.
          </p>
          <label className="flex items-start gap-2.5 rounded-md bg-bg p-3 text-sm text-ink">
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
              <Field label="Nota accessibilità (facoltativa)">
                <input
                  value={form.accessibleNote ?? ""}
                  onChange={(e) => update("accessibleNote", e.target.value)}
                  placeholder="Es. Rampa d'accesso, bagno attrezzato"
                  className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
                />
              </Field>
            </div>
          )}
        </div>

        <div className="my-2 h-px bg-[#F0F2F5]" />

        <div>
          <div className="mb-1 text-sm font-bold text-ink">Social</div>
          <p className="mb-3 text-xs text-ink-2">
            Collega gli account social del centro: verranno mostrati nella pagina attività
            dell&apos;app.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {socialFields.map((s) => (
              <Field key={s.key} label={s.label}>
                <div className="flex items-center gap-2 rounded-md border border-[#E8EBF0] bg-bg px-3 py-2">
                  <i className={`ti ${s.icon} text-base text-ink-3`} />
                  <input
                    value={form.socialLinks?.[s.key] ?? ""}
                    onChange={(e) => updateSocial(s.key, e.target.value)}
                    placeholder={s.placeholder}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>
              </Field>
            ))}
          </div>
        </div>

        <div className="my-2 h-px bg-[#F0F2F5]" />

        <div>
          <div className="mb-1 text-sm font-bold text-ink">Sconti</div>
          <p className="mb-3 text-xs text-ink-2">
            Personalizza gli sconti applicati alle prenotazioni delle famiglie per il tuo centro.
            Se non modifichi nulla restano i valori di default.
          </p>

          <Field label="Sconto multi-settimana (2+ settimane nella stessa prenotazione)">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={90}
                value={form.multiweekDiscountPercent}
                onChange={(e) => update("multiweekDiscountPercent", Number(e.target.value))}
                className="w-24 rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
              />
              <span className="text-sm text-ink-2">%</span>
            </div>
          </Field>

          <div className="mt-3.5">
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">
              Sconto famiglia (bambini della stessa famiglia nella stessa prenotazione — il 1°
              paga sempre il prezzo pieno)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {["2° figlio", "3° figlio", "4°+ figlio"].map((label, i) => (
                <div key={label}>
                  <div className="mb-1 text-[11px] text-ink-2">{label}</div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={form.familyDiscountTiers[i]}
                      onChange={(e) => updateFamilyTier(i, Number(e.target.value))}
                      className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
                    />
                    <span className="text-sm text-ink-2">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3.5">
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">
              Sconto gruppo (Richiesta Gruppo — proporzionale al numero di bambini iscritti)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {form.groupDiscountTiers.map((tier, i) => (
                <div key={tier.minKids}>
                  <div className="mb-1 text-[11px] text-ink-2">{tier.minKids}+ bambini</div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={tier.percent}
                      onChange={(e) => updateGroupTierPercent(i, Number(e.target.value))}
                      className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
                    />
                    <span className="text-sm text-ink-2">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="my-2 h-px bg-[#F0F2F5]" />

        <div>
          <div className="mb-1 text-sm font-bold text-ink">Cancellazioni e modifiche</div>
          <p className="mb-3 text-xs text-ink-2">
            Entro quanti giorni prima dell&apos;inizio della settimana un genitore può annullare o
            modificare una prenotazione in autonomia dall&apos;app. Oltre questo termine, il pulsante
            resta visibile ma disabilitato e invita il genitore a contattare direttamente il centro.
          </p>
          <Field label="Giorni di preavviso richiesti">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={60}
                value={form.cancellationWindowDays}
                onChange={(e) => update("cancellationWindowDays", Number(e.target.value))}
                className="w-24 rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
              />
              <span className="text-sm text-ink-2">giorni prima dell&apos;inizio settimana</span>
            </div>
          </Field>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-sky px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC] disabled:opacity-60"
          >
            {saving ? "Salvo…" : "Salva modifiche"}
          </button>
          {error && <span className="text-xs font-medium text-orange">{error}</span>}
          {saved && !error && (
            <span className="text-xs font-medium text-green">
              {dbId ? "Salvato su Supabase ✓" : "Salvato (demo) — verrà scritto su Supabase quando collegato."}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold text-ink-2">{label}</label>
      {children}
    </div>
  );
}
