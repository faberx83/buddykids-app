"use client";

// TRAMA — SCHOOL CALENDAR INTELLIGENCE (14/09/2026, §B11). Client minimo:
// lista calendari (con eventi espandibili) + form "Nuovo calendario" + form
// "Nuovo evento" per calendario + pubblica/elimina evento. Nessuna
// astrazione aggiuntiva (niente wizard multi-step, niente validazione
// avanzata) — coerente con "il minimo necessario", non un CMS.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SchoolCalendarAdminRow } from "@/lib/data/school-calendar-admin";
import {
  upsertSchoolCalendarAction,
  upsertSchoolCalendarEventAction,
  deleteSchoolCalendarEventAction,
  publishSchoolCalendarAction,
} from "@/app/actions/school-calendar";
import { ITALIAN_REGIONS } from "@/lib/school-calendar/regions";

const EVENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "school_year_start", label: "Inizio anno scolastico" },
  { value: "school_year_end", label: "Fine anno scolastico" },
  { value: "christmas_break", label: "Vacanze di Natale" },
  { value: "easter_break", label: "Vacanze di Pasqua" },
  { value: "public_holiday", label: "Festività nazionale" },
  { value: "regional_closure", label: "Chiusura regionale" },
  { value: "bridge", label: "Ponte" },
  { value: "other_closure", label: "Altra chiusura" },
];

const STATUS_LABEL: Record<string, string> = { draft: "Bozza", published: "Pubblicato" };
const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: "bg-[#F0F2F5] text-ink-3",
  published: "bg-green-light text-[#2d8f52]",
};

