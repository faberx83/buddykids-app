// TRAMA — impaginazione dei testi legali (16/10/2026). Un sottoinsieme minimo
// di Markdown, senza librerie: "# " titolo, "## " sezione, "- " elenco,
// tabelle "| a | b |", **grassetto**, paragrafi. Il testo arriva solo da
// lib/legal/texts.ts (nostro, versionato): nessun HTML dall'esterno.

import { Fragment } from "react";
import { parseLegalText } from "@/lib/legal/parse";

function inline(text: string) {
  const parts = text.split("**");
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="font-semibold text-ink">{p}</strong> : <Fragment key={i}>{p}</Fragment>));
}

export default function LegalDocumentView({ source }: { source: string }) {
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink-2">
      {parseLegalText(source).map((b, i) => {
        if (b.kind === "h1") return <h1 key={i} className="font-poppins text-[26px] font-semibold leading-tight text-ink">{b.text}</h1>;
        if (b.kind === "h2") return <h2 key={i} className="mt-4 font-poppins text-[18px] font-semibold text-ink">{b.text}</h2>;
        if (b.kind === "ul")
          return (
            <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5">
              {b.items.map((it, j) => (
                <li key={j}>{inline(it)}</li>
              ))}
            </ul>
          );
        if (b.kind === "table")
          return (
            <div key={i} className="overflow-hidden rounded-2xl border border-trama-line bg-white">
              {b.rows.map((r, j) => (
                <div key={j} className={`grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-2 ${j === 0 ? "bg-[#F6F4EF] font-semibold text-ink" : "border-t border-[#F0F2F5]"}`}>
                  {r.map((c, k) => (
                    <span key={k} className={j > 0 && k === 1 ? "text-[13.5px] text-ink-3" : ""}>
                      {inline(c)}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          );
        return <p key={i}>{inline(b.text)}</p>;
      })}
    </div>
  );
}
