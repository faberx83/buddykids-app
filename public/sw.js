// Service worker minimo — Chrome/Android richiede un service worker con un
// gestore "fetch" registrato prima di considerare la PWA installabile e
// mostrare il prompt di installazione (beforeinstallprompt). Nessuna cache
// applicativa qui: passthrough diretto alla rete, così ogni deploy nuovo è
// visibile subito, senza contenuti vecchi bloccati in cache.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Nessuna intercettazione reale: Chrome richiede solo che un gestore
// "fetch" sia REGISTRATO per considerare la PWA installabile — non è
// obbligatorio che risponda o rifaccia le richieste. Il primo tentativo
// (passthrough con "event.respondWith(fetch(event.request))") sembrava
// innocuo ma ha causato due bug reali: il manifest veniva rifiutato da
// Chrome come "non valido" (probabilmente per via di come la risposta
// ricostruita perde alcuni header), e le richieste di navigazione (il
// caricamento della pagina stessa) fallivano con "Failed to fetch", perché
// i browser non permettono di rifare il fetch() di una richiesta in
// modalità "navigate" così com'è. Non intercettare nulla evita entrambi i
// problemi, mantenendo comunque l'installabilità.
self.addEventListener("fetch", () => {});

// Push notifications (31/08/2026) — payload inviato da lib/push/send.ts
// (server, via web-push+VAPID). Un solo service worker serve TUTTI gli
// scope registrati (Legacy "/", Parent "/nextgen", Partner — stesso file
// fisico /sw.js per tutti, vedi InstallPrompt.tsx): questi due listener sono
// quindi condivisi, nessuna variante per ruolo. Il deepLink arriva già
// pronto dal server (stesso NotificationItem.deepLink del notification
// center in-app — STESSA fonte, non un secondo sistema di link).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Payload non-JSON o assente: notifica minima invece di far fallire
    // silenziosamente l'intero evento push.
    data = {};
  }
  const title = data.title || "TRAMA";
  const options = {
    body: data.body || "",
    // Icona grande (mostrata nel corpo della notifica espansa): riusa
    // l'asset PWA già esistente, va bene a colori pieni.
    icon: "/icon-nextgen-192.png",
    // Badge (l'iconcina in barra di stato Android): segnalato da Fabrizio
    // il 01/09/2026, "non vedo alcuna icona, solo scorrendo dall'alto trovo
    // la notifica" — icon-nextgen-192.png è RGB SENZA canale alpha (nessuna
    // trasparenza), e Android/Chrome richiedono un'immagine monocromatica
    // CON trasparenza reale per ricavare la silhouette del badge: senza
    // alpha non mostra nulla in barra di stato, pur mostrando comunque la
    // notifica nel pannello a tendina (esattamente il sintomo osservato).
    // push-badge-96.png è generato dal logo "trama" (public/icon-nextgen-
    // 512.png): sfondo bianco reso trasparente, tratti colorati ricolorati
    // in bianco pieno — vera silhouette monocromatica, unica per tutti i
    // ruoli (stesso principio "un solo service worker per tutti gli scope"
    // già usato sopra, nessuna variante badge per Legacy/Parent/Partner).
    badge: "/push-badge-96.png",
    // TRAMA — Push check-in: azioni rapide (11/09/2026). actionUrls (non un
    // campo standard della Notification API, solo il nostro modo di portare
    // i link firmati fino a notificationclick) resta dentro `data`, mai
    // dentro `actions` stesso (che la Notification API mostra letteralmente
    // come bottoni — deve contenere SOLO {action, title}, vedi
    // lib/push/send.ts::PushPayload).
    data: { url: data.deepLink || "/", actionUrls: data.actionUrls || null },
  };
  // Presente solo per alcuni eventi (oggi: check-in con un solo bambino
  // pendente) — quando assente, la notifica è identica a prima di questo
  // cambiamento (nessun bottone, comportamento invariato).
  if (Array.isArray(data.actions) && data.actions.length > 0) {
    options.actions = data.actions;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tap sulla notifica di sistema -> apre/porta in primo piano una finestra già
// aperta sull'URL giusto se esiste, altrimenti ne apre una nuova. Stesso
// deepLink già usato dal notification center in-app (SEEN del banner di
// sistema è quindi indipendente dal cursore in-app — nota nota, vedi doc).
self.addEventListener("notificationclick", (event) => {
  const clickedAction = event.action; // "" se il tap è sul corpo, non su un bottone azione
  const notificationData = event.notification.data || {};
  event.notification.close();

  // TRAMA — Push check-in: azioni rapide (11/09/2026). Tap su un bottone
  // azione (es. "Sì"/"In ritardo"/"No") -> chiama SUBITO il link firmato
  // (lib/checkin/action-token.ts, app/api/checkin/quick-action/route.ts),
  // SENZA aprire alcuna finestra: vera azione rapida, zero tap in app. Se la
  // richiesta fallisce (rete assente, token scaduto, ecc.) ripiega
  // sull'apertura dell'app — il genitore non resta mai senza un modo di
  // completare il check-in.
  if (clickedAction && notificationData.actionUrls && notificationData.actionUrls[clickedAction]) {
    const actionUrl = notificationData.actionUrls[clickedAction];
    event.waitUntil(
      fetch(actionUrl, { method: "POST" })
        .then((res) => {
          if (!res.ok) throw new Error("azione rapida check-in fallita");
          return self.registration.showNotification("Check-in registrato", {
            body: "Grazie, abbiamo salvato la tua risposta.",
            icon: "/icon-nextgen-192.png",
            badge: "/push-badge-96.png",
          });
        })
        .catch(() => {
          const fallbackUrl = notificationData.url || "/";
          return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
              if (client.url.includes(fallbackUrl) && "focus" in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow(fallbackUrl);
          });
        })
    );
    return;
  }

  // Tap sul corpo della notifica (nessun bottone azione): comportamento
  // invariato rispetto a prima di questo cambiamento.
  const url = notificationData.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
