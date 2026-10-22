// Generatore minimale di un file .ics (iCalendar) per "Aggiungi al
// calendario" dopo una prenotazione — nessuna dipendenza esterna, usato lato
// client per costruire un data URL da scaricare/aprire.

function icsDate(iso: string): string {
  return iso.replace(/-/g, "");
}

// DTEND negli eventi "tutto il giorno" e' ESCLUSIVO in iCalendar: bisogna
// aggiungere un giorno rispetto all'ultimo giorno effettivo dell'evento.
function nextDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// TRAMA — Calendar Export V1 (11/09/2026): il backslash va escapato PER
// PRIMO (RFC 5545 §3.3.11) — altrimenti un backslash introdotto
// dall'escaping di virgola/punto-e-virgola verrebbe ri-escapato una seconda
// volta. Gap pre-esistente (mai un problema finora: titolo/descrizione
// dell'unico consumer, BookingSuccessActions.tsx, non contenevano mai un
// backslash) — corretto ora perché Calendar Export espone anche indirizzi
// reali dei centri (LOCATION), un campo testo libero dove un backslash è
// più plausibile.
function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
}

export function buildIcsDataUrl(opts: {
  title: string;
  description: string;
  startDate: string; // ISO yyyy-mm-dd, incluso
  endDate: string; // ISO yyyy-mm-dd, incluso
}): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TRAMA//IT",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@buddykids.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(opts.startDate)}`,
    `DTEND;VALUE=DATE:${icsDate(nextDay(opts.endDate))}`,
    `SUMMARY:${escapeIcsText(opts.title)}`,
    `DESCRIPTION:${escapeIcsText(opts.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const ics = lines.join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

// TRAMA — Calendar Export V1 (11/09/2026, §5 della spec Planner
// Intelligence — Fabrizio: "domain normalization → generic calendar items
// → ICS generator"). Generatore MULTI-EVENTO, deliberatamente separato da
// buildIcsDataUrl() sopra (invariata: resta l'unico evento singolo usato da
// BookingSuccessActions.tsx dopo una prenotazione appena creata — nessuna
// regressione). Prende un array di oggetti GENERICI (PlannerCalendarItemForIcs
// sotto, stessa forma di lib/planner/calendar-items.ts#PlannerCalendarItem
// ma senza importare quel modulo: questo file resta senza dipendenze da
// Supabase/dominio prenotazioni, riceve solo dati già normalizzati) — un
// futuro source "EXTERNAL" produce la stessa forma e passa da qui senza
// modifiche a questo generatore.
export interface PlannerCalendarItemForIcs {
  id: string;
  title: string;
  kidNames: string[];
  startDate: string; // ISO yyyy-mm-dd, incluso
  endDate: string; // ISO yyyy-mm-dd, incluso
  centerName: string | null;
  centerAddress: string | null;
  centerCity: string | null;
  note: string | null;
  /**
   * 22/10/2026 (Fabrizio: "anche esporta calendario non vede nulla") — gli
   * impegni del Planner hanno orario e si ripetono: tutto facoltativo, le
   * prenotazioni restano eventi di giornata intera come prima.
   */
  startTime?: string | null; // "HH:MM"
  endTime?: string | null;
  /** Ripetizione settimanale: 1 = lunedì … 7 = domenica; interval 2 = settimane alterne. Fino a endDate. */
  weekly?: { weekdays: number[]; interval: 1 | 2 } | null;
  /** Ogni giorno da startDate a endDate (impegno di più giorni senza ripetizione). */
  daily?: boolean;
  /** Giorni da saltare (es. chiusure della scuola). */
  exceptDates?: string[];
}

const ICS_DAY = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const ROME_TZ = "Europe/Rome";

// Fuso di Roma (ora legale dall'ultima domenica di marzo all'ultima di ottobre).
const VTIMEZONE_ROME = [
  "BEGIN:VTIMEZONE",
  `TZID:${ROME_TZ}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function icsLocalTime(iso: string, hhmm: string): string {
  return `${icsDate(iso)}T${hhmm.replace(":", "").slice(0, 4)}00`;
}

function plusOneHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Righe DTSTART/DTEND/RRULE/EXDATE di un evento con orario. */
function timedEventLines(item: PlannerCalendarItemForIcs): string[] {
  const start = item.startTime!.slice(0, 5);
  const end = item.endTime && item.endTime.slice(0, 5) > start ? item.endTime.slice(0, 5) : plusOneHour(start);
  const out = [`DTSTART;TZID=${ROME_TZ}:${icsLocalTime(item.startDate, start)}`, `DTEND;TZID=${ROME_TZ}:${icsLocalTime(item.startDate, end)}`];
  const until = `UNTIL=${icsDate(item.endDate)}T225959Z`;
  if (item.weekly && item.weekly.weekdays.length > 0) {
    const byDay = item.weekly.weekdays.map((d) => ICS_DAY[d]).filter(Boolean).join(",");
    out.push(`RRULE:FREQ=WEEKLY;INTERVAL=${item.weekly.interval};BYDAY=${byDay};${until}`);
  } else if (item.daily && item.endDate > item.startDate) {
    out.push(`RRULE:FREQ=DAILY;${until}`);
  }
  const except = (item.exceptDates ?? []).filter((d) => d >= item.startDate && d <= item.endDate).sort();
  if (except.length > 0) out.push(`EXDATE;TZID=${ROME_TZ}:${except.map((d) => icsLocalTime(d, start)).join(",")}`);
  return out;
}

export function buildPlannerCalendarIcs(items: PlannerCalendarItemForIcs[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TRAMA//IT"];
  if (items.some((i) => i.startTime)) lines.push(...VTIMEZONE_ROME);

  for (const item of items) {
    // UID stabile (id del dominio, non Date.now() come in buildIcsDataUrl
    // sopra): con più eventi generati nella STESSA chiamata, Date.now()
    // potrebbe ripetersi per due eventi creati nello stesso millisecondo —
    // qui serve unicità reale, non solo "quasi sempre unico".
    const description = [item.kidNames.join(", ") || null, item.note].filter(Boolean).join(" — ") || "TRAMA";
    const location = [item.centerName, item.centerAddress, item.centerCity].filter(Boolean).join(", ");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${item.id}@buddykids.app`);
    lines.push(`DTSTAMP:${stamp}`);
    if (item.startTime) {
      lines.push(...timedEventLines(item));
    } else if (item.weekly && item.weekly.weekdays.length > 0) {
      // Tutto il giorno, ma solo nei giorni della settimana scelti.
      lines.push(`DTSTART;VALUE=DATE:${icsDate(item.startDate)}`);
      lines.push(`DTEND;VALUE=DATE:${icsDate(nextDay(item.startDate))}`);
      const byDay = item.weekly.weekdays.map((d) => ICS_DAY[d]).filter(Boolean).join(",");
      lines.push(`RRULE:FREQ=WEEKLY;INTERVAL=${item.weekly.interval};BYDAY=${byDay};UNTIL=${icsDate(item.endDate)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(item.startDate)}`);
      lines.push(`DTEND;VALUE=DATE:${icsDate(nextDay(item.endDate))}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(item.title)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function buildPlannerCalendarIcsDataUrl(items: PlannerCalendarItemForIcs[]): string {
  const ics = buildPlannerCalendarIcs(items);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

// Nome file "sensato" (§11, test 13): data odierna così due export nello
// stesso giorno sovrascrivono lo stesso download invece di accumulare
// "trama-planner(1).ics", "trama-planner(2).ics" nella cartella Download.
export function plannerCalendarIcsFilename(todayIso = new Date().toISOString().slice(0, 10)): string {
  return `trama-planner-${todayIso}.ics`;
}
