// TRAMA — AVVISO SOVRAPPOSIZIONI NEL PLANNER (12/11/2026). Retest Parent
// richiesto da Fabrizio: "nel Planner due attività confermate dello stesso
// bambino e con orari sovrapposti devono generare un avviso prima
// dell'assegnazione dei passaggi. Non bloccare automaticamente il flusso
// senza una regola di prodotto esplicita." Iniziativa:
// claude/INIZIATIVA_admin_operativo.md (Lotto 1, punto 3).
//
// Verificato sul codice (12/11): il Planner segnalava solo sovrapposizioni
// di SETTIMANA tra prenotazioni TRAMA (lib/nextgen/planner-insights.ts
// computeKidOverlaps: stesso bambino, stessa settimana, due prenotazioni),
// mai orari sovrapposti nello stesso giorno, e mai tra un impegno scritto a
// mano e una prenotazione. Il foglio "Chi accompagna" li metteva in fila
// senza dire niente.
//
// Regola: nello stesso giorno, per lo stesso bambino, due voci dell'agenda
// confermate (prenotazioni accettate, anche "in parte", e impegni del
// Planner), esclusa la scuola, con orari che si toccano per almeno un
// minuto. Voci senza orario o "tutto il giorno" non contano (non si sa).
// Una voce con solo l'inizio vale come istante. Solo avviso: nessun blocco.
// Pura, senza I/O (test: tests/one/admin-operativo.spec.ts).

import type { AgendaEntry } from "@/lib/nextgen/today-agenda";

export interface KidTimeOverlap {
  kidId: string;
  kidName: string;
  a: { id: string; title: string; start: string; end: string | null };
  b: { id: string; title: string; start: string; end: string | null };
  /** "16:30–17:00" */
  window: string;
}

const CONFIRMED_STATUSES = new Set<string | null>([null, "Confermata in parte"]);

function minutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

export function isConfirmedTimed(e: AgendaEntry): boolean {
  return !e.school && CONFIRMED_STATUSES.has(e.status) && minutes(e.startTime) !== null;
}

/** Sovrapposizioni di orario per bambino in una giornata (ogni coppia una volta). */
export function kidTimeOverlaps(entries: AgendaEntry[]): KidTimeOverlap[] {
  const out: KidTimeOverlap[] = [];
  const timed = entries.filter(isConfirmedTimed);
  const kidIds = [...new Set(timed.flatMap((e) => e.kids.map((k) => k.id)))];
  for (const kidId of kidIds) {
    const mine = timed.filter((e) => e.kids.some((k) => k.id === kidId));
    for (let i = 0; i < mine.length; i++) {
      for (let j = i + 1; j < mine.length; j++) {
        const x = mine[i];
        const y = mine[j];
        const xs = minutes(x.startTime) as number;
        const ys = minutes(y.startTime) as number;
        const xe = Math.max(minutes(x.endTime) ?? xs, xs);
        const ye = Math.max(minutes(y.endTime) ?? ys, ys);
        const from = Math.max(xs, ys);
        const to = Math.min(xe, ye);
        // Due intervalli: almeno un minuto in comune (16:00–17:00 e
        // 17:00–18:00 non si toccano). Un istante (solo l'inizio): dentro
        // l'altro intervallo [inizio, fine), o stesso istante.
        const xPoint = xe === xs;
        const yPoint = ye === ys;
        const overlaps =
          !xPoint && !yPoint ? to > from : xPoint && yPoint ? xs === ys : xPoint ? xs >= ys && xs < ye : ys >= xs && ys < xe;
        if (overlaps) {
          const kidName = x.kids.find((k) => k.id === kidId)?.name ?? "";
          out.push({
            kidId,
            kidName,
            a: { id: x.id, title: x.title, start: x.startTime as string, end: x.endTime },
            b: { id: y.id, title: y.title, start: y.startTime as string, end: y.endTime },
            window: to > from ? `${hhmm(from)}–${hhmm(to)}` : hhmm(from),
          });
        }
      }
    }
  }
  return out;
}

/** Frase dell'avviso: "Lino ha due impegni negli stessi orari (16:30–17:00): Ritmica e Piscina." */
export function overlapSentence(o: KidTimeOverlap): string {
  const who = o.kidName || "Un bambino";
  return `${who} ha due impegni negli stessi orari (${o.window}): ${o.a.title} e ${o.b.title}. Controllate prima di decidere chi accompagna.`;
}

export const PLANNER_OVERLAP_WARNING_FLAG = "PLANNER_OVERLAP_WARNING_ENABLED";
