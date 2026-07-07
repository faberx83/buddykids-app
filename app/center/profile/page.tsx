"use client";

import { useState } from "react";
import { centers, demoCenterAdminCenterId } from "@/lib/mock-data";
import { SocialLinks } from "@/lib/types";

const socialFields: { key: keyof SocialLinks; label: string; icon: string; placeholder: string }[] = [
  { key: "instagram", label: "Instagram", icon: "ti-brand-instagram", placeholder: "https://instagram.com/..." },
  { key: "facebook", label: "Facebook", icon: "ti-brand-facebook", placeholder: "https://facebook.com/..." },
  { key: "tiktok", label: "TikTok", icon: "ti-brand-tiktok", placeholder: "https://tiktok.com/@..." },
  { key: "youtube", label: "YouTube", icon: "ti-brand-youtube", placeholder: "https://youtube.com/@..." },
  { key: "website", label: "Sito web", icon: "ti-world", placeholder: "https://..." },
];

export default function CenterProfilePage() {
  const initial = centers.find((c) => c.id === demoCenterAdminCenterId)!;
  const [form, setForm] = useState({ ...initial, socialLinks: { ...initial.socialLinks } });
  const [saved, setSaved] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function updateSocial(key: keyof SocialLinks, value: string) {
    setForm((f) => ({ ...f, socialLinks: { ...f.socialLinks, [key]: value || undefined } }));
    setSaved(false);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Il mio centro</h1>
        <p className="text-sm text-ink-2">Queste informazioni sono visibili ai genitori nell&apos;app</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(true);
        }}
        className="space-y-4 rounded-lg border border-[#E8EBF0] bg-white p-5"
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full text-3xl"
            style={{ background: form.gradient }}
          >
            {form.emoji}
          </div>
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

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md bg-sky px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC]"
          >
            Salva modifiche
          </button>
          {saved && (
            <span className="text-xs font-medium text-green">
              Salvato (demo) — verrà scritto su Supabase quando collegato.
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
