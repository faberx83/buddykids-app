"use client";

import { useState } from "react";
import Link from "next/link";
import { createInquiryAction, getContactContextAction } from "@/app/actions/inquiries";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// "Contatta il gestore" — richiesta da Fabrizio in ogni scheda attività:
// apre un piccolo modulo, invia un messaggio legato a QUESTA attività, che
// il centro vede in /center/richieste e a cui risponde una volta. La
// risposta torna visibile al genitore in "Le mie richieste" (/richieste,
// vedi ProfileSettingsSection/menu profilo). Ticketing semplice: un
// messaggio, una risposta — non una chat multi-turno.
// className/label (14/10/2026, Prenotazioni V2): stesso flusso, aspetto
// del pulsante scelto da chi lo usa. Senza, resta identico a prima.
export default function ContactCenterButton({
  activityDbId,
  className,
  label,
}: {
  activityDbId?: string;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 27/10/2026 (messaggi come conversazione): risolto all'apertura del foglio.
  // threads=null finché non si sa: si mostra il foglio V2 solo se acceso.
  const [threads, setThreads] = useState<boolean | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  async function openSheet() {
    setOpen(true);
    if (!activityDbId || !isSupabaseConfigured) {
      setThreads(false);
      return;
    }
    try {
      const ctx = await getContactContextAction(activityDbId);
      setThreads(ctx.threads);
      setExistingId(ctx.existingInquiryId);
    } catch {
      setThreads(false);
    }
  }

  async function handleSend() {
    setError(null);
    if (!message.trim()) {
      setError("Scrivi un messaggio prima di inviare");
      return;
    }
    if (!activityDbId || !isSupabaseConfigured) {
      // Demo/dati mock: nessuna scrittura reale possibile, mostriamo comunque
      // la conferma per non bloccare chi sta solo esplorando l'app.
      setSent(true);
      return;
    }
    setSending(true);
    const result = await createInquiryAction({ activityDbId, message });
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSentId(result.inquiryId ?? null);
    setSent(true);
  }

  function close() {
    setOpen(false);
    setMessage("");
    setSent(false);
    setError(null);
    setSentId(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className={className ?? "flex items-center gap-1.5 text-xs font-semibold text-sky"}
      >
        <i className="ti ti-message-circle-2 text-sm" />
        {label ?? "Contatta il gestore"}
      </button>

      {open && threads && (
        <div
          data-nav-v2
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={close}
          data-testid="contact-sheet-v2"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-sheet-title"
            className="w-full max-w-md rounded-t-[24px] bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3 sm:rounded-[24px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-trama-line sm:hidden" aria-hidden="true" />
            {sent ? (
              <div className="flex flex-col gap-3">
                <h2 id="contact-sheet-title" className="font-poppins text-[20px] font-semibold text-ink">
                  Messaggio inviato
                </h2>
                <p className="text-[15px] leading-relaxed text-ink-2">
                  Il centro risponde nella stessa conversazione: ti avvisiamo quando scrive.
                </p>
                {sentId && (
                  <Link
                    href={`/nextgen/richieste/${sentId}`}
                    className="flex min-h-[48px] items-center justify-center rounded-[12px] bg-trama-primary px-5 text-[15px] font-semibold text-white active:bg-trama-primary-press"
                  >
                    Apri la conversazione
                  </Link>
                )}
                <button type="button" onClick={close} className="flex min-h-[44px] items-center justify-center text-[15px] font-semibold text-trama-accent-ink">
                  Chiudi
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <h2 id="contact-sheet-title" className="font-poppins text-[20px] font-semibold text-ink">
                  {existingId ? "Continua la conversazione" : "Scrivi al centro"}
                </h2>
                <p className="text-[14.5px] leading-relaxed text-ink-2">
                  {existingId
                    ? "Hai già scritto per questa attività: il messaggio si aggiunge alla stessa conversazione."
                    : "Una domanda su questa attività: il centro ti risponde qui in app, nella stessa conversazione."}
                </p>
                {existingId && (
                  <Link href={`/nextgen/richieste/${existingId}`} className="self-start text-[14px] font-semibold text-trama-accent-ink">
                    Vedi la conversazione
                  </Link>
                )}
                <label htmlFor="contact-sheet-text" className="sr-only">
                  Messaggio
                </label>
                <textarea
                  id="contact-sheet-text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder="Es. Ci sono ancora posti per il ponte dell'8 dicembre?"
                  className="w-full resize-none rounded-2xl border border-trama-line bg-trama-page px-3.5 py-3 text-[16px] text-ink outline-none focus:border-trama-primary"
                />
                {error && (
                  <p role="alert" className="text-[13.5px] font-medium text-trama-orange">
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending}
                  className="flex min-h-[48px] items-center justify-center rounded-[12px] bg-trama-primary px-5 text-[15px] font-semibold text-white active:bg-trama-primary-press disabled:opacity-60"
                >
                  {sending ? "Invio…" : "Invia"}
                </button>
                <button type="button" onClick={close} className="flex min-h-[44px] items-center justify-center text-[15px] font-semibold text-ink-2">
                  Annulla
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {open && threads === false && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <>
                <div className="mb-1 text-sm font-bold text-ink">Richiesta inviata</div>
                <p className="mb-3 text-xs text-ink-2">
                  Il centro ti risponderà a breve — trovi la risposta in &quot;Le mie richieste&quot;,
                  dentro il tuo profilo.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="w-full rounded-md bg-sky px-4 py-2.5 text-sm font-bold text-white"
                >
                  Chiudi
                </button>
              </>
            ) : (
              <>
                <div className="mb-1 text-sm font-bold text-ink">Contatta il gestore</div>
                <p className="mb-2.5 text-xs text-ink-2">
                  Scrivi la tua domanda su questa attività — il centro ti risponde qui in app.
                </p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Es. Ci sono ancora posti per la settimana 6?"
                  className="mb-2.5 w-full resize-none rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
                />
                {error && <p className="mb-2 text-xs font-medium text-orange">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="flex-1 rounded-md border border-[#E8EBF0] px-4 py-2.5 text-sm font-semibold text-ink"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending}
                    className="flex-1 rounded-md bg-sky px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {sending ? "Invio…" : "Invia"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
