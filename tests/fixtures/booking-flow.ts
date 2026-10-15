// TRAMA — chiusura del flusso /booking/[id] dal passo "Chi partecipa?"
// (15/10/2026). Con BOOKINGS_V2_ENABLED (account di test nella coorte
// internal-preview) il flusso è una RICHIESTA al centro in 2 passi: l'ultimo
// pulsante è "Invia la richiesta al centro" e il passo Pagamento non esiste.
// Senza V2 resta "Continua" → passo Pagamento → "Conferma e paga".
// Restituisce quale flusso ha trovato, così i test possono verificare la
// conferma giusta ("Richiesta inviata" oppure "Prenotazione confermata").

import { expect, type Page } from "@playwright/test";

export type BookingFlowKind = "richiesta-v2" | "pagamento-legacy";

export async function submitBookingFromKidsStep(page: Page): Promise<BookingFlowKind> {
  const send = page.getByRole("button", { name: "Invia la richiesta al centro" });
  if (await send.isVisible().catch(() => false)) {
    await expect(page.getByText("Nessun pagamento adesso", { exact: false })).toBeVisible();
    await send.click();
    return "richiesta-v2";
  }
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByText("Scegli il metodo di pagamento")).toBeVisible();
  await page.getByRole("button", { name: "Conferma e paga" }).click();
  return "pagamento-legacy";
}
