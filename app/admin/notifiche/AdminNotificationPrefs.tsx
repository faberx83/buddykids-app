"use client";

// TRAMA — Admin → Le mie notifiche (20/11/2026). Interruttori come per
// genitori e centri (components/ProfilePreferencesSection.tsx): la push si
// attiva sul dispositivo e salva notify_push; l'email salva notify_email.

import { useEffect, useState } from "react";
import { updatePreferencesAction } from "@/app/actions/profile";
import { disablePushNotifications, enablePushNotifications, hasBrowserPushSubscription } from "@/lib/push/client";

export default function AdminNotificationPrefs({ initialNotifyPush, initialNotifyEmail }: { initialNotifyPush: boolean; initialNotifyEmail: boolean }) {
  const [push, setPush] = useState(initialNotifyPush);
  const [thisDevice, setThisDevice] = useState<boolean | null>(null);
  const [email, setEmail] = useState(initialNotifyEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    hasBrowserPushSubscription().then((active) => {
      if (!cancelled) setThisDevice(active);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function togglePush(next: boolean) {
    setError(null);
    setSaved(null);
    setBusy(true);
    if (next) {
      const r = await enablePushNotifications();
      if (r.error) {
        setBusy(false);
        setError(r.error);
        return;
      }
      setThisDevice(true);
    }
    // Spegnere vale per tutti i dispositivi (notify_push=false): nessuna push arriva più.
    const res = await updatePreferencesAction({ notifyPush: next });
    setBusy(false);
    if (res.error) return setError(res.error);
    setPush(next);
    setSaved(next ? "Notifiche push accese." : "Notifiche push spente su tutti i dispositivi.");
  }

  async function disableThisDevice() {
    setError(null);
    setSaved(null);
    setBusy(true);
    const r = await disablePushNotifications();
    setBusy(false);
    if (r.error) return setError(r.error);
    setThisDevice(false);
    setSaved("Questo dispositivo non riceve più notifiche. Gli altri sì.");
  }

  async function toggleEmail(next: boolean) {
    setError(null);
    setSaved(null);
    setBusy(true);
    const res = await updatePreferencesAction({ notifyEmail: next });
    setBusy(false);
    if (res.error) return setError(res.error);
    setEmail(next);
    setSaved(next ? "Resoconto settimanale via email acceso." : "Resoconto settimanale via email spento.");
  }

  const row = "flex items-start justify-between gap-4 border-b border-[#F0F2F5] px-4 py-3 last:border-0";
  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className={row}>
          <div>
            <p className="text-sm font-bold text-ink">Notifiche push</p>
            <p className="mt-0.5 text-xs text-ink-2">
              Subito: registrazioni e nuovi account, segnalazioni beta, prenotazioni, prime richieste ai centri, richieste d&apos;invito,
              problemi di accesso, candidature dei centri. Alle 7: &quot;Ieri su TRAMA&quot;, solo se è successo qualcosa.
            </p>
            <p className="mt-1 text-[11px] text-ink-3" data-testid="admin-push-device">
              {thisDevice === null ? "" : thisDevice ? "Questo dispositivo è attivo." : "Questo dispositivo non è attivo: accendi per riceverle anche qui."}
              {thisDevice && push && (
                <button type="button" disabled={busy} onClick={disableThisDevice} className="ml-1 font-semibold text-sky underline">
                  Disattiva solo qui
                </button>
              )}
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-ink">
            <input type="checkbox" checked={push} disabled={busy} onChange={(e) => togglePush(e.target.checked)} data-testid="admin-notify-push" />
            {push ? "Accese" : "Spente"}
          </label>
        </div>
        <div className={row}>
          <div>
            <p className="text-sm font-bold text-ink">Resoconto settimanale via email</p>
            <p className="mt-0.5 text-xs text-ink-2">
              Il Beta Report con i numeri della settimana e gli avvisi degli ultimi 7 giorni. Giorno e ora si scelgono in Beta Famiglie → Report.
              Per i singoli eventi nessuna email.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-ink">
            <input type="checkbox" checked={email} disabled={busy} onChange={(e) => toggleEmail(e.target.checked)} data-testid="admin-notify-email" />
            {email ? "Accesa" : "Spenta"}
          </label>
        </div>
      </div>
      {error && <p className="text-xs text-[#C0392B]">{error}</p>}
      {saved && <p className="text-xs text-[#2d8f52]">{saved}</p>}
      <p className="text-[11px] text-navy-text2">
        Anche richieste d&apos;invito, problemi di accesso e candidature dei centri arrivano solo come push. Per riavere un&apos;email per ogni evento:
        variabile <code>ADMIN_ALERTS_EVENT_EMAILS=on</code> su Vercel.
      </p>
    </div>
  );
}
