import { test, expect } from "../fixtures/roles";

// Feedback di Fabrizio: "si vede ancora lo sfondo colorato in apertura della
// PWA... dovrebbe essere bianco, aggiungi anche nome TRAMA e claim con
// font/dimensioni/proporzioni giuste". Android/Chrome non supporta uno
// splash screen nativo personalizzato (solo icona + manifest#background_color,
// mai testo) — vedi components/AppSplashOverlay.tsx, montato in
// app/layout.tsx (root, copre sia LEGACY che NEXTGEN). E' puramente
// decorativo e pointer-events-none fin dall'inizio: non deve mai bloccare un
// tap reale, quindi non serve toccare nessun altro test della suite per via
// del suo timer di dissolvenza.
test.describe("App - Splash overlay al primo caricamento", () => {
  test("TC-296 - Lo splash overlay (logo+nome+claim) sparisce da solo entro pochi secondi", async ({ page }) => {
    await page.goto("/auth/login");
    // Non asseriamo sulla visibilita' iniziale (dipende da quanto e' lenta la
    // macchina di test rispetto al timer di ~1.25s) - verifichiamo solo che
    // sparisca da solo, in modo deterministico indipendentemente dalla
    // velocita' di esecuzione.
    await expect(page.getByTestId("app-splash-overlay")).toHaveCount(0, { timeout: 5_000 });
  });
});
