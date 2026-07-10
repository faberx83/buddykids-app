"use client";

import { useState } from "react";
import { createInquiryAction } from "@/app/actions/inquiries";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// "Contatta il gestore" — richiesta da Fabrizio in ogni scheda attività:
// apre un piccolo modulo, invia un messaggio legato a QUESTA attività, che
// il centro vede in /center/richieste e a cui risponde una volta. La
// risposta torna visibile al genitore in "Le mie richieste" (/richieste,
// vedi ProfileSettingsSection/menu profilo). Ticketing semplice: un
// messaggio, una risposta — non una chat multi-turno.
export default function ContactCenterButton({ activityDbId }: { activityDbId?: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setSent(true);
  }

  function close() {
    setOpen(false);
    setMessage("");
    setSent(false);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-sky"
      >
        <i className="ti ti-message-circle-2 text-sm" />
        Contatta il gestore
      </button>

      {open && (
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
