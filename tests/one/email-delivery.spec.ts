import { createClient } from "@supabase/supabase-js";
import { expect, isRealDeployment, loginAs, test } from "../fixtures/roles";

// TRAMA ONE Build Sprint 6 (backlog vincolante P2, "email fire-and-forget",
// SPRINT_GOVERNANCE.md riga 151, DEC-49) — prima di questo sprint
// notifyParentOfBookingResponse (app/actions/booking-response.ts) chiamava
// sendEmail dentro un try/catch silenzioso: nessun log, nessuno stato
// persistito. Ora: retry minimo (un secondo tentativo automatico, vedi
// lib/email.ts), logging esplicito su fallimento, e stato di consegna
// persistito su bookings.email_delivery_status/_error/_attempted_at
// (migration_19_bookings_email_delivery_status.sql, non ancora applicata).
//
// Nota sul perimetro del test (stesso principio di tests/one/capacity.spec.ts):
// non esiste alcuna UI che mostri lo stato di consegna email al genitore (è
// un dettaglio infrastrutturale, non un'informazione utile da mostrare in
// chiaro) — la verifica quindi usa il flusso REALE (loginAs + click per
// accettare la prenotazione, che dentro respondToBookingAction chiama
// notifyParentOfBookingResponse) e legge l'ESITO via client Supabase
// service_role (sola lettura per l'asserzione, stesso principio già
// stabilito in tests/cleanup-test-data.mjs e tests/one/capacity.spec.ts).
//
// Il test NON assume che RESEND_API_KEY sia configurata nell'ambiente di
// test (probabilmente non lo è — vedi lib/email.ts, isEmailConfigured):
// l'invariante verificata è che email_delivery_status venga sempre
// popolato con un valore noto ("sent" | "not_configured" | "failed" |
// "no_recipient"), MAI lasciato null/mai-scritto come prima di questa
// migrazione — quello era esattamente il debito P2 da chiudere.
//
// Richiede in ".env.test": NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (se assenti, il test viene saltato esplicitamente, non fallisce a vuoto).
// Richiede anche che migration_19 sia stata applicata da Fabrizio: se le
// colonne non esistono ancora, la lettura service_role qui sotto fallirebbe
// con un errore Postgres esplicito (colonna inesistente) — comportamento
// atteso finché la migrazione non è stata eseguita manualmente.
const TEST_ACTIVITY_NAME = "[TEST] Attività BuddyKids";
const TEST_ACTIVITY_SLUG = "attivita-test-buddykids";
const TEST_PARENT_EMAIL = process.env.TEST_PARENT_EMAIL || "faberx83+test-genitore@gmail.com";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  return createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Stesso identico pattern di createRealWeeklyBooking in tests/one/capacity.spec.ts
// (duplicato deliberatamente invece di importato: i due file sono
// indipendenti e mode:"serial" solo al proprio interno — importare stato
// condiviso tra file introdurrebbe un accoppiamento fragile tra suite).
async function createRealWeeklyBooking(page: import("@playwright/test").Page) {
  await page.goto("/search");
  await page.getByPlaceholder("Cerca attività, centri, sport...").fill(TEST_ACTIVITY_NAME);
  const card = page.getByText(TEST_ACTIVITY_NAME).first();
  if (!(await card.isVisible().catch(() => false))) {
    test.skip(true, "Attività di test non trovata: esegui prima supabase/seed-test-data.sql.");
  }
  await card.click();
  await page.getByRole("link", { name: "Prenota ora" }).click();

  const selectableWeek = page
    .getByText(/✓ \d+ posti|⚡ ultimi \d+/)
    .first()
    .locator("xpath=ancestor::div[contains(@class,'cursor-pointer')]")
    .first();
  if (!(await selectableWeek.isVisible().catch(() => false))) {
    test.skip(true, "Nessuna settimana selezionabile per l'attività di test in questo momento.");
  }
  await selectableWeek.click();
  await page.getByRole("button", { name: "Continua" }).click();

  // FEATURE servizi extra (segnalazione Fabrizio 04/09/2026) — l'attività di
  // test ha shuttle_price > 0, quindi ora compare uno step "Servizi" in più
  // tra "Settimane" e "Bambini": lo saltiamo senza selezionare nulla (stesso
  // effetto economico di prima, nessun servizio incluso).
  const servicesHeading = page.getByText("Servizi extra", { exact: true });
  if (await servicesHeading.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Continua" }).click();
  }

  await expect(page.getByText("Chi partecipa?")).toBeVisible();
  await page
    .locator("label, button")
    .filter({ hasText: /.+/ })
    .first()
    .click()
    .catch(() => {});
  await page.getByRole("button", { name: "Continua" }).click();

  await page.getByRole("button", { name: "Conferma e paga" }).click();
  await expect(page).toHaveURL(/\/success/, { timeout: 15_000 });
}

test.describe("Sprint 6 - Email fire-and-forget: stato di consegna persistito", () => {
  test("TC-N610 - L'accettazione Partner di una prenotazione registra sempre un email_delivery_status noto (mai più silenzioso)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    test.skip(
      !SUPABASE_URL || !SERVICE_ROLE_KEY,
      "Richiede SUPABASE_SERVICE_ROLE_KEY in .env.test per leggere bookings.email_delivery_status."
    );

    const admin = getAdminClient();

    await loginAs(page, "parent");
    await createRealWeeklyBooking(page);

    const { data: activity } = await admin
      .from("activities")
      .select("id")
      .eq("slug", TEST_ACTIVITY_SLUG)
      .maybeSingle();
    const { data: parent } = await admin
      .from("profiles")
      .select("id")
      .eq("email", TEST_PARENT_EMAIL)
      .maybeSingle();
    expect(activity?.id, "attività di test non trovata via service_role").toBeTruthy();
    expect(parent?.id, "genitore di test non trovato via service_role").toBeTruthy();

    const { data: booking } = await admin
      .from("bookings")
      .select("id, total_amount, email_delivery_status")
      .eq("parent_id", parent!.id)
      .eq("activity_id", activity!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(booking?.id, "prenotazione appena creata non trovata via service_role").toBeTruthy();
    expect(
      booking!.email_delivery_status,
      "prima della risposta del centro non deve ancora esserci alcuno stato di consegna"
    ).toBeNull();

    await loginAs(page, "center_admin");
    await page.goto("/center/prenotazioni");
    const row = page
      .getByTestId("booking-row")
      .filter({ hasText: TEST_ACTIVITY_NAME })
      .filter({ hasText: `Totale €${booking!.total_amount}` })
      .first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Accetta" }).click();
    await expect(row.getByText("Accettata")).toBeVisible();

    const { data: bookingAfter } = await admin
      .from("bookings")
      .select("email_delivery_status, email_delivery_attempted_at")
      .eq("id", booking!.id)
      .single();

    expect(
      ["sent", "not_configured", "failed", "no_recipient"],
      "email_delivery_status deve essere sempre uno dei 4 valori noti, mai null — questo è esattamente il debito P2 chiuso"
    ).toContain(bookingAfter!.email_delivery_status);
    expect(bookingAfter!.email_delivery_attempted_at, "deve essere registrato il timestamp del tentativo").toBeTruthy();
  });
});
