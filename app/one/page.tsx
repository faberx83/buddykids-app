// TRAMA ONE — placeholder Parent (Build Sprint 0).
// Shell minimale: nessuna schermata definitiva, nessuna funzionalità di
// business. Il gate di accesso (auth + feature flag) è già applicato dal
// layout (app/one/layout.tsx): se questa pagina viene renderizzata,
// TRAMA_ONE_ENABLED è già risolto a true per l'utente corrente.
export default function OneParentPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>TRAMA ONE — Parent</h1>
      <p>Foundation Sprint 0. Nessuna funzionalità di business ancora disponibile.</p>
    </main>
  );
}
