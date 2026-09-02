import { readFileSync } from "fs";
import path from "path";
import { test as pureTest, expect as pureExpect } from "@playwright/test";
import { floatingControlClassName } from "@/lib/nextgen/floating-controls";

// TRAMA BETA v1.1.1 — FINAL FUNCTIONAL + UI CONSISTENCY FIXES (punto 16).
// Copre UI-FINAL-01..03. UI-FINAL-02 usa la funzione pura di
// lib/nextgen/floating-controls.ts (nessun import Next.js/React/Supabase).
// UI-FINAL-01/03 verificano il markup sorgente (stesso pattern già in uso in
// questo repo per test di regressione statica, vedi tests/one/onboarding.spec.ts
// e tests/one/push-notifications.spec.ts) invece che via browser reale: non
// serve un deploy per accertarsi che uno specifico className/testo non sia
// stato rimosso per errore in una modifica futura.

const ROOT = path.resolve(__dirname, "..", "..");

function readSource(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), "utf-8");
}

pureTest.describe("TRAMA BETA v1.1.1 — UI-FINAL-01..03 (punto 6-7)", () => {
  pureTest("UI-FINAL-01 - intestazioni ANDATA/RITORNO restano testo esplicito, leggibili (non solo colore/freccia)", () => {
    const src = readSource("components/nextgen/PlannerCalendarView.tsx");
    // Le etichette sono parole intere, mai solo icone/frecce (punto 6:
    // "senza comunicare Andata/Ritorno solo tramite frecce").
    pureExpect(src).toContain(">\n                              Andata\n");
    pureExpect(src).toContain(">\n                              Ritorno\n");
    // Contrasto/peso/dimensione aumentati rispetto a prima (9px/text-ink-3):
    // ora 10.5px, font-extrabold, text-ink-2 (più scuro di text-ink-3).
    const headerBlock = src.slice(src.indexOf("w-[54px] flex-shrink-0\" aria-hidden"), src.indexOf("w-[54px] flex-shrink-0\" aria-hidden") + 900);
    pureExpect(headerBlock).toContain("text-[10.5px] font-extrabold");
    pureExpect(headerBlock).toContain("text-ink-2");
    pureExpect(headerBlock).not.toContain("text-[9px]");
  });

  pureTest("UI-FINAL-02 - i controlli flottanti (bell/chat) lasciano passare il tap durante lo scroll attivo, non a riposo", () => {
    // A riposo: piena interattività/opacità (nessuna riga bloccata quando il
    // contenuto è fermo).
    pureExpect(floatingControlClassName(false)).toContain("pointer-events-auto");
    pureExpect(floatingControlClassName(false)).toContain("opacity-100");
    // Durante lo scroll: pointer-events-none, cosi un tap che finisce sopra
    // il bottone raggiunge invece la riga sottostante (punto 7 — "durante
    // scroll/interazione", non solo l'ultima riga in fondo).
    pureExpect(floatingControlClassName(true)).toContain("pointer-events-none");
    pureExpect(floatingControlClassName(true)).not.toContain("pointer-events-auto");

    // Wiring: entrambi i bottoni consumano davvero l'hook condiviso (non
    // solo la funzione pura isolata) — verificato sul sorgente, stesso
    // principio di UI-FINAL-01.
    const feedbackSrc = readSource("components/nextgen/BetaFeedbackButton.tsx");
    pureExpect(feedbackSrc).toContain("useNextgenIsScrolling");
    pureExpect(feedbackSrc).toContain("floatingControlClassName(");
    const bellSrc = readSource("components/nextgen/NotificationCenter.tsx");
    pureExpect(bellSrc).toContain("useNextgenIsScrolling");
    pureExpect(bellSrc).toContain("floatingControlClassName(");
    // Il layout condiviso (ogni pagina genitore NEXTGEN, non un fix
    // per-schermata) monta il Provider e il contenitore scrollabile che lo
    // alimenta.
    const layoutSrc = readSource("app/nextgen/layout.tsx");
    pureExpect(layoutSrc).toContain("NextgenScrollActivityProvider");
    pureExpect(layoutSrc).toContain("NextgenScrollArea");
  });

  pureTest("UI-FINAL-03 - Condividi resta un'azione terziaria, non compete con le azioni operative (invariato dal FINAL VISUAL CONFORMANCE PASS)", () => {
    const src = readSource("components/nextgen/PlannerCalendarView.tsx");
    // Stesso trattamento terziario (solo testo+icona, nessuna pillola di
    // sfondo pieno) già stabilito e testato in VIS111-06 — qui solo una
    // verifica di non-regressione: il pulsante Condividi della settimana non
    // usa uno sfondo pieno colorato come le CTA primarie/bulk.
    const condividiIdx = src.indexOf("<i className=\"ti ti-share text-[12px]\" />\n                  Condividi\n                </button>");
    pureExpect(condividiIdx).toBeGreaterThan(-1);
    const condividiBlock = src.slice(Math.max(0, condividiIdx - 400), condividiIdx);
    pureExpect(condividiBlock).toContain("text-trama-violet");
    pureExpect(condividiBlock).not.toContain("bg-trama-violet");
  });
});
