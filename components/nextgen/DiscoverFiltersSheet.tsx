"use client";

// TRAMA — FILTRI DI SCOPRI V2 (14/10/2026, segnalazione Fabrizio: "devi
// guardare anche i filtri, hanno ancora vecchio stile"). Con DISCOVER_V2
// "Filtri" non apre più la riga di pillole con un pannello per ciascuna
// (stile precedente: input numerici, slider grezzo, caselle di spunta con
// emoji, coordinate GPS a schermo): apre un foglio dal basso con tutte le
// sezioni una sotto l'altra e, in fondo, "Mostra N risultati".
//
// Presentazione soltanto (WRAP): lo stato, l'URL, la logica di filtro e il
// conteggio restano in app/nextgen/search/SearchDiscoveryClient.tsx, che
// passa valori e setter. Fuori da V2 la vecchia riga resta identica.

import { useEffect, useRef } from "react";

export interface DiscoverFilterServices {
  preScuola: boolean;
  postScuola: boolean;
  pranzo: boolean;
  bar: boolean;
  attivitaExtra: boolean;
  accessoDisabili: boolean;
  dieteGestite: boolean;
}

export type DiscoverCoverageMode = "week_only" | "day_only" | "mixed";

export const AGE_PRESETS: { label: string; min: number; max: number }[] = [
  { label: "Tutte", min: 0, max: 18 },
  { label: "3–5 anni", min: 3, max: 5 },
  { label: "6–10 anni", min: 6, max: 10 },
  { label: "11–14 anni", min: 11, max: 14 },
];

export const PRICE_PRESETS: { label: string; value: number }[] = [
  { label: "Qualsiasi", value: 500 },
  { label: "Fino a €150", value: 150 },
  { label: "Fino a €250", value: 250 },
  { label: "Fino a €350", value: 350 },
];

export const SERVICE_OPTIONS: { key: keyof DiscoverFilterServices; icon: string; label: string }[] = [
  { key: "preScuola", icon: "ti-sunrise", label: "Pre-scuola" },
  { key: "postScuola", icon: "ti-sunset-2", label: "Post-scuola" },
  { key: "pranzo", icon: "ti-tools-kitchen-2", label: "Pranzo incluso" },
  { key: "bar", icon: "ti-cup", label: "Bar nel centro" },
  { key: "accessoDisabili", icon: "ti-wheelchair", label: "Accessibile" },
  { key: "dieteGestite", icon: "ti-salad", label: "Diete gestite" },
  { key: "attivitaExtra", icon: "ti-sparkles", label: "Attività extra" },
];

const COVERAGE_LABELS: Record<DiscoverCoverageMode, string> = {
  week_only: "Settimana intera",
  day_only: "Giorni singoli",
  mixed: "Entrambe",
};

const CHIP = "flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-semibold transition-colors active:scale-[0.97]";
const CHIP_ON = "border-trama-primary bg-trama-primary text-white";
const CHIP_OFF = "border-[#E3E6EC] bg-white text-ink";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-trama-line py-4 first:border-t-0 first:pt-1">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-poppins text-[15px] font-semibold text-ink">{title}</h3>
        {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Chip({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon?: string; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}>
      {icon && <i className={`ti ${icon} text-[15px]`} aria-hidden="true" />}
      {children}
    </button>
  );
}

