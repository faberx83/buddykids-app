// TRAMA — PAGINE RESIDUE IN V2 (20/10/2026, Fabrizio: "vai avanti" sul
// restyle delle pagine ancora col layout vecchio). [no browser] + 1 browser.
// Un impegno, Novità, Promemoria, Indirizzi, Piano condiviso, Invito in
// famiglia, Modifica prenotazione.

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { loginAs, isRealDeployment } from "../fixtures/roles";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

test.describe("TRAMA — pagine residue V2 [no browser]", () => {
  test("PV2-01 Un impegno: con v2 il modulo è un foglio dal basso, Indietro lo chiude, Salva sempre visibile", () => {
    const s = read("components/nextgen/ExternalPlannerItemsSection.tsx");
    expect(s).toContain('data-testid="impegno-sheet"');
    // 21/10/2026 (correzioni dal test UX): Indietro chiude sempre; con il flag tiene la bozza (onBack).
    expect(s).toContain("useCloseOnBack(true, onBack ?? onCancel);");
    expect(s).toContain('{saving ? "Salvataggio…" : editing ? "Salva" : "Aggiungi al Planner"}');
    // Stesso salvataggio di prima: il foglio usa lo stato e l'invio di ItemForm.
    expect(s).toContain("onSubmit={handleSubmit}");
    // Con un solo figlio è già scelto (solo V2, solo nuovo impegno).
    expect(s).toContain("v2 && !editing && initial.kidIds.length === 0 && kids.length === 1");
    // Il Planner V2 continua a passare v2.
    expect(read("app/nextgen/planner/PlannerV2Client.tsx")).toMatch(/<ExternalPlannerItemsSection[\s\S]*?\bv2\b[\s\S]*?\/>/);
  });

  test("PV2-02 Novità: niente box tratteggiati né sottolineature; voto con testo Sì/No", () => {
    const page = read("app/nextgen/novita/page.tsx");
    expect(page).not.toContain("border-dashed");
    expect(page).not.toContain("underline");
    const parts = read("components/nextgen/NovitaClientParts.tsx");
    expect(parts).not.toContain("border-dashed");
    expect(parts).toMatch(/aria-label="Sì, mi sarebbe utile"[\s\S]*?Sì\n/);
    expect(parts).toContain('className="mt-3 min-h-[48px] rounded-[12px] bg-trama-primary');
  });

  test("PV2-03 Promemoria e Indirizzi: stile V2, stessi testi usati dai test dal vivo", () => {
    const p = read("app/nextgen/planner/promemoria/PromemoriaClient.tsx");
    expect(p).toContain("Promemoria attivo");
    expect(p).toContain("aria-pressed={active}");
    expect(p).toContain("Da dove parti?");
    expect(p).toContain("Nessun indirizzo salvato.");
    expect(p).not.toContain("bg-trama-violet");
    const i = read("app/nextgen/planner/indirizzi/IndirizziClient.tsx");
    expect(i).toContain('placeholder="Via, città..."');
    expect(i).toContain('"Nome personalizzato (facoltativo)"');
    expect(i).toContain('aria-label="Apri in Maps"');
    expect(i).not.toContain("bg-trama-violet");
  });

  test("PV2-04 Piano condiviso: aspetto V2, niente emoji, chi porta e chi ritira leggibile", () => {
    const s = read("app/share/planner/[token]/page.tsx");
    expect(s).toContain("Link non disponibile");
    expect(s).not.toContain("🔒");
    expect(s).not.toContain(".emoji");
    expect(s).toContain("Chi porta e chi ritira");
    expect(s).toContain("Apri in Maps");
    expect(s).toContain("bg-trama-page");
  });

  test("PV2-05 Invito in famiglia: con il Profilo V2 la pagina d'invito V2, poi La tua famiglia", () => {
    const page = read("app/nextgen/planner/famiglia/page.tsx");
    expect(page).toContain("if (accept && (await profileV2On())) {");
    expect(page).toContain('flagName: "PROFILE_V2_ENABLED"');
    const c = read("components/nextgen/AcceptFamilyInviteV2.tsx");
    expect(c).toContain('export const FAMILY_V2_PATH = "/nextgen/profile/famiglia";');
    expect(c).toContain("router.replace(FAMILY_V2_PATH);");
    expect(c).toContain("acceptFamilyInviteAction(token)");
    expect(c).toContain("Accetta l'invito");
  });

  test("PV2-06 Modifica prenotazione: variante V2 con il flag di Richiedi un posto, testi per le famiglie", () => {
    const page = read("app/prenotazioni/[id]/modifica/page.tsx");
    expect(page).toContain('flagName: "BOOKINGS_V2_ENABLED"');
    expect(page).toContain("v2={v2}");
    const c = read("app/prenotazioni/[id]/modifica/ModificaPrenotazioneClient.tsx");
    expect(c).toContain('<PageHeader title="Modifica prenotazione" showBrandIcon={nextgen} v2={v2} />');
    expect(c).toContain('data-nav-v2={v2 ? "" : undefined}');
    // Le note "funzionalità di test" restano solo fuori dalla V2.
    expect(c).toMatch(/\{v2 \? \([\s\S]*?il centro riceve la modifica[\s\S]*?\) : \([\s\S]*?funzionalità di test/);
    // Stessi pulsanti (usati dai test dal vivo).
    expect(c).toContain('{submitting ? "Salvataggio…" : "Salva modifiche"}');
    expect(c).toContain("Annulla prenotazione");
  });
});

test.describe("TRAMA — pagine residue V2", () => {
  test("PV2-07 Un impegno dal +: si apre il foglio 'Nuovo impegno'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner?nuovo=impegno");
    await expect(page.getByRole("dialog", { name: "Nuovo impegno" })).toBeVisible();
  });
});
