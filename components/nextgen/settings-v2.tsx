"use client";

// TRAMA — IMPOSTAZIONI V2 (20/10/2026, Fabrizio: "la sezione impostazioni ha
// ancora layout vecchio… sistemiamolo"). Pezzi comuni delle pagine
// Preferenze, Sicurezza e Privacy e account nell'area famiglie: titolo di
// sezione, card con righe, interruttore. Stesso linguaggio di La tua
// famiglia (FamigliaV2Client) e dei filtri di Scopri (interruttore di
// DiscoverFiltersSheet), token in lib/nextgen/v2-ui.ts.
// I componenti condivisi con la V1 e col portale Partner
// (ProfilePreferencesSection, ProfileSecuritySection, ProfilePrivacySection,
// WalkthroughRestartButton) li usano solo con la prop `v2`: altrove nulla cambia.

import type { ReactNode } from "react";

export const SETTINGS_CARD = "rounded-2xl border border-trama-line bg-white";
export const SETTINGS_INPUT =
  "min-h-[48px] w-full rounded-[12px] border border-trama-line bg-white px-3.5 text-[16px] text-ink outline-none focus:border-trama-primary";
export const SETTINGS_ERROR = "text-[13px] font-medium text-[#B3261E]";
export const SETTINGS_OK = "text-[13px] font-medium text-[#146B4F]";

export function SettingsSection({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <h2 id={id} className="font-poppins text-[18px] font-semibold text-ink">
          {title}
        </h2>
        {hint && <p className="text-[13.5px] leading-snug text-ink-2">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Piccola etichetta "In arrivo" per le scelte che si salvano ma non cambiano ancora nulla. */
export function SoonTag() {
  return (
    <span className="rounded-full bg-trama-accent-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-trama-accent-ink">
      In arrivo
    </span>
  );
}

/** Riga con interruttore (navy acceso, grigio spento), alta almeno 60. */
export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
  extra,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  extra?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left disabled:opacity-60"
    >
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <span>{label}</span>
          {extra}
        </span>
        {hint && <span className="text-[13px] leading-snug text-ink-2">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${checked ? "bg-trama-primary" : "bg-[#D6DAE3]"}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
