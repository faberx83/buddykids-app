// TRAMA — IL BUONGIORNO DI TRAMA (20/10/2026, Fabrizio: "possiamo impostare
// un briefing giornaliero alle 8? che arrivi come notifica… vorrei anche
// vedere una mail… e andrebbe messa come personalizzazione nel profilo").
//
// Riepilogo del mattino per un genitore: gli impegni di oggi (stessa agenda
// della Home: lib/nextgen/today-agenda.ts), chi accompagna oggi (stessa regola
// di Planner e Home: dayCoordinationSlots) e la prossima chiusura della scuola
// nei 14 giorni. Una notifica breve e un'email più completa.
// Se non c'è niente da dire (nessun impegno, niente da decidere, nessuna
// chiusura vicina) non si manda nulla: niente rumore.
// Logica pura (nessuna query): i dati arrivano da lib/data/daily-briefing.ts.

import type { AgendaEntry } from "@/lib/nextgen/today-agenda";
import type { ClosurePeriod } from "@/lib/nextgen/holiday-summary";
import { closureRangeLabel } from "@/lib/nextgen/holiday-summary";
import { addDaysIso, mondayOfIso } from "@/lib/nextgen/planner-week";

export const BRIEFING_LOCAL_HOUR = 8;
export const BRIEFING_CLOSURE_DAYS = 14;
export const PUBLIC_ORIGIN = "https://tramapp.it";

export interface BriefingSlot {
  kidId: string;
  kidName: string;
  moment: "andata" | "ritorno";
  /** null = da decidere */
  label: string | null;
}

export interface DailyBriefing {
  title: string;
  body: string;
  /** Stessa giornata = stessa notifica: una seconda copia sostituisce la prima invece di aggiungersi. */
  tag: string;
  deepLink: string;
  subject: string;
  html: string;
  text: string;
}

