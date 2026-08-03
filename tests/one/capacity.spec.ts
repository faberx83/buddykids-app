import { createClient } from "@supabase/supabase-js";
import { expect, isRealDeployment, loginAs, test } from "../fixtures/roles";

// TRAMA ONE Build Sprint 6 (backlog vincolante P1, "Capacity a tripla fonte
// di verità" — vedi SPRINT_GOVERNANCE.md, AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md
// §16.6, migration_18_capacity_service.sql, lib/capacity/service.ts).
//
// Questo file verifica il comportamento end-to-end del servizio canonico di
// capacità sulle prenotazioni A SETTIMANA INTERA, in particolare il bug reale
// scoperto durante l'implementazione: cancelBookingAction (app/actions/
// bookings.ts) non ha MAI rilasciato la capacità settimanale decrementata
// all'accettazione — un genitore che annullava una prenotazione settimanale
// già accettata perdeva quel posto per sempre. Non esiste alcuna superficie
// UI che mostri activity_weeks.spots_left direttamente (il "Posti rimasti"
// in scheda attività riflette solo il campo editoriale activities.spots_left,
// vedi app/activity/[id]/DetailClient.tsx) — la verifica quindi legge lo
// stato reale via client Supabase service_role (sola lettura per le
// asserzioni, MAI per bypassare RLS nei passaggi applicativi: ogni mutazione
// avviene sempre tramite l'app reale, loginAs + click), stesso principio già
// stabilito in tests/cleanup-test-data.mjs.
//
// Richiede in ".env.test":
//   NEXT_PUBLIC_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...
// (le stesse già necessarie per tests/cleanup-test-data.mjs — se assenti, i
// due test qui sotto vengono saltati esplicitamente, non falliscono a vuoto).
//
// Nota sulla concorrenza (stesso limite già documentato in
// tests/gestore/prenotazioni.spec.ts per TC-508): l'attività di test è
// condivisa con altri file (tests/genitori/prenotazione.spec.ts crea
// prenotazioni reali sulla stessa attività). Il locator della riga da
// accettare filtra sull'importo esatto della prenotazione appena creata E
// prende la prima corrispondenza (l'Inbox ordina per created_at decrescente,
// vedi lib/data/center-bookings.ts) — in un run con più prenotazioni dallo
// stesso importo esatto in sospeso, questo test resta corretto solo se la
// propria è la più recente, cosa garantita dall'ordine seriale di questo
// file mode:"serial" ma non da eventuali altri file eseguiti in worker
// paralleli nello stesso istante (stesso limite noto, non nuovo).
const TEST_ACTIVITY_NAME = "[TEST] Attività BuddyKids";
const TEST_ACTIVITY_SLUG = "attivita-test-buddykids";
const TEST_PARENT_EMAIL = process.env.TEST_PARENT_EMAIL || "faberx83+test-genitore@gmail.com";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  // Chiamare solo DOPO un test.skip che ha già verificato SUPABASE_URL/
  // SERVICE_ROLE_KEY presenti.
  return createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Crea una prenotazione REALE a settimana intera sull'attività di test,
// scegliendo la prima settimana selezionabile — stesso identico pattern già
// collaudato in tests/genitori/prenotazione.spec.ts (TC-111/TC-112).
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

// Stato condiviso tra i due test (mode:"serial", stesso file — stesso
// principio di UNIQUE_NAME in tests/one/center-leads.spec.ts): TC-N608
// continua esattamente dalla prenotazione accettata da TC-N607, invece di
// ricreare tutto da zero e raddoppiare il rischio di collisione descritto
// sopra.
let shared: {
  bookingId: string;
  weekId: string;
  capacityBeforeAccept: number;
  capacityAfterAccept: number;
} | null = null;

