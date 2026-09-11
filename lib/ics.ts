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
}

export function buildPlannerCalendarIcs(items: PlannerCalendarItemForIcs[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TRAMA//IT"];

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
    lines.push(`DTSTART;VALUE=DATE:${icsDate(item.startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(nextDay(item.endDate))}`);
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