export default function DiscoverFiltersSheet({
  open,
  onClose,
  resultsCount,
  activeCount,
  onClearAll,
  minAge,
  maxAge,
  onAgeChange,
  maxPrice,
  onMaxPriceChange,
  zone,
  onZoneChange,
  zoneOptions,
  hasGeo,
  geoLoading,
  geoError,
  onLocateMe,
  onClearGeo,
  radiusKm,
  onRadiusChange,
  categories,
  selectedTagIds,
  onToggleTag,
  services,
  onToggleService,
  coverageModes,
  onToggleCoverage,
  onlyDaySpots,
  onOnlyDaySpotsChange,
  weekGroups,
  selectedWeekStarts,
  onToggleWeek,
}: {
  open: boolean;
  onClose: () => void;
  resultsCount: number;
  activeCount: number;
  onClearAll: () => void;
  minAge: number;
  maxAge: number;
  onAgeChange: (min: number, max: number) => void;
  maxPrice: number;
  onMaxPriceChange: (value: number) => void;
  zone: string;
  onZoneChange: (value: string) => void;
  zoneOptions: string[];
  hasGeo: boolean;
  geoLoading: boolean;
  geoError: string | null;
  onLocateMe: () => void;
  onClearGeo: () => void;
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  categories: { id: string; label: string }[];
  selectedTagIds: string[];
  onToggleTag: (id: string) => void;
  services: DiscoverFilterServices;
  onToggleService: (key: keyof DiscoverFilterServices) => void;
  coverageModes: DiscoverCoverageMode[];
  onToggleCoverage: (mode: DiscoverCoverageMode) => void;
  onlyDaySpots: boolean;
  onOnlyDaySpotsChange: (value: boolean) => void;
  weekGroups: { monthLabel: string; weeks: { start: string; label: string }[] }[];
  selectedWeekStarts: string[];
  onToggleWeek: (start: string) => void;
}) {
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    sheetRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const agePreset = AGE_PRESETS.find((p) => p.min === minAge && p.max === maxAge);
  const pricePreset = PRICE_PRESETS.find((p) => p.value === maxPrice);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" role="presentation">
      <button type="button" aria-label="Chiudi i filtri" onClick={onClose} className="absolute inset-0 bg-[rgba(23,42,77,0.45)]" />
      <section
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="discover-filters-h"
        className="relative mx-auto flex max-h-[88dvh] w-full max-w-[430px] flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(23,42,77,0.18)] outline-none"
      >
        <div className="flex flex-col px-5 pt-2.5">
          <span aria-hidden="true" className="mb-2 h-1 w-10 self-center rounded-full bg-[#D6DAE3]" />
          <div className="flex items-center justify-between pb-2">
            <h2 id="discover-filters-h" className="font-poppins text-[18px] font-semibold text-ink">
              Filtri
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi"
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-[20px] text-ink-2 active:bg-black/[0.04]"
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-5">
          <Section title="Età" hint={agePreset ? undefined : `da ${minAge} a ${maxAge} anni`}>
            <div className="flex flex-wrap gap-2">
              {AGE_PRESETS.map((p) => (
                <Chip key={p.label} on={agePreset?.label === p.label} onClick={() => onAgeChange(p.min, p.max)}>
                  {p.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Prezzo a settimana" hint={pricePreset ? undefined : `fino a €${maxPrice}`}>
            <div className="flex flex-wrap gap-2">
              {PRICE_PRESETS.map((p) => (
                <Chip key={p.value} on={maxPrice === p.value} onClick={() => onMaxPriceChange(p.value)}>
                  {p.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Zona">
            {hasGeo ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2 rounded-[12px] bg-trama-primary-soft px-3 py-2.5">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-trama-primary">
                    <i className="ti ti-current-location text-[17px]" aria-hidden="true" />
                    Vicino a te
                  </span>
                  <button type="button" onClick={onClearGeo} className="min-h-[36px] px-1 text-[13px] font-semibold text-trama-accent-ink">
                    Rimuovi
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-ink-2">Entro</span>
                  {[2, 5, 10, 20].map((km) => (
                    <Chip key={km} on={radiusKm === km} onClick={() => onRadiusChange(km)}>
                      {km} km
                    </Chip>
                  ))}
                </div>
                <p className="text-[12px] text-ink-3">Le attività più lontane restano in fondo all&apos;elenco.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  value={zone}
                  onChange={(e) => onZoneChange(e.target.value)}
                  list="zona-suggestions-v2"
                  placeholder="Quartiere, via o città"
                  aria-label="Zona"
                  className="min-h-[46px] w-full rounded-[12px] border border-[#E3E6EC] bg-white px-3.5 text-[15px] text-ink outline-none focus:border-trama-primary"
                />
                <datalist id="zona-suggestions-v2">
                  {zoneOptions.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={onLocateMe}
                  disabled={geoLoading}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-[12px] border border-[#D9DDE5] bg-white text-[14px] font-semibold text-trama-primary active:bg-black/[0.03] disabled:opacity-60"
                >
                  <i className="ti ti-current-location text-[17px]" aria-hidden="true" />
                  {geoLoading ? "Cerco la tua posizione…" : "Usa la mia posizione"}
                </button>
                {geoError && (
                  <p role="alert" className="text-[12.5px] font-medium text-[#B54708]">
                    {geoError}
                  </p>
                )}
              </div>
            )}
          </Section>

          <Section title="Tipo di attività">
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Chip key={c.id} on={selectedTagIds.includes(c.id)} onClick={() => onToggleTag(c.id)}>
                  {c.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Servizi">
            <div className="flex flex-wrap gap-2">
              {SERVICE_OPTIONS.map((s) => (
                <Chip key={s.key} on={services[s.key]} onClick={() => onToggleService(s.key)} icon={s.icon}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Come si prenota">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(COVERAGE_LABELS) as DiscoverCoverageMode[]).map((m) => (
                <Chip key={m} on={coverageModes.includes(m)} onClick={() => onToggleCoverage(m)}>
                  {COVERAGE_LABELS[m]}
                </Chip>
              ))}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={onlyDaySpots}
              onClick={() => onOnlyDaySpotsChange(!onlyDaySpots)}
              className="flex min-h-[48px] items-center justify-between gap-3 rounded-[12px] border border-[#E3E6EC] bg-white px-3.5 text-left"
            >
              <span className="text-[14px] text-ink">Solo con giorni singoli liberi adesso</span>
              <span className={`relative h-6 w-10 flex-shrink-0 rounded-full transition-colors ${onlyDaySpots ? "bg-trama-primary" : "bg-[#D6DAE3]"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${onlyDaySpots ? "left-[18px]" : "left-0.5"}`} />
              </span>
            </button>
          </Section>

          {weekGroups.length > 0 && (
            <Section title="Settimane estive" hint={selectedWeekStarts.length > 0 ? `${selectedWeekStarts.length} scelte` : undefined}>
              {weekGroups.map((g) => (
                <div key={g.monthLabel} className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{g.monthLabel}</span>
                  <div className="flex flex-wrap gap-2">
                    {g.weeks.map((w) => (
                      <Chip key={w.start} on={selectedWeekStarts.includes(w.start)} onClick={() => onToggleWeek(w.start)}>
                        {w.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
            </Section>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-trama-line px-5 pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-3">
          {activeCount > 0 && (
            <button type="button" onClick={onClearAll} className="min-h-[44px] px-1 text-[14px] font-semibold text-trama-accent-ink">
              Azzera
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[48px] flex-1 items-center justify-center rounded-[12px] bg-trama-primary px-4 text-[15px] font-bold text-white active:bg-trama-primary-press"
          >
            {resultsCount === 1 ? "Mostra 1 risultato" : `Mostra ${resultsCount} risultati`}
          </button>
        </div>
      </section>
    </div>
  );
}
