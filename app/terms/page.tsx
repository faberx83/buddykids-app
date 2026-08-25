import { resolvePublishedDocumentForPublicRoute } from "@/lib/legal/gate";

export const dynamic = "force-dynamic";

// PRE-MICRO-PILOT CLOSURE GATE — task #569 (25/08/2026). Gemella di
// app/privacy/page.tsx: pagina pubblica di sola lettura, SENZA login,
// mostra il documento PUBLISHED corrente per document_type="terms"
// (migration_27 v2, LIVE). A differenza della Privacy Notice, i Termini
// SONO un contratto accettato in modo versionato (vedi legal_acceptances) —
// ma questa pagina resta di sola lettura: la scrittura dell'accettazione
// avviene solo dal flusso di signup (app/actions/legal.ts), mai da qui.
export default async function TermsOfServicePage() {
  const doc = await resolvePublishedDocumentForPublicRoute("terms");

  return (
    <div className="min-h-screen bg-bg px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-1 text-xl font-bold text-ink">Termini di Servizio</h1>

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
            {/* PENDING EXTERNAL REVIEW — vedi nota identica in
                app/privacy/page.tsx: nessun testo legale reale scritto qui,
                solo metadati di versione finché il contenuto approvato non
                è disponibile. */}
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
