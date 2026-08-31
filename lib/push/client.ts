// TRAMA — Push notifications (31/08/2026), lato browser. Nessuna
// "server-only" qui apposta (simmetrico a lib/notifications/seen-cursor.ts):
// queste funzioni usano API SOLO disponibili in un Client Component
// (navigator.serviceWorker, PushManager, Notification) — chiamarle da un
// Server Component è un errore di chi le importa, non qualcosa che questo
// modulo deve impedire a build-time (non tocca dati sensibili come
// lib/supabase/service.ts, quindi non serve la stessa barriera rigida).
import { subscribeToPushAction, unsubscribeFromPushAction } from "@/app/actions/push-subscriptions";

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// Conversione richiesta dalla Push API: pushManager.subscribe() vuole
// applicationServerKey come Uint8Array, non come la stringa base64url che
// NEXT_PUBLIC_VAPID_PUBLIC_KEY espone — implementazione standard (identica
// in ogni guida Web Push), nessuna libreria dedicata solo per questo.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Richiede il permesso del browser (se non già concesso/negato) e crea la
// subscription — chiamata SOLO da un'azione esplicita dell'utente (toggle
// "Notifiche push" in ProfilePreferencesSection.tsx), mai automaticamente al
// caricamento di una pagina: il prompt di permesso del browser va mostrato
// solo quando la persona ha appena detto "sì, voglio le notifiche".
export async function enablePushNotifications(): Promise<{ error?: string }> {
  if (!isPushSupported()) return { error: "Le notifiche push non sono supportate su questo browser/dispositivo." };

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return { error: "Notifiche push non ancora configurate." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { error: permission === "denied" ? "Permesso negato dal browser." : "Permesso non concesso." };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // Cast a BufferSource: la lib.dom.d.ts più recente tipizza
      // Uint8Array come generico su ArrayBufferLike (include
      // SharedArrayBuffer), più stretto di quanto PushManager.subscribe
      // dichiari — stesso identico valore a runtime, solo un disallineamento
      // di tipi tra due definizioni standard del browser.
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { error: "Subscription non valida (mancano endpoint o chiavi)." };
    }
    const result = await subscribeToPushAction({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    return result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Errore durante l'iscrizione alle notifiche push." };
  }
}

// Disiscrive QUESTO device sia dal browser (pushManager) sia dal server
// (riga push_subscriptions) — entrambi, non solo uno dei due: lasciare la
// riga server senza disiscrivere il browser continuerebbe a mostrare push
// che l'utente ha appena detto di non volere più; il contrario lascerebbe
// una riga orfana che il server tenterebbe comunque di usare (fallirebbe al
// primo invio e si autopulirebbe, ma solo dopo un tentativo inutile).
export async function disablePushNotifications(): Promise<{ error?: string }> {
  if (!isPushSupported()) return {};
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return {};
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    return await unsubscribeFromPushAction(endpoint);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Errore durante la disiscrizione dalle notifiche push." };
  }
}
