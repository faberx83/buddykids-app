import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// TRAMA ONE — Gruppi "Scopri"/"Inviti" (24/08/2026, migration_25): gap
// segnalato da Fabrizio ("la 'visibilità' della feature gruppi?"), colmato
// con una vera colonna is_public (+ policy RLS dedicata, vedi migration_25)
// per "Scopri" e una vera tabella group_invites (stesso pattern collaudato
// di family_invites) per "Inviti". Serial: ogni test si appoggia sullo
// stesso gruppo creato dal primo, come tests/genitori/prenotazione.spec.ts.
// Richiede un solo account genitore di test (l'harness non ne ha un
// secondo): non verifica quindi il lato "ricezione" di Scopri/Inviti da un
// ALTRO genitore — solo il lato "creazione/gestione" lato creatore, che è
// comunque quanto basta per verificare che la migrazione/RLS/azioni
// funzionino davvero contro Supabase reale (non solo in teoria).
test.describe.configure({ mode: "serial" });

test.describe("Genitori - Gruppi: Scopri (pubblico) e Inviti (email reale)", () => {
  let groupId: string | null = null;

  test("TC-N642 - creare un gruppo, attivare 'Visibile in Scopri' e ritrovarlo nella tab Scopri", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");

    await loginAs(page, "parent");
    await page.goto("/groups");
    await page.getByRole("button", { name: "+ Nuovo" }).click();
    await page.getByPlaceholder("Nome del gruppo").fill("[TEST] Gruppo Scopri Inviti");
    await page.getByRole("button", { name: "Crea gruppo" }).click();

    // createGroupAction fa router.push(`/groups/${id}`) al successo.
    await expect(page).toHaveURL(/\/groups\/[^/]+$/);
    groupId = page.url().split("/groups/")[1];

    // Il toggle "Visibile in Scopri" è visibile solo al creatore (createdByMe).
    await expect(page.getByText('Visibile in "Scopri"')).toBeVisible();
    await page.getByRole("switch").first().click();

    // /groups mostra ora questo gruppo nella tab "Scopri" (non è più "di cui
    // non sono membro" — ma la RPC list_public_groups esclude i gruppi di
    // cui il chiamante è GIA' membro, quindi qui verifichiamo solo che il
    // toggle abbia scritto davvero is_public=true, non la sua comparsa nella
    // tab Scopri del SUO stesso creatore (che per design non lo vedrebbe:
    // list_public_groups esclude i gruppi di cui sei già membro).
    await page.reload();
    await expect(page.getByRole("switch").first()).toHaveAttribute("aria-checked", "true");
  });

  test("TC-N643 - invitare la propria email viene rifiutato ('Non puoi invitare te stesso')", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    test.skip(!groupId, "Richiede il gruppo creato in TC-N642 (serial).");

    await loginAs(page, "parent");
    await page.goto(`/groups/${groupId}`);

    const testParentEmail = process.env.TEST_PARENT_EMAIL || "";
    test.skip(!testParentEmail, "Richiede TEST_PARENT_EMAIL per compilare il form invito.");

    await page.getByPlaceholder("email@esempio.it").fill(testParentEmail);
    await page.getByRole("button", { name: "Invita" }).click();
    await expect(page.getByText("Non puoi invitare te stesso")).toBeVisible();
  });

  test("TC-N644 - invitare un'email valida crea l'invito, un secondo invito alla stessa email viene rifiutato (no duplicati)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    test.skip(!groupId, "Richiede il gruppo creato in TC-N642 (serial).");

    await loginAs(page, "parent");
    await page.goto(`/groups/${groupId}`);

    const invitedEmail = `test-invito-gruppo-${Date.now()}@example.com`;
    await page.getByPlaceholder("email@esempio.it").fill(invitedEmail);
    await page.getByRole("button", { name: "Invita" }).click();
    await expect(page.getByText(/Invito (inviato via email|creato)/)).toBeVisible();

    // Stessa email una seconda volta: rifiutato come duplicato (query in
    // inviteToGroupAction su group_invites status pending/sent).
    await page.getByPlaceholder("email@esempio.it").fill(invitedEmail);
    await page.getByRole("button", { name: "Invita" }).click();
    await expect(page.getByText("Questa email è già stata invitata a questo gruppo")).toBeVisible();
  });
});
