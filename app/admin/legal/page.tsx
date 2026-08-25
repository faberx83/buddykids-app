import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { listDocumentsByType } from "@/lib/legal/gate";
import { deriveDocumentStatus, type LegalDocumentRecord, type LegalDocumentType } from "@/lib/legal/consent";

// PRE-MICRO-PILOT CLOSURE GATE — task #574 (25/08/2026). Vista Admin MINIMA
// (view-only, non un CMS — richiesto esplicitamente da Fabrizio, §12) su
// legal_documents: tipo, versione, stato derivato (DRAFT/PUBLISHED/
// SUPERSEDED — nessuna colonna "status" nello schema live, vedi
// lib/legal/consent.ts#deriveDocumentStatus), data pubblicazione, sha256.
// Protetta dal gate di ruolo già esistente in app/admin/layout.tsx
// (AccessGate requiredRole="platform_admin") — nessun controllo aggiuntivo
// necessario qui.
//
// Nessuna azione di scrittura in questa pagina (niente "pubblica"/"crea
// nuova versione"): pubblicare un documento reale resta un'azione fuori dal
// perimetro di questo lavoro tecnico (testo PENDING EXTERNAL REVIEW) — vedi
// §12 "no silent modification of already-accepted version content".

const STATUS_LABEL: Record<string, string> = {
  draft: "Bozza",
  published: "Pubblicato",
  superseded: "Superato",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: "bg-[#F0F2F5] text-ink-3",
  published: "bg-green-light text-[#2d8f52]",
  superseded: "bg-orange-light text-trama-orange",
};

const DOCUMENT_TYPE_LABEL: Record<LegalDocumentType, string> = {
  terms: "Termini di Servizio",
  privacy_notice: "Informativa Privacy",
};

interface DisplayRow extends LegalDocumentRecord {
  status: ReturnType<typeof deriveDocumentStatus>;
}

async function loadRowsForType(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentType: LegalDocumentType
): Promise<DisplayRow[]> {
  const docs = await listDocumentsByType(supabase, documentType);
  return docs.map((doc) => ({ ...doc, status: deriveDocumentStatus(doc, docs) }));
}

export default async function AdminLegalDocumentsPage() {
  if (!isSupabaseConfigured) {
    return (
      <div>
        <h1 className="mb-1 text-xl font-bold text-white">Documenti legali</h1>
        <div className="mt-4 rounded-lg border border-[#E8EBF0] bg-white p-4 text-sm text-ink-2">
          Supabase non configurato: nessun documento legale reale da mostrare in questo ambiente.
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [termsRows, privacyRows] = await Promise.all([
    loadRowsForType(supabase, "terms"),
    loadRowsForType(supabase, "privacy_notice"),
  ]);
  const rows = [...termsRows, ...privacyRows];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Documenti legali</h1>
        <p className="text-sm text-navy-text2">
          Vista di sola lettura (migration_27 v2) — {rows.length} version{rows.length === 1 ? "e" : "i"} registrat
          {rows.length === 1 ? "a" : "e"}. Nessuna azione di pubblicazione qui: gestita fuori da questo strumento.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-4 text-sm text-ink-2">
          Nessun documento legale registrato — nessuna versione di Termini o Informativa Privacy è stata ancora
          inserita in <code className="rounded bg-bg px-1 py-0.5">legal_documents</code>. Stato coerente col
          PRE-MICRO-PILOT gate: testo legale PENDING EXTERNAL REVIEW.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#E8EBF0] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Versione</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium">Pubblicato il</th>
                <th className="px-4 py-3 font-medium">SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[#F0F2F5] last:border-0">
                  <td className="px-4 py-3 font-semibold text-ink">{DOCUMENT_TYPE_LABEL[row.documentType]}</td>
                  <td className="px-4 py-3 text-ink-2">{row.version}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {row.publishedAt ? new Date(row.publishedAt).toLocaleDateString("it-IT") : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-3">
                    {row.sha256 ? `${row.sha256.slice(0, 12)}…` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
