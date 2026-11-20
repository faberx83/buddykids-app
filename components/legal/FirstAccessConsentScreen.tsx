"use client";

// TRAMA — CONSENSI AL PRIMO ACCESSO (20/11/2026).
// Fabrizio: "manca qualche flag di accettazione consenso e informativa privacy
// alla prima login... si può aggiungere e salvare a db?". Decisione: per ora
// solo famiglie.
//
// Schermata a tutta pagina mostrata dal layout dell'app famiglie al posto
// della pagina richiesta, finché il genitore non ha accettato la versione
// pubblicata dei Termini e preso visione dell'Informativa. I testi si leggono
// qui (niente link verso pagine che sarebbero a loro volta bloccate). Dopo la
// conferma si ricarica la stessa pagina: l'utente resta dove voleva andare.

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import LegalDocumentView from "@/components/LegalDocumentView";
import { acceptFirstAccessConsentAction } from "@/app/actions/legal";
import { canSubmitFirstAccessConsent } from "@/lib/legal/first-access";

interface DocProps {
  version: string;
  text: string;
  accepted: boolean;
}

function Check({
  checked,
  onChange,
  children,
  testId,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  testId: string;
}) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-2xl border border-trama-line bg-white px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={testId}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[#5B4BC4]"
      />
      <span className="text-[14.5px] leading-snug text-ink">{children}</span>
    </label>
  );
}

export default function FirstAccessConsentScreen({
  terms,
  privacy,
  showMarketing,
  isDraft,
  firstName,
}: {
  terms: DocProps;
  privacy: DocProps;
  showMarketing: boolean;
  isDraft: boolean;
  firstName?: string | null;
}) {
  const router = useRouter();
  // Ciò che è già stato accettato in passato resta spuntato e bloccato.
  const [termsChecked, setTermsChecked] = useState(terms.accepted);
  const [privacyChecked, setPrivacyChecked] = useState(privacy.accepted);
  const [marketingChecked, setMarketingChecked] = useState(false);
  const [open, setOpen] = useState<"terms" | "privacy" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = canSubmitFirstAccessConsent({ terms: termsChecked, privacy: privacyChecked });
  const isUpdate = terms.accepted || privacy.accepted;

  async function handleSubmit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    const result = await acceptFirstAccessConsentAction({ terms: termsChecked, privacy: privacyChecked, marketing: marketingChecked });
    if (!result.ok) {
      setBusy(false);
      setError(result.error ?? "Qualcosa non ha funzionato. Riprova.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-col bg-trama-page" data-testid="first-access-consent">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 pb-8 pt-10">
        <img src="/brand/trama-logo-mark.png" alt="TRAMA" className="h-9 w-auto self-start" />
        <h1 className="font-poppins text-[26px] font-semibold leading-tight text-ink">
          {isUpdate ? "Abbiamo aggiornato i nostri testi" : `Prima di continuare${firstName ? `, ${firstName}` : ""}`}
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          {isUpdate
            ? "Per continuare a usare TRAMA ti chiediamo di confermare la nuova versione."
            : "Per usare TRAMA ti chiediamo di accettare i Termini di servizio e di confermare di aver letto come trattiamo i tuoi dati e quelli dei tuoi figli."}
        </p>
        {isDraft && (
          <p className="rounded-2xl border border-[#F1D9A6] bg-[#FFF7E6] px-4 py-3 text-[13.5px] leading-snug text-[#7A4B00]">
            Testi in revisione legale, validi per la fase di prova. Se cambiano te lo chiederemo di nuovo.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {(
            [
              { key: "terms" as const, label: "Termini di servizio", doc: terms },
              { key: "privacy" as const, label: "Informativa privacy", doc: privacy },
            ]
          ).map(({ key, label, doc }) => (
            <div key={key} className="overflow-hidden rounded-2xl border border-trama-line bg-white">
              <button
                type="button"
                onClick={() => setOpen((o) => (o === key ? null : key))}
                aria-expanded={open === key}
                className="flex min-h-[48px] w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-[15px] font-semibold text-ink">
                  {label}
                  <span className="ml-2 text-[12.5px] font-normal text-ink-3">versione {doc.version}</span>
                </span>
                <span className="text-[13.5px] font-semibold text-trama-accent-ink">{open === key ? "Chiudi" : "Leggi"}</span>
              </button>
              {open === key && (
                <div className="max-h-[50vh] overflow-y-auto border-t border-trama-line px-4 py-4">
                  <LegalDocumentView source={doc.text} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <Check checked={termsChecked} onChange={(v) => !terms.accepted && setTermsChecked(v)} testId="consent-terms">
            Accetto i <strong>Termini di servizio</strong> (obbligatorio)
          </Check>
          <Check checked={privacyChecked} onChange={(v) => !privacy.accepted && setPrivacyChecked(v)} testId="consent-privacy">
            Ho letto l&apos;<strong>Informativa privacy</strong> (obbligatorio)
          </Check>
          {showMarketing && (
            <Check checked={marketingChecked} onChange={setMarketingChecked} testId="consent-marketing">
              Voglio ricevere comunicazioni commerciali da TRAMA (facoltativo, puoi cambiare idea dal profilo)
            </Check>
          )}
        </div>

        {error && <p className="text-[13.5px] font-medium text-[#B3261E]">{error}</p>}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || busy}
          data-testid="consent-submit"
          className="min-h-[52px] w-full rounded-[12px] bg-trama-primary text-[16px] font-semibold text-white active:bg-trama-primary-press disabled:opacity-50"
        >
          {busy ? "Un attimo…" : "Continua"}
        </button>
        <p className="text-center text-[12.5px] text-ink-3">Domande sui tuoi dati? Scrivici a privacy@tramapp.it</p>
      </div>
    </div>
  );
}
