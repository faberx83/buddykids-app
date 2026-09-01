"use client";

import { useEffect, useState } from "react";
import { isPushSupported, enablePushNotifications, hasBrowserPushSubscription } from "@/lib/push/client";
import { updatePreferencesAction } from "@/app/actions/profile";

// TRAMA — Push notifications, invito proattivo (01/09/2026, richiesto da
// Fabrizio: "mettiamo la spunta già di default su tutte le app"). Non è
// tecnicamente possibile attivare una vera subscription senza che la persona
// veda il prompt di permesso del browser (limite del browser, non nostro) —
// quello che si può fare è mostrare un invito esplicito in un momento
// naturale (Home/dashboard), invece di lasciare che la persona scopra da
// sola il toggle nascosto in Preferenze. Un solo componente condiviso per i
// 3 ruoli (genitore/partner/admin, stesso principio di BetaFeedbackButton
// appSource e NotificationCenter scope): la logica "quando mostrarlo" non
// dipende dal ruolo, solo dallo stato reale del browser corrente.
//
// Condizioni per mostrarlo (TUTTE devono essere vere):
//  1. Push supportate su questo browser (isPushSupported()).
//  2. VAPID configurate (altrimenti enablePushNotifications() fallirebbe
//     comunque con "non ancora configurate" — meglio non mostrare l'invito).
//  3. Notification.permission !== "denied" — se il browser ha già negato il
//     permesso in passato, richiederlo di nuovo non mostra alcun popup (il
//     browser risolve requestPermission() istantaneamente senza UI): il
//     nostro banner risulterebbe un pulsante che "non fa nulla di visibile",
//     peggio che non mostrarlo affatto. L'unico modo per rimediare è dalle
//     impostazioni del browser stesso, fuori dal nostro controllo.
//  4. Nessuna subscription reale già attiva su QUESTO device
//     (hasBrowserPushSubscription()) — altrimenti è già tutto attivo.
//  5. Non respinto di recente (localStorage, PROMPT_COOLDOWN_DAYS) — chiesto
//     esplicitamente da Fabrizio: "richiedi di nuovo dopo un po' di tempo"
//     invece di sparire per sempre al primo "Non ora", ma senza nemmeno
//     avvicinarsi a un popup ad ogni apertura (stesso principio "non
//     invadente" già seguito per gli altri banner dismissibili del progetto,
//     es. la finestra di 14 giorni di group_request_accepted in
//     coordination-signal.ts — stessa durata, per coerenza).
const PROMPT_COOLDOWN_DAYS = 14;
const DISMISS_STORAGE_KEY = "trama_push_prompt_dismissed_at";

function readDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null; // localStorage può lanciare in modalità privata/restrittiva — mai bloccante
  }
}

function writeDismissedAt(): void {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
  } catch {
    // best-effort: se non riusciamo a scrivere, il banner ricomparirà al
    // prossimo caricamento — non ideale ma mai un errore bloccante.
  }
}

export default function PushNotificationsPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkShouldShow() {
      if (!isPushSupported()) return;
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
      if (Notification.permission === "denied") return;

      const dismissedAt = readDismissedAt();
      if (dismissedAt && Date.now() - dismissedAt < PROMPT_COOLDOWN_DAYS * 86_400_000) return;

      const alreadySubscribed = await hasBrowserPushSubscription();
      if (alreadySubscribed || cancelled) return;

      setVisible(true);
    }

    checkShouldShow();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  async function handleEnable() {
    setBusy(true);
    setError(null);
    const result = await enablePushNotifications();
    setBusy(false);
    if (result.error) {
      setError(result.error);
      // Un tentativo fallito (es. permesso negato proprio ora) conta come
      // "respinto" ai fini del raffreddamento: non ha senso ripresentare lo
      // stesso invito alla prossima pagina vista nella stessa sessione.
      writeDismissedAt();
      return;
    }
    await updatePreferencesAction({ notifyPush: true });
    setVisible(false);
  }

  function handleDismiss() {
    writeDismissedAt();
    setVisible(false);
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#E8EBF0] bg-white p-3.5">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-trama-lilac/20">
        <i className="ti ti-bell-ringing text-lg text-trama-violet" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-ink">Attiva le notifiche push</div>
        <p className="mt-0.5 text-xs text-ink-2">
          Ricevi un avviso sul telefono per le cose importanti — niente da controllare a mano.
        </p>
        {error && <p className="mt-1.5 text-[11px] font-medium text-orange">{error}</p>}
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={handleEnable}
            disabled={busy}
            className="rounded-full bg-trama-violet px-3.5 py-1.5 text-xs font-bold text-white active:scale-[0.97] disabled:opacity-60"
          >
            {busy ? "Attivazione..." : "Attiva"}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={busy}
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink-2 active:bg-black/[0.04] disabled:opacity-60"
          >
            Non ora
          </button>
        </div>
      </div>
    </div>
  );
}
