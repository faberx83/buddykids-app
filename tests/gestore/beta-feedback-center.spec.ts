import { test, expect } from "@playwright/test";
import { centerAreaLabelFromPath } from "../../lib/nextgen/beta-feedback-areas";

// ESTENSIONE PARTNER del bottone "Segnala un problema" (Fabrizio: "il
// pulsante per le segnalazioni che abbiamo sul portale parents non
// possiamo metterlo... nel portale partner?") — unit test puri per la
// funzione pathname -> label usata dalla CTA quando appSource="gestore"
// (BetaFeedbackButton.tsx). Stesso principio "no browser" già usato in
// tests/one/spotlight-position.spec.ts: nessun "page" fixture, eseguibile
// anche in questo sandbox.
//
// Comando: npx playwright test tests/gestore/beta-feedback-center.spec.ts

test.describe("Segnalazioni Partner — centerAreaLabelFromPath [no browser]", () => {
  test("TC-N625 - dashboard root", () => {
    expect(centerAreaLabelFromPath("/center")).toBe("Dashboard");
  });

  test("TC-N625 - voci di menu reali mappate correttamente", () => {
    expect(centerAreaLabelFromPath("/center/profile")).toBe("Il mio centro");
    expect(centerAreaLabelFromPath("/center/activities")).toBe("Attività");
    expect(centerAreaLabelFromPath("/center/activities/new")).toBe("Attività");
    expect(centerAreaLabelFromPath("/center/promotions")).toBe("Promozioni");
    expect(centerAreaLabelFromPath("/center/servizi-consigliati")).toBe("Servizi consigliati");
    expect(centerAreaLabelFromPath("/center/attendance")).toBe("Registro presenze");
    expect(centerAreaLabelFromPath("/center/report-presenze")).toBe("Report presenze");
    expect(centerAreaLabelFromPath("/center/prenotazioni")).toBe("Prenotazioni");
    expect(centerAreaLabelFromPath("/center/group-requests")).toBe("Richieste Gruppo");
    expect(centerAreaLabelFromPath("/center/richieste")).toBe("Le mie richieste");
    expect(centerAreaLabelFromPath("/center/invites")).toBe("Inviti");
    expect(centerAreaLabelFromPath("/center/account")).toBe("Il mio account");
    expect(centerAreaLabelFromPath("/center/account/preferenze")).toBe("Il mio account");
    expect(centerAreaLabelFromPath("/center/one")).toBe("Tour guidato");
  });

  test("TC-N625 - rotta sconosciuta ricade su 'Altro' (nessun crash)", () => {
    expect(centerAreaLabelFromPath("/center/qualcosa-di-nuovo-non-mappato")).toBe("Altro");
    expect(centerAreaLabelFromPath("/")).toBe("Altro");
  });
});
