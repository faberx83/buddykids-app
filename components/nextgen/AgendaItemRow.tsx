// TRAMA — HOME V2 (Fase 1, 13/10/2026). Riga di un impegno: ora, figlio,
// attività, luogo e provenienza discreta. Componente CONDIVISO: oggi in
// "Oggi" della Home V2, in Fase 2 nella vista Settimana del Planner V2
// (stesso dato → stesso linguaggio grafico, baseline V2.1).
//
// Provenienza (TRAMA / Scoperta TRAMA / Aggiunto da te) sempre come ultima
// parola della riga grigia: nessuna gerarchia visiva tra le tre.

import Link from "next/link";
import { AGENDA_SOURCE_LABEL, type AgendaEntry } from "@/lib/nextgen/today-agenda";

// Tinte dei figli (iniziale + sfondo), nell'ordine dei figli della famiglia.
// Il colore non è mai l'unico segnale: c'è sempre l'iniziale.
export const KID_TONES: readonly { bg: string; text: string }[] = [
  { bg: "bg-[#ECE8F8]", text: "text-[#4A3F9E]" },
  { bg: "bg-[#FFF1DA]", text: "text-[#8A4B00]" },
  { bg: "bg-[#E1F4EC]", text: "text-[#146B4F]" },
  { bg: "bg-[#E3ECF8]", text: "text-[#24497A]" },
];

export function kidToneFor(kidId: string, orderedKidIds: string[]): { bg: string; text: string } {
  const i = orderedKidIds.indexOf(kidId);
  return KID_TONES[(i < 0 ? 0 : i) % KID_TONES.length];
}

export function KidAvatar({
  name,
  tone,
  size = 30,
  ring = false,
}: {
  name: string;
  tone: { bg: string; text: string };
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.43) }}
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold ${tone.bg} ${tone.text} ${
        ring ? "ring-2 ring-white" : ""
      }`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export default function AgendaItemRow({
  entry,
  orderedKidIds,
  href,
  divider = true,
}: {
  entry: AgendaEntry;
  orderedKidIds: string[];
  href?: string;
  divider?: boolean;
}) {
  const kidNames = entry.kids.map((k) => k.name).filter(Boolean);
  // 21/10/2026 — settimana tipo: l'orario della scuola è una riga discreta
  // ("Scuola · Lino · 8:30–16:30"), non una card come le attività.
  if (entry.school) {
    return (
      <div className={`flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink-2 ${divider ? "border-b border-[#F0F2F5]" : ""}`} data-testid="agenda-school-row">
        <i className="ti ti-school text-[16px] text-ink-3" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold text-ink">{entry.title}</span>
          {kidNames.length > 0 ? ` · ${kidNames.join(" e ")}` : ""}
        </span>
        {entry.startTime && (
          <span className="flex-shrink-0 tabular-nums">
            {entry.startTime}
            {entry.endTime ? `–${entry.endTime}` : ""}
          </span>
        )}
      </div>
    );
  }
  const subtitle = [kidNames.join(" e "), entry.place, AGENDA_SOURCE_LABEL[entry.source]].filter(Boolean).join(" · ");
  const firstKids = entry.kids.slice(0, 2);

  const body = (
    <>
      <div className="flex w-[46px] flex-shrink-0 flex-col gap-px pt-px">
        {entry.startTime ? (
          <>
            <span className="text-[14px] font-bold text-trama-navy">{entry.startTime}</span>
            {entry.endTime && <span className="text-[12px] text-ink-2">{entry.endTime}</span>}
          </>
        ) : (
          <span className="text-[12px] font-semibold leading-tight text-ink-2">In giornata</span>
        )}
      </div>
      <div className="flex flex-shrink-0">
        {firstKids.length === 0 ? (
          <KidAvatar name="·" tone={KID_TONES[0]} />
        ) : (
          firstKids.map((k, i) => (
            <span key={k.id} className={i > 0 ? "-ml-3" : ""}>
              <KidAvatar name={k.name} tone={kidToneFor(k.id, orderedKidIds)} ring={i > 0} />
            </span>
          ))
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold leading-snug text-ink">{entry.title}</span>
        {subtitle && <span className="text-[12.5px] leading-snug text-ink-2">{subtitle}</span>}
        {entry.status && (
          <span className="mt-1 self-start rounded-full bg-[#FFF4E0] px-2 py-0.5 text-[11.5px] font-semibold text-[#7A4500]">
            {entry.status}
          </span>
        )}
      </div>
    </>
  );

  const className = `flex gap-3 px-4 py-3.5 ${divider ? "border-b border-[#F0F2F5]" : ""}`;
  return href ? (
    <Link href={href} className={`${className} active:bg-black/[0.03]`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
