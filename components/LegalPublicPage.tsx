import { resolvePublishedDocumentForPublicRoute } from "@/lib/legal/gate";
import { isDraftLegalVersion, legalTextFor } from "@/lib/legal/texts";
import { legalTextSha256 } from "@/lib/legal/text-integrity";
import LegalDocumentView from "@/components/LegalDocumentView";
import PageHeader from "@/components/PageHeader";
import type { LegalDocumentType } from "@/lib/legal/consent";

// TRAMA — pagine pubbliche /privacy e /terms (16/10/2026, pacchetto 2).
// Mostrano il testo della versione PUBBLICATA in legal_documents solo se il
// testo esiste nel codice (lib/legal/texts.ts) e la sua impronta sha256
// coincide con quella registrata: altrimenti "Documento in preparazione".
// Nessun login richiesto (route escluse dal gate di autenticazione).
// 16/10/2026: variante "app" per leggerli DENTRO l'app (Profilo → Privacy e
// account, Cos'è TRAMA): intestazione con freccia indietro e barra in basso,
// senza uscire dall'app installata.
export default async function LegalPublicPage({
  type,
  title,
  variant = "public",
}: {
  type: LegalDocumentType;
  title: string;
  variant?: "public" | "app";
}) {
  const doc = await resolvePublishedDocumentForPublicRoute(type);
  const text = doc ? legalTextFor(type, doc.version) : null;
  const verified = Boolean(doc && text && doc.sha256 && legalTextSha256(text) === doc.sha256);

  return (
    <div className={variant === "app" ? "flex flex-col pb-10" : "min-h-screen bg-trama-page px-5 py-8"}>
      {variant === "app" && <PageHeader title={title} backHref="/nextgen/profile" showBrandIcon />}
      <div className={variant === "app" ? "mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 pt-3" : "mx-auto flex max-w-2xl flex-col gap-4"}>
        {variant === "public" && <img src="/brand/trama-logo-mark.png" alt="TRAMA" className="h-9 w-auto self-start" />}
        {!doc || !verified || !text ? (
          <>
            <h1 className="font-poppins text-[26px] font-semibold leading-tight text-ink">{title}</h1>
            <p className="text-[15px] text-ink-2">Documento in preparazione. Torna a consultare questa pagina più avanti.</p>
          </>
        ) : (
          <>
            <p className="text-[13px] text-ink-3">
              Versione {doc.version}
              {doc.publishedAt ? ` · in vigore dal ${new Date(doc.publishedAt).toLocaleDateString("it-IT")}` : ""}
            </p>
            {isDraftLegalVersion(doc.version) && (
              <p className="rounded-2xl border border-[#F1D9A6] bg-[#FFF7E6] px-4 py-3 text-[13.5px] leading-snug text-[#7A4B00]">
                Bozza in revisione legale, valida per la fase di prova di TRAMA. Il testo definitivo può cambiare: ti
                avviseremo nell&apos;app.
              </p>
            )}
            <LegalDocumentView source={text} />
          </>
        )}
      </div>
    </div>
  );
}
