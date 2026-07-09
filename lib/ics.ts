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

function escapeIcsText(text: string): string {
  return text.replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
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
    "PRODID:-//BuddyKids//IT",
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
