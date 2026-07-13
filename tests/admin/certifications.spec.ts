import { test } from "../fixtures/roles";

// Area: Admin - Certificazioni servizio
// Coda di approvazione per le richieste inviate dai gestori (vedi
// TC-200 in tests/gestore/attivita.spec.ts) — solo un Admin piattaforma può
// approvare/rifiutare, le RLS lo impongono anche lato database (vedi
// supabase/schema.sql#activity_certifications).

test.describe("Admin - Certificazioni servizio", () => {
  // Priorita: Alta | Precondizioni: Almeno una richiesta di Certificazione in stato "pending" (vedi TC-200)
  // Passi: Login Admin -> /admin/certifications -> "Approva" sulla richiesta di test
  // Risultato atteso: La richiesta passa in "Approvata" e sparisce dalla sezione "In attesa"; da quel momento il badge compare nel dettaglio attività lato genitore (vedi TC-202)
  test.fixme("TC-201 - L'Admin approva una richiesta di Certificazione servizio", async ({ page }) => {
    // TODO: implementare - richiede prima di creare una richiesta pending
    // (TC-200) e poi loggare come platform_admin: due sessioni/ruoli diversi
    // nello stesso test, non ancora orchestrato negli altri test admin di
    // questo file (vedi tests/admin/richieste-gruppo.spec.ts per lo stesso
    // limite sul report Richieste Gruppo, TC-089).
  });

  // Priorita: Media | Precondizioni: Come TC-201
  test.fixme("TC-203 - L'Admin rifiuta una richiesta con una nota motivazionale", async ({ page }) => {
    // TODO: implementare - stesso limite di TC-201. Verificare che la nota
    // inserita nel campo facoltativo compaia poi nello Storico gestore
    // (ActivityEditForm.tsx mostra "Motivo: ..." solo per status=rejected).
  });
});
