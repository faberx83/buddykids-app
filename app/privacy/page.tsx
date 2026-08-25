import { resolvePublishedDocumentForPublicRoute } from "@/lib/legal/gate";

export const dynamic = "force-dynamic";

// PRE-MICRO-PILOT CLOSURE GATE — task #569 (25/08/2026). Pagina pubblica di
// sola lettura, SENZA login (stesso principio di app/share/planner/[token]/
// page.tsx — route esclusa dal gate di autenticazione in proxy.ts §11).
// Mostra il documento PUBLISHED corrente per document_type="privacy_notice"
// (migration_27 v2, LIVE). Nessuna registrazione di "accettazione": la
// Privacy Notice è un'informativa (Art. 13 GDPR), non un consenso — questa
// pagina non scrive mai in legal_acceptances.
//
// Se nessun documento è PUBLISHED (stato oggi, verificato: 0 righe in
// produzione), mostra "Documento in preparazione" invece di un 404 o di un
// testo inventato — coerente col vincolo esplicito di Fabrizio: nessun
// contenuto legale reale creato autonomamente da Claude.
export default async function PrivacyNoticePage() {
  const doc = await resolvePublishedDocumentForPublicRoute("privacy_notice");

  return (
    <div className="min-h-screen bg-bg px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-1 text-xl font-bold text-ink">Informativa Privacy</h1>

        {!doc ? (
          <p className="mt-4 text-sm text-ink-2">
            Documento in preparazione. Torna a consultare questa pagina più avanti.
          </p>
        ) : (
          <>
            <p className="mb-6 text-xs text-ink-3">
              Versione {doc.version} — in vigore dal{" "}
              {doc.publishedAt ? new Date(doc.publishedAt).toLocaleDateString("it-IT") : "—"}
            </p>
            {/* PENDING EXTERNAL REVIEW — il testo legale reale non è stato
                scritto da Claude (vedi vincolo esplicito di Fabrizio,
                "NON creare documenti legali reali autonomamente"). Questa
                pagina renderizza solo METADATI (versione, data) finché
                legal_documents non guadagna una colonna di contenuto reale
                o un meccanismo di rendering del testo approvato — nessun
                testo placeholder mostrato come se fosse il documento vero. */}
            <p className="text-sm text-ink-2">
              Il testo completo di questa versione è in fase di revisione legale esterna e
              verrà pubblicato qui non appena disponibile.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
