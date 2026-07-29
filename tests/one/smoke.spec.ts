import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// TRAMA ONE — smoke cross-portale (Build Sprint 0).
//
// Cartella additiva: nessuna modifica ai 53 spec esistenti in
// tests/genitori|gestore|admin|nextgen. Richiede un browser reale — NON
// eseguibile nel sandbox Claude (mancano le librerie di sistema, nessun
// accesso root per installarle). Classificato PENDING LOCAL VERIFICATION,
// vedi report di sprint per i comandi esatti da eseguire sul Mac.
//
// Copre, per ciascun portale (Parent/Partner/Admin):
//  - utente non autenticato -> redirect al login (comportamento ereditato
//    da proxy.ts, non modificato)
//  - host errato (nessun modifica prevista, verificato solo che proxy.ts
//    continua a instradare correttamente come da comportamento invariato)
//
// Gate C, ottava ondata (29/07): TC-N302/303/304/401/402 originariamente
// verificavano il fallback quando TRAMA_ONE_ENABLED=false (default). Task
// #336 ("Abilitare TRAMA ONE via override") è stato chiuso in questa stessa
// ondata: l'override globale in feature_flag_overrides era già scope_type
// 'global' (non 'cohort'/'role') ma con un expires_at scaduto il 22/07 mai
// notato — Fabrizio ha rimosso la scadenza (permanente). Da questo momento
// il flag risolve SEMPRE true in produzione, quindi le vecchie asserzioni di
// fallback non sono più valide (non un bug, una precondizione cambiata) e
// sono state riscritte per verificare lo stato ATTUALE (shell raggiungibile,
// nessun redirect). TC-N306 (già scritto per lo scenario flag=true) non
// richiede più uno skip: l'override globale copre anche l'account di test.
// TC-N305 e TC-N307 restano invariati (indipendenti dal valore del flag).

test.describe("TRAMA ONE — /one smoke cross-portale", () => {
  test("TC-N302 - Parent: /one con flag ATTIVATO (override globale permanente, task #336) mostra la shell TRAMA ONE senza redirect", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/one");
    await expect(page).toHaveURL(/\/one$/);
    await expect(page.locator("[data-trama-one-portal='parent']")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N303 - Partner: /one con flag ATTIVATO mostra la shell TRAMA ONE senza redirect", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account gestore di test.");
    await loginAs(page, "center_admin");
    // Corretto in fase di certificazione post-deploy (vedi Decision Log):
    // "/one" sul dominio principale di test risolve sempre al layout
    // Parent (app/one/layout.tsx) — il routing verso app/center/one/* è
    // basato sull'HOST (buddykids-partner.vercel.app via proxy.ts), non sul
    // ruolo dell'utente loggato, e i test smoke girano tutti contro un
    // singolo TEST_BASE_URL. Si naviga quindi direttamente al path fisico
    // "/center/one" (stesso layout che proxy.ts raggiungerebbe da host
    // partner), che è indipendente dall'host e verifica la stessa shell.
    await page.goto("/center/one");
    await expect(page).toHaveURL(/\/center\/one$/);
    await expect(page.locator("[data-trama-one-portal='partner']")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N304 - Admin: /one con flag ATTIVATO mostra la shell TRAMA ONE senza redirect", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account admin di test.");
    await loginAs(page, "platform_admin");
    // Stessa correzione di TC-N303: si naviga al path fisico "/admin/one"
    // invece di "/one", per lo stesso motivo (routing host-based via
    // proxy.ts non esercitato da un singolo TEST_BASE_URL).
    await page.goto("/admin/one");
    await expect(page).toHaveURL(/\/admin\/one$/);
    await expect(page.locator("[data-trama-one-portal='admin']")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N305 - Utente non autenticato che apre /one viene rediretto al login (comportamento proxy.ts invariato)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    await page.goto("/one");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("TC-N306 - Parent: /one con flag ATTIVATO per l'utente di test mostra la shell TRAMA ONE", async ({ page }) => {
    // Gate C, ottava ondata (29/07): non più skippato. L'override globale
    // permanente (task #336) copre già qualunque utente, incluso quello di
    // test — non serve più un override scope_type='user' dedicato.
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/one");
    await expect(page.locator("[data-trama-one-portal='parent']")).toBeVisible();
    await expect(page.getByText("TRAMA ONE — Parent")).toBeVisible();
  });

  test("TC-N307 - Errore del resolver (DB non raggiungibile/timeout) risolve comunque a fallback sicuro, mai errore visibile", async ({ page }) => {
    test.skip(
      true,
      "Richiede la simulazione di un errore DB/timeout lato Supabase (es. tramite un ambiente di test dedicato con credenziali service_role invalide) — non riproducibile in modo sicuro contro produzione. Verificare manualmente puntando SUPABASE_SERVICE_ROLE_KEY a un valore non valido in un ambiente di staging, non in produzione."
    );
    await loginAs(page, "parent");
    await page.goto("/one");
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  // ────────────────────────────────────────────────────────────────
  // TRAMA ONE Build Sprint 1 — le nuove sotto-route /center/one/onboarding
  // e /admin/one/onboarding ereditano lo stesso gate del layout genitore
  // (app/center/one/layout.tsx, app/admin/one/layout.tsx). Gate C, ottava
  // ondata (29/07): con l'override globale ora permanente (task #336) il
  // gate lascia passare — verifichiamo che la sotto-route sia raggiungibile
  // (nessun redirect), stesso pivot di TC-N302/303/304 qui sopra.
  // ────────────────────────────────────────────────────────────────
  test("TC-N401 - Partner: /center/one/onboarding con flag ATTIVATO è raggiungibile senza redirect", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/one/onboarding");
    await expect(page).toHaveURL(/\/center\/one\/onboarding$/);
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N402 - Admin: /admin/one/onboarding con flag ATTIVATO è raggiungibile senza redirect", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account admin di test.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin/one/onboarding");
    await expect(page).toHaveURL(/\/admin\/one\/onboarding$/);
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});