test.describe("Sprint 6 - Capacity: servizio canonico reserve/release settimanale", () => {
  test.describe.configure({ mode: "serial" });

  test("TC-N607 - L'accettazione Partner di una prenotazione settimanale decrementa activity_weeks.spots_left in modo idempotente", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    test.skip(
      !SUPABASE_URL || !SERVICE_ROLE_KEY,
      "Richiede SUPABASE_SERVICE_ROLE_KEY in .env.test per leggere activity_weeks/booking_weeks (nessuna UI mostra spots_left per settimana)."
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
      .select("id, total_amount")
      .eq("parent_id", parent!.id)
      .eq("activity_id", activity!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(booking?.id, "prenotazione appena creata non trovata via service_role").toBeTruthy();

    const { data: bookingWeeks } = await admin
      .from("booking_weeks")
      .select("week_id, capacity_decremented")
      .eq("booking_id", booking!.id);
    expect(bookingWeeks?.length, "attesa esattamente una settimana per la prenotazione appena creata").toBe(1);
    const weekId = bookingWeeks![0].week_id;
    expect(bookingWeeks![0].capacity_decremented, "non ancora accettata: capacity_decremented deve essere false").toBe(
      false
    );

    const { data: weekBefore } = await admin
      .from("activity_weeks")
      .select("spots_left, capacity")
      .eq("id", weekId)
      .single();
    const capacityBeforeAccept = weekBefore!.spots_left;

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

    const { data: weekAfter } = await admin
      .from("activity_weeks")
      .select("spots_left")
      .eq("id", weekId)
      .single();
    const { data: bookingWeekAfter } = await admin
      .from("booking_weeks")
      .select("capacity_decremented")
      .eq("booking_id", booking!.id)
      .eq("week_id", weekId)
      .single();

    expect(bookingWeekAfter!.capacity_decremented, "dopo l'accettazione capacity_decremented deve diventare true").toBe(
      true
    );
    expect(weekAfter!.spots_left, "spots_left deve scendere esattamente di 1 dopo l'accettazione").toBe(
      capacityBeforeAccept - 1
    );

    shared = {
      bookingId: booking!.id,
      weekId,
      capacityBeforeAccept,
      capacityAfterAccept: weekAfter!.spots_left,
    };
  });

  // Il bug reale che questo test chiude: prima di lib/capacity/service.ts +
  // migration_18, cancelBookingAction(app/actions/bookings.ts) faceva SOLO
  // `update({status:"cancelled"})` su bookings, senza mai toccare
  // activity_weeks.spots_left né booking_weeks.capacity_decremented — il
  // posto restava perso per sempre. Ora cancelBookingAction chiama
  // releaseAllWeekCapacityForBooking PRIMA dell'update di stato.
  test("TC-N608 - Annullare una prenotazione settimanale già accettata rilascia la capacità (fix cancelBookingAction)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    test.skip(
      !SUPABASE_URL || !SERVICE_ROLE_KEY,
      "Richiede SUPABASE_SERVICE_ROLE_KEY in .env.test per leggere activity_weeks/booking_weeks."
    );
    test.skip(!shared, "TC-N607 non ha prodotto una prenotazione accettata da annullare (saltato o fallito prima).");

    const admin = getAdminClient();
    const { bookingId, weekId, capacityBeforeAccept } = shared!;

    await loginAs(page, "parent");
    await page.goto(`/prenotazioni/${bookingId}/modifica`);
    await page.getByRole("button", { name: "Annulla prenotazione", exact: true }).click();
    await expect(page.getByText("Vuoi annullare la prenotazione?", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Sì, annulla" }).click();
    await expect(page).toHaveURL(/\/prenotazioni$/, { timeout: 10_000 });

    const { data: bookingAfter } = await admin.from("bookings").select("status").eq("id", bookingId).single();
    expect(bookingAfter!.status, "la prenotazione deve risultare 'cancelled' dopo l'annullamento").toBe("cancelled");

    const { data: bookingWeekAfterCancel } = await admin
      .from("booking_weeks")
      .select("capacity_decremented")
      .eq("booking_id", bookingId)
      .eq("week_id", weekId)
      .single();
    expect(
      bookingWeekAfterCancel!.capacity_decremented,
      "dopo l'annullamento capacity_decremented deve tornare false (rilascio idempotente)"
    ).toBe(false);

    const { data: weekAfterCancel } = await admin
      .from("activity_weeks")
      .select("spots_left")
      .eq("id", weekId)
      .single();
    expect(
      weekAfterCancel!.spots_left,
      "spots_left deve tornare al valore precedente l'accettazione — QUESTO è il bug fissato: prima non risaliva mai"
    ).toBe(capacityBeforeAccept);
  });
});