function NewCalendarForm({ onCreated }: { onCreated: () => void }) {
  const [region, setRegion] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await upsertSchoolCalendarAction({ region, schoolYear, validFrom, validTo, source, sourceUrl, status: "draft" });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setRegion("");
    setSchoolYear("");
    setValidFrom("");
    setValidTo("");
    setSource("");
    setSourceUrl("");
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-lg border border-[#E8EBF0] bg-white p-4">
      <div className="mb-2 text-sm font-bold text-ink">Nuovo calendario (bozza)</div>
      <div className="grid grid-cols-2 gap-2">
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-md border border-[#E8EBF0] px-2 py-1.5 text-xs">
          <option value="">Regione…</option>
          {ITALIAN_REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
          placeholder="Anno scolastico (es. 2026/2027)"
          className="rounded-md border border-[#E8EBF0] px-2 py-1.5 text-xs"
        />
        <input
          type="date"
          value={validFrom}
          onChange={(e) => setValidFrom(e.target.value)}
          className="rounded-md border border-[#E8EBF0] px-2 py-1.5 text-xs"
        />
        <input
          type="date"
          value={validTo}
          onChange={(e) => setValidTo(e.target.value)}
          className="rounded-md border border-[#E8EBF0] px-2 py-1.5 text-xs"
        />
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Fonte (es. Regione X - USR)"
          className="rounded-md border border-[#E8EBF0] px-2 py-1.5 text-xs"
        />
        <input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="URL fonte"
          className="rounded-md border border-[#E8EBF0] px-2 py-1.5 text-xs"
        />
      </div>
      {error && <p className="mt-2 text-[11px] text-[#C0392B]">{error}</p>}
      <button type="submit" disabled={busy} className="mt-2 rounded-md bg-trama-violet px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
        {busy ? "Salvataggio…" : "Crea calendario"}
      </button>
    </form>
  );
}

// TRAMA — SCHOOL CALENDAR MUNICIPAL SCOPE (16/09/2026, §6). "Comune"
// opzionale: vuoto = evento regionale (comportamento invariato per chi non
// lo compila), valorizzato = evento locale (si applica solo ai bambini con
// lo stesso comune, matching normalizzato lato service layer — vedi
// lib/school-calendar/comune.ts). Nessuna autocomplete/lista Comuni
// (fuori scope, niente ISTAT/geocoding in questa sessione): un semplice
// input testo, coerente col resto del form.
function NewEventForm({ calendarId, onCreated }: { calendarId: string; onCreated: () => void }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [eventType, setEventType] = useState(EVENT_TYPE_OPTIONS[0].value);
  const [label, setLabel] = useState("");
  const [comune, setComune] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await upsertSchoolCalendarEventAction({
      calendarId,
      startDate,
      endDate,
      eventType: eventType as Parameters<typeof upsertSchoolCalendarEventAction>[0]["eventType"],
      label,
      sourceLevel: null,
      notes: "",
      comune,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStartDate("");
    setEndDate("");
    setLabel("");
    setComune("");
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-end gap-1.5 rounded-md bg-bg p-2">
      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-md border border-[#E8EBF0] px-2 py-1 text-[11px]" />
      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-md border border-[#E8EBF0] px-2 py-1 text-[11px]" />
      <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="rounded-md border border-[#E8EBF0] px-2 py-1 text-[11px]">
        {EVENT_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Etichetta"
        className="min-w-0 flex-1 rounded-md border border-[#E8EBF0] px-2 py-1 text-[11px]"
      />
      <div className="flex flex-col gap-0.5">
        <input
          value={comune}
          onChange={(e) => setComune(e.target.value)}
          placeholder="Comune (opzionale)"
          className="w-36 rounded-md border border-[#E8EBF0] px-2 py-1 text-[11px]"
        />
        <span className="text-[9.5px] leading-tight text-ink-3">Lascia vuoto per applicare l&apos;evento a tutta la Regione.</span>
      </div>
      <button type="submit" disabled={busy} className="rounded-md bg-trama-violet px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60">
        Aggiungi
      </button>
      {error && <span className="text-[10px] text-[#C0392B]">{error}</span>}
    </form>
  );
}

function CalendarCard({ calendar, onChanged }: { calendar: SchoolCalendarAdminRow; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handlePublish() {
    if (!window.confirm(`Pubblicare il calendario ${calendar.region} ${calendar.schoolYear}? Da questo momento è visibile a chiunque sia autenticato.`))
      return;
    setBusy(true);
    await publishSchoolCalendarAction(calendar.id);
    setBusy(false);
    onChanged();
  }

  async function handleDeleteEvent(eventId: string) {
    if (!window.confirm("Eliminare questo evento?")) return;
    await deleteSchoolCalendarEventAction(eventId);
    onChanged();
  }

  return (
    <div className="mb-3 rounded-lg border border-[#E8EBF0] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-ink">
            {calendar.region} — {calendar.schoolYear}
          </div>
          <div className="text-[11px] text-ink-2">
            {calendar.validFrom} → {calendar.validTo} · {calendar.source || "fonte non indicata"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_CLASS[calendar.status]}`}>
            {STATUS_LABEL[calendar.status]}
          </span>
          {calendar.status === "draft" && (
            <button onClick={handlePublish} disabled={busy} className="rounded-md bg-sky px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60">
              Pubblica
            </button>
          )}
          <button onClick={() => setExpanded((v) => !v)} className="text-[11px] font-semibold text-trama-violet">
            {expanded ? "Nascondi eventi" : `Eventi (${calendar.events.length})`}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-[#F0F2F5] pt-3">
          <ul className="flex flex-col gap-1">
            {calendar.events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 text-[11px] text-ink-2">
                <span>
                  {e.startDate} → {e.endDate} · {e.label} ({e.eventType})
                  {/* TRAMA — SCHOOL CALENDAR MUNICIPAL SCOPE (16/09/2026, §7): badge
                      discreto, nessun redesign. comune NULL -> "Regionale"
                      (comportamento di oggi), valorizzato -> "Locale · <Comune>". */}
                  <span className="ml-1.5 rounded-full bg-[#F0F2F5] px-1.5 py-0.5 text-[9.5px] font-semibold text-ink-3">
                    {e.comune ? `Locale · ${e.comune}` : "Regionale"}
                  </span>
                </span>
                <button onClick={() => handleDeleteEvent(e.id)} className="text-[10px] font-semibold text-[#C0392B]">
                  Elimina
                </button>
              </li>
            ))}
            {calendar.events.length === 0 && <li className="text-[11px] text-ink-3">Nessun evento ancora inserito.</li>}
          </ul>
          <NewEventForm calendarId={calendar.id} onCreated={onChanged} />
        </div>
      )}
    </div>
  );
}

export default function SchoolCalendarAdminClient({ initialCalendars }: { initialCalendars: SchoolCalendarAdminRow[] }) {
  const router = useRouter();

  function handleChanged() {
    router.refresh();
  }

  return (
    <div>
      <NewCalendarForm onCreated={handleChanged} />
      {initialCalendars.length === 0 ? (
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-4 text-sm text-ink-2">
          Nessun calendario ancora inserito — il Planner dei genitori resta invariato (nessun segnale scuola) finché
          non viene pubblicato almeno un calendario per la loro regione.
        </div>
      ) : (
        initialCalendars.map((c) => <CalendarCard key={c.id} calendar={c} onChanged={handleChanged} />)
      )}
    </div>
  );
}
