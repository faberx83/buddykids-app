"use client";

import { useState } from "react";
import { TRAMA_BETA_VERSION } from "@/lib/beta-version";

// TRAMA — FINAL BETA CHROME CLEANUP (15/09/2026, richiesta di Fabrizio:
// "vedo contemporaneamente [...] una pill lunga ANTEPRIMA INTERNA e un
// ribbon diagonale BETA v1.1 [...] voglio UNA sola superficie compatta").
//
// Sostituisce DUE componenti precedenti:
//   - components/nextgen/NextgenBadge.tsx (ribbon diagonale "Beta · vX",
//     montato su Home/Scopri/Admin/Center/Planner/Settimana)
//   - components/InternalPreviewBadge.tsx (pill "Anteprima interna", montato
//     SOLO nel Planner quando almeno una capability della pagina risolve
//     via cohort:"internal-preview")
// in un solo chip, con due soli stati visivi (mai un secondo componente per
// "internal" — §6/§9 della richiesta).
//
// §6 "STATI DEL CHIP" — la prop `internal` arriva già calcolata dal
// chiamante tramite anyResolvedViaInternalPreview() (lib/feature-flags/
// internal-preview.ts, INVARIATO): questo componente non risolve MAI un
// flag da solo, resta puramente presentazionale — stesso principio già
// seguito da InternalPreviewBadge. "Appartenere alla coorte non basta" resta
// quindi garantito dalla stessa logica di prima, semplicemente riletta da
// un chip diverso.
//
// §7 "VISUAL DESIGN" — pill compatta (non un ribbon), ancorata in alto a
// destra con lo stesso meccanismo `absolute` + antenato .app-shell
// position:relative già usato dai due componenti precedenti (vedi
// commento in NextgenBadge.tsx per il dettaglio: "si aggancia al primo
// antenato con position:relative, che è sempre .app-shell" — FRATELLO di
// eventuali card relative+overflow-hidden come DecorativeIntroCard, MAI
// figlio, altrimenti viene tagliato, stesso bug già risolto in passato).
export function ProductStatusChip({ internal }: { internal: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute right-0 top-0 z-20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          internal
            ? `Beta ${TRAMA_BETA_VERSION}, anteprima interna — tocca per i dettagli`
            : `Beta ${TRAMA_BETA_VERSION} — tocca per i dettagli`
        }
        // §7: height 24-26px (h-[25px]), padding orizzontale 9-11px (px-2.5
        // = 10px), border-radius 999px (rounded-full), NO shadow forte, NO
        // ribbon diagonale, NO badge full-width. Colori "BETA ONLY" esatti
        // dalla richiesta: bg rgba(23,42,77,0.07), border 1px
        // rgba(23,42,77,0.12), testo #172A4D — STESSO chip anche quando
        // internal=true (mai un secondo chip, §"BETA + INTERNAL": "Mantieni
        // stesso chip").
        className="flex h-[25px] items-center gap-1 rounded-full px-2.5 text-[10.5px] font-semibold uppercase"
        style={{
          background: "rgba(23,42,77,0.07)",
          border: "1px solid rgba(23,42,77,0.12)",
          color: "#172A4D",
          letterSpacing: "0.02em",
        }}
      >
        <span>
          Beta · {TRAMA_BETA_VERSION}
          {internal && (
            <>
              {" · "}
              {/* Testo INTERNAL in violet (alternativa esplicitamente
                  ammessa al pallino violet, §"BETA + INTERNAL") — mai nero
                  pieno/rosso/warning: "INTERNAL è uno stato tecnico
                  controllato, non un errore". */}
              <span style={{ color: "#6F63C5" }}>INTERNAL</span>
            </>
          )}
        </span>
      </button>

      {open && (
        <>
          {/* Backdrop invisibile per chiudere al tap fuori — resta
              "leggero" (§8: "piccolo popover/dialog"), nessuna libreria di
              modali, nessun overlay scuro full-screen. */}
          <button
            type="button"
            aria-label="Chiudi"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
            style={{ background: "transparent" }}
          />
          <div
            role="dialog"
            aria-label={internal ? `TRAMA Beta ${TRAMA_BETA_VERSION}, anteprima interna` : `TRAMA Beta ${TRAMA_BETA_VERSION}`}
            className="absolute right-0 top-[31px] z-20 w-[240px] rounded-xl bg-white p-3.5 text-left shadow-lg"
            style={{ border: "1px solid rgba(23,42,77,0.12)" }}
          >
            <div className="mb-1 font-poppins text-[13px] font-bold text-ink">TRAMA Beta {TRAMA_BETA_VERSION}</div>
            <p className="text-[12px] leading-snug text-ink-2">Stai usando la nuova esperienza TRAMA.</p>
            {internal && (
              <p className="mt-1.5 text-[12px] leading-snug text-ink-2">
                Questa schermata include funzionalità in anteprima interna non ancora disponibili agli altri utenti.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
