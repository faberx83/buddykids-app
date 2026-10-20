// TRAMA — ADMIN BETA COCKPIT · Pezzi di interfaccia condivisi (server-safe,
// nessun hook). Card bianche sullo sfondo navy dell'Admin, numeri prima
// delle percentuali, nessun grafico.

import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_DEF, type FamilyStatus } from "@/lib/beta-cockpit/definitions";
import { PERIOD_PRESETS, type Period } from "@/lib/beta-cockpit/dates";
import { deltaLabel, kpiValueLabel, type Kpi } from "@/lib/beta-cockpit/model";

const TONE_CLS: Record<"grey" | "blue" | "green" | "amber" | "red", string> = {
  grey: "bg-[#F1F3F6] text-ink-2",
  blue: "bg-[#E8F0FE] text-[#1A4FB0]",
  green: "bg-green-light text-[#2d8f52]",
  amber: "bg-orange-light text-[#9A6200]",
  red: "bg-[#FBEAEA] text-[#C0392B]",
};

export function StatusBadge({ status }: { status: FamilyStatus }) {
  const def = STATUS_DEF[status];
  return (
    <span title={def.rule} className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLS[def.tone]}`}>
      {def.label}
    </span>
  );
}

export function Card({ title, subtitle, children, right }: { title?: string; subtitle?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mb-4 rounded-lg border border-[#E8EBF0] bg-white">
      {title && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E8EBF0] px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-2">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export function KpiTile({ kpi, href }: { kpi: Kpi; href: string | null }) {
  const delta = deltaLabel(kpi.delta);
  const body = (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">{kpi.label}</div>
      <div className="mt-1 text-xl font-bold text-ink">{kpiValueLabel(kpi)}</div>
      {delta && <div className="mt-0.5 text-[11px] text-ink-2">{delta}</div>}
    </>
  );
  const cls = "block rounded-lg border border-[#E8EBF0] bg-white px-3 py-2.5";
  return href ? (
    <Link href={href} title={kpi.hint} className={`${cls} hover:border-trama-violet`}>
      {body}
    </Link>
  ) : (
    <div title={kpi.hint} className={cls}>
      {body}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm text-ink-2">{children}</p>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="mb-4 rounded-lg border border-orange-mid bg-orange-light p-3 text-xs text-ink">{children}</div>;
}

/** Selettore del periodo: link per i preset, form GET per il personalizzato (funziona anche senza JavaScript). */
export function PeriodBar({ period, basePath, extra = {} }: { period: Period; basePath: string; extra?: Record<string, string> }) {
  const href = (p: string) => {
    const q = new URLSearchParams({ ...extra, p });
    return `${basePath}?${q.toString()}`;
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {PERIOD_PRESETS.filter((p) => p.key !== "custom").map((p) => (
        <Link
          key={p.key}
          href={href(p.key)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            period.preset === p.key ? "bg-trama-violet text-white" : "border border-[#E8EBF0] bg-white text-ink"
          }`}
        >
          {p.label}
        </Link>
      ))}
      <form method="get" action={basePath} className="flex flex-wrap items-center gap-1.5 rounded-full border border-[#E8EBF0] bg-white px-2 py-1">
        {Object.entries(extra).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="p" value="custom" />
        <label className="sr-only" htmlFor="periodo-da">
          Dal
        </label>
        <input id="periodo-da" type="date" name="da" defaultValue={period.from} className="rounded border border-[#E8EBF0] px-1 text-xs text-ink" />
        <span className="text-xs text-ink-2">→</span>
        <label className="sr-only" htmlFor="periodo-a">
          Al
        </label>
        <input id="periodo-a" type="date" name="a" defaultValue={period.to} className="rounded border border-[#E8EBF0] px-1 text-xs text-ink" />
        <button type="submit" className={`rounded-full px-2.5 py-1 text-xs font-semibold ${period.preset === "custom" ? "bg-trama-violet text-white" : "text-trama-violet"}`}>
          Applica
        </button>
      </form>
    </div>
  );
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", timeZone: "Europe/Rome" });
}

export function YesNo({ value }: { value: boolean }) {
  return value ? <span className="font-semibold text-[#2d8f52]">sì</span> : <span className="text-ink-3">no</span>;
}
