// TRAMA — POLISH V2 (14/10/2026). Immagine di un'attività nelle card V2:
// la foto vera se c'è; altrimenti una superficie calda con il monogramma (o
// un'icona) e un filo di uno dei quattro colori TRAMA, al posto della grande
// emoji usata finora come immagine. Il colore del filo dipende dal titolo, così
// la stessa attività ha sempre lo stesso colore.

import type { ReactNode } from "react";

const THREAD = ["#F66B5E", "#F6A623", "#2DBA8C", "#6F63C5"];

export function threadColorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return THREAD[h % THREAD.length];
}

export function monogramFor(title: string): string {
  const words = title
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^\p{Lu}/u.test(w));
  const letters = (words.length >= 2 ? [words[0], words[1]] : [words[0] ?? title]).map((w) => (w ?? "").charAt(0));
  return letters.join("").toUpperCase() || "T";
}

export default function ActivityVisual({
  title,
  imageUrl,
  icon,
  className = "",
  children,
}: {
  title: string;
  imageUrl?: string | null;
  /** Icona Tabler al posto del monogramma (es. categoria di una Scoperta). */
  icon?: string;
  className?: string;
  children?: ReactNode;
}) {
  if (imageUrl) {
    return (
      <span className={`relative block bg-[#EFEDE7] bg-cover bg-center ${className}`} style={{ backgroundImage: `url(${imageUrl})` }}>
        {children}
      </span>
    );
  }
  const color = threadColorFor(title);
  return (
    <span className={`relative flex items-center justify-center overflow-hidden bg-[#F4F1EA] ${className}`}>
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      {icon ? (
        <i className={`ti ${icon} text-[34px] text-trama-navy/70`} aria-hidden="true" />
      ) : (
        <span aria-hidden="true" className="font-poppins text-[30px] font-semibold tracking-wide text-trama-navy/70">
          {monogramFor(title)}
        </span>
      )}
      {children}
    </span>
  );
}
