import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

// TRAMA — FINAL BETA CHROME CLEANUP + BACK NAVIGATION PROGRESS FIX +
// ADMIN-CONTROLLED CLASSIC FALLBACK (15/09/2026) — PART E, 20 scenari
// nominati richiesti dalla spec (10 badge/status, 6 classic fallback, 4
// progress back). Stesso stile "[no browser]" già in uso nel repo: fs +
// asserzioni sul sorgente statico, nessun browser lanciato (governance:
// Claude non esegue mai test Playwright live). Copre ciò che i test già
// esistenti (release-catalog.spec.ts, global-action-progress-dark-
// release.spec.ts) non coprono ancora nel dettaglio — non li duplica.

const root = path.join(__dirname, "../..");
function read(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), "utf-8");
}

// ─────────────────────────────────────────────────────────────────────────
// 10 scenari — PRODUCT STATUS CHIP / BADGE / STATO BETA [no browser]
// ─────────────────────────────────────────────────────────────────────────
test.describe("TRAMA FINAL CLEANUP — ProductStatusChip: 10 scenari badge/status [no browser]", () => {
  const chip = () => read("components/ProductStatusChip.tsx");

  test("CHIP-01: nessun ribbon diagonale — nessuna rotate-45/transform residua nel chip", () => {
    const src = chip();
    expect(src).not.toMatch(/rotate-45|rotate\[45deg\]/);
  });

  test("CHIP-02: posizione top-right ancorata (absolute right-0 top-0), mai fixed/sticky", () => {
    const src = chip();
    expect(src).toContain('className="absolute right-0 top-0 z-20"');
    expect(src).not.toContain("fixed right-0");
  });

  test("CHIP-03: dimensioni conformi alla spec (altezza 24-26px, padding orizzontale 9-11px, rounded-full)", () => {
    const src = chip();
    expect(src).toContain("h-[25px]");
    expect(src).toContain("px-2.5"); // 10px, dentro il range 9-11px richiesto
    expect(src).toContain("rounded-full");
  });

  test("CHIP-04: nessuna ombra forte — nessuna classe shadow-* sul bottone del chip (solo il popover usa shadow-lg)", () => {
    const src = chip();
    const buttonBlock = src.slice(src.indexOf("<button"), src.indexOf("</button>"));
    expect(buttonBlock).not.toMatch(/shadow-(md|lg|xl|2xl)/);
  });

  test("CHIP-05: colori BETA-only esatti dalla richiesta (bg rgba(23,42,77,0.07), border rgba(23,42,77,0.12), testo #172A4D)", () => {
    const src = chip();
    expect(src).toContain("rgba(23,42,77,0.07)");
    expect(src).toContain("rgba(23,42,77,0.12)");
    expect(src).toContain("#172A4D");
  });

  test("CHIP-06: stato BETA-only (internal=false) non renderizza mai la parola INTERNAL", () => {
    const src = chip();
    // Il testo "INTERNAL" nel corpo del chip compare SOLO dentro il ramo
    // `{internal && (...)}` — la sola altra occorrenza ammessa nel file è
    // l'aria-label del ramo "internal" (stringa distinta, non renderizzata
    // quando internal=false).
    expect(src).toContain("{internal && (");
    const internalJsxBranchStart = src.indexOf("{internal && (");
    const internalJsxBranchEnd = src.indexOf(")}", internalJsxBranchStart);
    const internalJsxBranch = src.slice(internalJsxBranchStart, internalJsxBranchEnd);
    expect(internalJsxBranch).toContain("INTERNAL");
    // Il ramo non-internal dell'aria-label non contiene la parola INTERNAL.
    expect(src).toContain("`Beta ${TRAMA_BETA_VERSION} — tocca per i dettagli`");
  });

  test("CHIP-07: stato BETA+INTERNAL usa colore violetto dedicato, mai nero pieno/rosso/warning", () => {
    const src = chip();
    expect(src).toContain('style={{ color: "#6F63C5" }}');
    expect(src).not.toMatch(/color:\s*["']#?(FF0000|red|f00)/i);
  });

  test("CHIP-08: popover si apre/chiude con stato locale (useState), nessuna libreria modale esterna", () => {
    const src = chip();
    expect(src).toContain('import { useState } from "react"');
    expect(src).toContain("const [open, setOpen] = useState(false)");
    expect(src).not.toMatch(/import.*(radix|headlessui|dialog)/i);
  });

  test("CHIP-09: nessun vecchio call site residuo — grep su tutto app/ conferma zero <NextgenBadge o <InternalPreviewBadge reali (solo commenti storici)", () => {
    const appDir = path.join(root, "app");
    function walk(dir: string): string[] {
      let out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out = out.concat(walk(full));
        else if (entry.name.endsWith(".tsx")) out.push(full);
      }
      return out;
    }
    for (const file of walk(appDir)) {
      // Righe di commento (che possono legittimamente menzionare i vecchi
      // nomi a scopo storico/esplicativo, vedi app/nextgen/planner/page.tsx)
      // sono escluse dal controllo — cerchiamo solo un USO reale come tag JSX.
      const codeLines = fs
        .readFileSync(file, "utf-8")
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      expect(codeLines).not.toMatch(/<NextgenBadge\s*\/?>/);
      expect(codeLines).not.toMatch(/<InternalPreviewBadge\b/);
    }
  });

  test("CHIP-10: i due componenti sostituiti sono stati effettivamente rimossi dal filesystem", () => {
    expect(fs.existsSync(path.join(root, "components/nextgen/NextgenBadge.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(root, "components/InternalPreviewBadge.tsx"))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 6 scenari — CLASSIC FALLBACK ADMIN-CONTROLLED [no browser]
// ─────────────────────────────────────────────────────────────────────────
test.describe("TRAMA FINAL CLEANUP — Classic Fallback: 6 scenari [no browser]", () => {
  test("FALLBACK-01: il flag NEXTGEN_CLASSIC_FALLBACK_ENABLED è registrato con defaultValue=false", () => {
    const src = read("lib/feature-flags/registry.ts");
    const block = src.slice(src.indexOf("NEXTGEN_CLASSIC_FALLBACK_ENABLED:"), src.indexOf("NEXTGEN_CLASSIC_FALLBACK_ENABLED:") + 900);
    expect(block).toContain("defaultValue: false");
    expect(block).toContain('allowedScopes: ["global", "environment", "user", "role", "cohort"]');
  });

  test("FALLBACK-02: la riga in Profilo è condizionata ESCLUSIVAMENTE dalla prop classicFallbackEnabled (mai visibile per omissione)", () => {
    const src = read("app/nextgen/profile/ProfileNextgenClient.tsx");
    expect(src).toContain("{classicFallbackEnabled && (");
    expect(src).toContain("classicFallbackEnabled: boolean");
  });

  test("FALLBACK-03: NON è un bottone primario pieno — nessuna classe bg-ink/bg-primary/bg-trama-* sul bottone della riga (resta bg-white come le altre HubCard)", () => {
    const src = read("app/nextgen/profile/ProfileNextgenClient.tsx");
    const rowStart = src.indexOf("switchToClassicVersion}");
    const rowBlock = src.slice(rowStart, rowStart + 500);
    expect(rowBlock).toContain("bg-white");
    expect(rowBlock).not.toMatch(/bg-ink\b|bg-trama-orange|bg-trama-violet\b/);
  });

  test("FALLBACK-04: copy corretta — mai 'Torna a V1' (ambiguo con BETA v1.1), usa 'Torna alla versione classica'", () => {
    const src = read("app/nextgen/profile/ProfileNextgenClient.tsx");
    expect(src).toContain("Torna alla versione classica");
    expect(src).not.toContain("Torna a V1");
    expect(src).toContain("Usa temporaneamente la precedente esperienza TRAMA.");
  });

  test("FALLBACK-05: riusa il meccanismo ESISTENTE (writeVersionPreference + router.push), nessuna logica di routing duplicata", () => {
    const src = read("app/nextgen/profile/ProfileNextgenClient.tsx");
    expect(src).toContain('import { writeVersionPreference } from "@/lib/version-preference"');
    expect(src).toContain('writeVersionPreference("legacy")');
    expect(src).toContain('router.push("/")');
    // Stessa import/funzione usata da VersionToggle.tsx — non una copia locale.
    const versionToggleSrc = read("components/VersionToggle.tsx");
    expect(versionToggleSrc).toContain('import { readVersionPreference, writeVersionPreference, AppVersion } from "@/lib/version-preference"');
  });

  test("FALLBACK-06: la feature è collegata alla release 'TRAMA — UX Foundations', non a 'Planner Intelligence', ed è release-eligible", () => {
    const catalogSrc = read("lib/feature-registry/catalog.ts");
    expect(catalogSrc).toContain('key: "nextgen_classic_fallback"');
    const entryBlock = catalogSrc.slice(catalogSrc.indexOf('key: "nextgen_classic_fallback"'), catalogSrc.indexOf('key: "nextgen_classic_fallback"') + 2200);
    expect(entryBlock).toContain("releaseEligible: true");
    expect(entryBlock).toContain('flagName: "NEXTGEN_CLASSIC_FALLBACK_ENABLED"');

    const releaseSrc = read("lib/releases/catalog.ts");
    const uxBlock = releaseSrc.slice(releaseSrc.indexOf('id: "ux-foundations"'), releaseSrc.indexOf('id: "ux-foundations"') + 1500);
    expect(uxBlock).toContain("nextgen_classic_fallback");
    const plannerBlock = releaseSrc.slice(releaseSrc.indexOf('id: "planner-intelligence"'), releaseSrc.indexOf('id: "planner-intelligence"') + 1000);
    expect(plannerBlock).not.toContain("nextgen_classic_fallback");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4 scenari — BACK NAVIGATION PROGRESS FIX [no browser]
// ─────────────────────────────────────────────────────────────────────────
test.describe("TRAMA FINAL CLEANUP — Back Navigation Progress: 4 scenari [no browser]", () => {
  test("BACKPROG-01: ProfileNextgenClient usa backHref (istrumentato da PageHeader), non più onBack con router.push statico", () => {
    const src = read("app/nextgen/profile/ProfileNextgenClient.tsx");
    expect(src).toContain('<PageHeader title="Profilo" backHref="/nextgen" showBrandIcon />');
    expect(src).not.toMatch(/onBack=\{?\(\)\s*=>\s*router\.push\("\/nextgen"\)/);
  });

  test("BACKPROG-02: PageHeader chiama runNavigation() SOLO nel ramo backHref/router.back(), mai quando è passato onBack (asimmetria root-cause, invariata e riverificata)", () => {
    const src = read("components/PageHeader.tsx");
    const onClickStart = src.indexOf("onClick={() => {");
    const onClickEnd = src.indexOf("}}", src.indexOf("aria-label=\"Indietro\""));
    const block = src.slice(onClickStart, onClickEnd);
    // Il ramo onBack ha un return anticipato PRIMA di runNavigation(): la
    // stessa closure non può eseguire entrambi nella stessa chiamata.
    expect(block).toContain("if (onBack) {");
    expect(block).toContain("onBack();\n            return;");
    expect(block).toContain("runNavigation();");
    expect(block).toContain("if (backHref) router.push(backHref);");
    expect(block).toContain("else router.back();");
    // L'ordine testuale conferma che il return del ramo onBack precede
    // testualmente (quindi nel flusso di esecuzione) la chiamata a
    // runNavigation() più sotto nella stessa funzione.
    expect(block.indexOf("return;")).toBeLessThan(block.indexOf("runNavigation();"));
  });

  test("BACKPROG-03: ModificaPrenotazioneClient non passa più onBack={() => router.back()} — nessuna delle due occorrenze storiche resta", () => {
    const src = read("app/prenotazioni/[id]/modifica/ModificaPrenotazioneClient.tsx");
    expect(src).not.toMatch(/onBack=\{?\(\)\s*=>\s*router\.back\(\)/);
  });

  test("BACKPROG-04: BookingClient.tsx resta deliberatamente NON istrumentato — onBack={handleBack} (mix locale/reale) invariato, per costruzione (§ 'PURE LOCAL UI -> no progress')", () => {
    const src = read("app/booking/[id]/BookingClient.tsx");
    expect(src).toContain("onBack={handleBack}");
    // handleBack deve ancora contenere sia un ramo locale (setStep) sia uno
    // di navigazione reale (router.back()) — se questa asserzione fallisse,
    // il file sarebbe stato toccato e andrebbe rivalutato, non silenziosamente
    // lasciato disallineato dal commento sopra.
    const handleBackStart = src.indexOf("function handleBack");
    const handleBackBlock = src.slice(handleBackStart, handleBackStart + 300);
    expect(handleBackBlock).toContain("setStep");
    expect(handleBackBlock).toContain("router.back()");
  });
});
