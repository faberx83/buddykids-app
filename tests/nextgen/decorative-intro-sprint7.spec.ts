import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// SPRINT 7 (NEXTGEN) — Segnalazione di Fabrizio: "gli elementi decorativi
// della Home dovrebbero essere coerenti su tutte le pagine NEXTGEN" (i due
// cerchi bg-trama-violet/10 e bg-trama-lilac/20 dietro la hero card di
// Home). Estratti in components/nextgen/DecorativeIntroCard.tsx e riusati
// nell'intro di Community/Profilo (contenuto ricco: titolo con logo brand
// / form ProfileHeaderClient) — un solo test per pagina, verifica solo la
// presenza dei due cerchi aria-hidden (non lo stile pixel-perfect, che
// resta una responsabilità di revisione visiva manuale).
test.describe("NEXTGEN Sprint 7 - Coerenza elementi decorativi (DecorativeIntroCard)", () => {
  const decorativeCardPages: { path: string; label: string }[] = [
    { path: "/nextgen/community", label: "Community" },
    { path: "/nextgen/profile", label: "Profilo" },
  ];

  for (const { path, label } of decorativeCardPages) {
    test(`TC-N299 - ${label} mostra la stessa texture decorativa della Home`, async ({ page }) => {
      test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
      await loginAs(page, "parent");
      await page.goto(path);

      // I due cerchi decorativi sono aria-hidden (puramente estetici):
      // basta verificarne la presenza nel DOM (substring-match sull'attributo
      // class, dentro un selettore [class*="..."] — qui il valore è
      // racchiuso tra virgolette, quindi il carattere "/" NON va escapato
      // come dovrebbe esserlo in un selettore di classe ".foo\/bar"), non
      // serve che siano visibili (potrebbero essere parzialmente fuori
      // viewport su schermi piccoli).
      await expect(page.locator('div[aria-hidden][class*="bg-trama-violet/10"]').first()).toBeAttached();
      await expect(page.locator('div[aria-hidden][class*="bg-trama-lilac/20"]').first()).toBeAttached();
    });
  }
});

// RESTYLE INTRO HEADER — "PILL COMPATTA" (Opzione B, scelta da Fabrizio su 3
// mockup: Attuale / Opzione A lineare / Opzione B pill, segnalazione: il
// testo introduttivo "Ordinati per voi." su Scopri era "scarno" — font
// sottile, grigio — e occupava troppo spazio verticale nella card grande
// con i due cerchi decorativi). Scopri e Planner (descrizione one-liner di
// modalità) non usano più DecorativeIntroCard: il testo introduttivo breve
// è ora un badge pill inline (icona Tabler + testo corto, bg-trama-violet/10,
// rounded-full) — nessun cerchio decorativo, nessuna card grande.
test.describe("NEXTGEN Sprint 7 - Restyle pill compatta (Scopri/Planner)", () => {
  const pillPages: { path: string; label: string }[] = [
    { path: "/nextgen/search", label: "Scopri" },
    { path: "/nextgen/planner", label: "Planner" },
  ];

  for (const { path, label } of pillPages) {
    test(`TC-N299b - ${label} mostra la pill compatta invece della card decorativa`, async ({ page }) => {
      test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
      await loginAs(page, "parent");
      await page.goto(path);

      // La pill: badge piccolo, arrotondato, sfondo tint viola tenue.
      await expect(page.locator('div[class*="rounded-full"][class*="bg-trama-violet/10"]').first()).toBeAttached();

      // Niente più i due cerchi decorativi aria-hidden della DecorativeIntroCard
      // grande in questa sezione (restano solo su Community/Profilo, vedi sopra).
      await expect(page.locator('div[aria-hidden][class*="bg-trama-lilac/20"]')).toHaveCount(0);
    });
  }
});