const WEEKDAYS_IT = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MONTHS_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** "martedì 20 ottobre" */
export function dateLabelIt(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${WEEKDAYS_IT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_IT[d.getUTCMonth()]}`;
}

/** Data e ora in Europe/Rome, indipendentemente dal fuso del server (UTC su Vercel). */
export function romeNow(now: Date): { dateIso: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { dateIso: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

function entryLine(e: AgendaEntry): string {
  const time = e.startTime ? (e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime) : "In giornata";
  const kids = e.kids.map((k) => k.name).filter(Boolean);
  return `${time} · ${e.title}${kids.length ? ` · ${joinNames(kids)}` : ""}`;
}

export function nextClosure(periods: ClosurePeriod[], todayIso: string): ClosurePeriod | null {
  const limit = addDaysIso(todayIso, BRIEFING_CLOSURE_DAYS);
  return periods.filter((p) => p.endDate >= todayIso && p.startDate <= limit).sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;
}

export function buildDailyBriefing(input: {
  todayIso: string;
  firstName: string | null;
  entries: AgendaEntry[];
  slots: BriefingSlot[];
  closurePeriods: ClosurePeriod[];
  kidNameById: Record<string, string>;
}): DailyBriefing | null {
  const { todayIso, entries, slots } = input;
  const missing = slots.filter((s) => s.label === null);
  const decided = slots.filter((s) => s.label !== null);
  const closure = nextClosure(input.closurePeriods, todayIso);
  if (entries.length === 0 && slots.length === 0 && !closure) return null;

  const dayLabel = dateLabelIt(todayIso);
  const hello = input.firstName ? `Buongiorno ${input.firstName}` : "Buongiorno";
  const weekLink = `/nextgen/planner?week=${mondayOfIso(todayIso)}`;
  const deepLink = missing.length > 0 ? `${weekLink}&assegna=${todayIso}` : "/nextgen";

  // ── Notifica (20/10/2026, Fabrizio: "super scarna"): una riga per cosa,
  // come un mini-elenco. Android e iPhone la mostrano intera aprendo la
  // notifica; chiusa si vede la prima riga. Massimo 5 righe. ──
  const MAX_LINES = 5;
  const lines: string[] = [];
  if (entries.length === 0) lines.push("Nessun impegno in agenda");
  const shownEntries = entries.slice(0, missing.length || closure ? 3 : 4);
  for (const e of shownEntries) lines.push(entryLine(e));
  if (entries.length > shownEntries.length) lines.push(`+ altri ${entries.length - shownEntries.length}`);
  if (missing.length > 0) {
    const who = missing.map((m) => `chi ${m.moment === "andata" ? "porta" : "ritira"} ${m.kidName}`);
    lines.push(`Da decidere: ${who.length <= 2 ? who.join(", ") : `${who.length} passaggi`}`);
  } else if (slots.length > 0) {
    lines.push("Chi accompagna: tutto deciso");
  }
  if (closure && closure.startDate <= addDaysIso(todayIso, 7)) {
    lines.push(`Scuola chiusa ${closureRangeLabel(closure.startDate, closure.endDate)}`);
  }
  const body = lines.slice(0, MAX_LINES).join("\n");
  const title = `${hello} · ${dayLabel}`;
  const tag = `buongiorno-${todayIso}`;

  // ── Email ──
  const momentLabel = (m: BriefingSlot["moment"]) => (m === "andata" ? "Porta" : "Ritira");
  const closureText = closure
    ? `${closure.labels[0] ? `${closure.labels[0]}, ` : ""}${closureRangeLabel(closure.startDate, closure.endDate)}${
        closure.kidIds.length ? ` (${joinNames(closure.kidIds.map((id) => input.kidNameById[id]).filter(Boolean))})` : ""
      }`
    : null;

  const textLines = [
    `${hello}! Ecco la giornata di ${dayLabel}.`,
    "",
    "OGGI",
    ...(entries.length ? entries.map((e) => `- ${entryLine(e)}`) : ["- Nessun impegno in agenda."]),
  ];
  if (slots.length) {
    textLines.push("", "CHI ACCOMPAGNA");
    for (const s of slots) textLines.push(`- ${s.kidName} · ${momentLabel(s.moment)}: ${s.label ?? "da decidere"}`);
  }
  if (closureText) textLines.push("", "SCUOLA CHIUSA", `- ${closureText}`);
  textLines.push("", `Apri TRAMA: ${PUBLIC_ORIGIN}${deepLink}`, "", "Ricevi questa email perché hai attivato il buongiorno di TRAMA. Lo spegni da Profilo → Impostazioni → Preferenze.");

  const section = (title: string, rows: string) =>
    `<tr><td style="padding:18px 0 6px;font:600 12px/1.4 -apple-system,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#4A3F9E">${title}</td></tr><tr><td>${rows}</td></tr>`;
  const row = (left: string, right: string, warn = false) =>
    `<div style="padding:10px 12px;margin:0 0 6px;border:1px solid #E9E6DF;border-radius:12px;background:#ffffff !important;font:15px/1.4 -apple-system,Helvetica,Arial,sans-serif;color:#172A4D">${left ? `<span style="color:#6B7280">${left}</span>&nbsp; ` : ""}${
      warn ? `<b style="color:#7A4500">${right}</b>` : `<b>${right}</b>`
    }</div>`;

  const agendaRows = entries.length
    ? entries
        .map((e) => {
          const time = e.startTime ? (e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime) : "In giornata";
          const kids = e.kids.map((k) => k.name).filter(Boolean);
          return row(escapeHtml(time), `${escapeHtml(e.title)}${kids.length ? ` · ${escapeHtml(joinNames(kids))}` : ""}`);
        })
        .join("")
    : row("", "Nessun impegno in agenda");
  const slotRows = slots.map((s) => row(`${escapeHtml(s.kidName)} · ${momentLabel(s.moment)}`, escapeHtml(s.label ?? "da decidere"), s.label === null)).join("");

  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<style>:root{color-scheme:light only;supported-color-schemes:light only}body,table,td{background-color:#FDFCFA !important}</style>
<title>${escapeHtml(hello)}</title></head><body bgcolor="#FDFCFA" style="margin:0;background:#FDFCFA;color-scheme:light only">
<!-- 20/10/2026: sempre chiara come l'app, anche col tema scuro del telefono (Apple Mail e le app che rispettano color-scheme). -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FDFCFA" style="background:#FDFCFA"><tr><td align="center" bgcolor="#FDFCFA" style="padding:24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 0 8px"><img src="${PUBLIC_ORIGIN}/brand/trama-logo-mark.png" alt="" width="44" style="display:block;height:auto"></td></tr>
<tr><td style="font:600 24px/1.25 -apple-system,Helvetica,Arial,sans-serif;color:#172A4D">${escapeHtml(hello)}!</td></tr>
<tr><td style="padding:4px 0 0;font:15px/1.4 -apple-system,Helvetica,Arial,sans-serif;color:#6B7280">Ecco la giornata di ${escapeHtml(dayLabel)}.</td></tr>
${section("Oggi", agendaRows)}
${slots.length ? section(missing.length ? `Chi accompagna · ${missing.length} da decidere` : "Chi accompagna", slotRows) : ""}
${closureText ? section("Scuola chiusa", row("", escapeHtml(closureText))) : ""}
<tr><td style="padding:22px 0 8px"><a href="${PUBLIC_ORIGIN}${deepLink}" style="display:inline-block;padding:13px 22px;border-radius:12px;background:#172A4D;color:#fff;font:600 15px -apple-system,Helvetica,Arial,sans-serif;text-decoration:none">${
    missing.length ? "Decidi chi accompagna" : "Apri TRAMA"
  }</a></td></tr>
<tr><td style="padding:18px 0 0;font:12px/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#8A8F98">Ricevi questa email perché hai attivato il buongiorno di TRAMA. Lo spegni da Profilo → Impostazioni → Preferenze.</td></tr>
</table></td></tr></table></body></html>`;

  const subjectBits = [entries.length === 0 ? "nessun impegno" : entries.length === 1 ? "1 impegno" : `${entries.length} impegni`];
  if (missing.length) subjectBits.push(missing.length === 1 ? "1 passaggio da decidere" : `${missing.length} passaggi da decidere`);
  const subject = `Il buongiorno di TRAMA · ${dayLabel}: ${subjectBits.join(", ")}`;

  return { title, body, tag, deepLink, subject, html, text: textLines.join("\n") };
}

/** Il cron gira due volte (06 e 07 UTC): invia solo quando a Roma sono le 8 (ora legale e solare). */
export function isBriefingHour(now: Date): boolean {
  return romeNow(now).hour === BRIEFING_LOCAL_HOUR;
}
