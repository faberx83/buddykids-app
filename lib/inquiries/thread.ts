// TRAMA — MESSAGGI CON IL CENTRO COME CONVERSAZIONE (27/10/2026).
// activity_inquiries = la conversazione (una per famiglia e attività),
// inquiry_messages = i messaggi (migration_54). Logica pura, nessun I/O:
// testata in tests/one/inquiry-threads.spec.ts.

export const INQUIRY_THREADS_FLAG = "INQUIRY_THREADS_ENABLED";

export type InquirySide = "parent" | "center";

export interface InquiryMessage {
  id: string;
  side: InquirySide;
  body: string;
  createdAt: string;
}

export const MAX_MESSAGE_LENGTH = 4000;

/** Il testo da salvare, oppure un errore leggibile. */
export function cleanMessageBody(raw: string): { ok: true; body: string } | { ok: false; error: string } {
  const body = (raw ?? "").trim();
  if (!body) return { ok: false, error: "Scrivi un messaggio prima di inviare" };
  if (body.length > MAX_MESSAGE_LENGTH) return { ok: false, error: `Il messaggio è troppo lungo (massimo ${MAX_MESSAGE_LENGTH} caratteri)` };
  return { ok: true, body };
}

/**
 * I messaggi della conversazione. Se la tabella dei messaggi non c'è ancora
 * (migration_54 non applicata) o è vuota per questa conversazione, si
 * ricostruiscono dal ticket di prima: domanda + ultima risposta.
 */
export function threadMessages(
  header: { id: string; message: string; reply: string | null; createdAt: string; repliedAt: string | null },
  stored: InquiryMessage[] | null
): InquiryMessage[] {
  if (stored && stored.length > 0) {
    return [...stored].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }
  const out: InquiryMessage[] = [];
  if (header.message?.trim()) out.push({ id: `${header.id}:q`, side: "parent", body: header.message, createdAt: header.createdAt });
  if (header.reply?.trim()) out.push({ id: `${header.id}:r`, side: "center", body: header.reply, createdAt: header.repliedAt ?? header.createdAt });
  return out;
}

/** Stato della conversazione dopo un nuovo messaggio di `side`. */
export function headerAfterMessage(side: InquirySide, body: string, at: string) {
  return side === "parent"
    ? { status: "aperta" as const, read_by_center: false, read_by_parent: true, last_message_at: at }
    : {
        status: "risposta" as const,
        reply: body,
        replied_at: at,
        read_by_parent: false,
        read_by_center: true,
        last_message_at: at,
      };
}

/** Anteprima di una riga dell'elenco: "Tu: …" / "Centro: …". */
export function previewLine(last: InquiryMessage | null, viewer: InquirySide, max = 90): string {
  if (!last) return "";
  const who = last.side === viewer ? "Tu" : viewer === "parent" ? "Centro" : "Famiglia";
  const text = last.body.replace(/\s+/g, " ").trim();
  return `${who}: ${text.length > max ? `${text.slice(0, max - 1)}…` : text}`;
}

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** "oggi 14:05" / "ieri 09:12" / "12 ott 18:30" (ora di Roma). */
export function messageTimeLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const fmt = (x: Date) =>
    new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
  const time = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(d);
  if (fmt(d) === fmt(now)) return `oggi ${time}`;
  const yesterday = new Date(now.getTime() - 86400000);
  if (fmt(d) === fmt(yesterday)) return `ieri ${time}`;
  const day = Number(new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric" }).format(d));
  const month = Number(new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", month: "numeric" }).format(d)) - 1;
  return `${day} ${MONTHS[month]} ${time}`;
}

/** Errore "tabella che non esiste ancora" (migration non applicata). */
export function isMissingRelationError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "PGRST205" || err.code === "42P01" || /schema cache|does not exist|Could not find the table/i.test(err.message ?? "");
}
