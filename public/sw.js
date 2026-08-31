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
    // Icona/badge riusano gli asset PWA già esistenti (manifest*.json),
    // nessun nuovo asset creato per questa feature.
    icon: "/icon-nextgen-192.png",
    badge: "/icon-nextgen-192.png",
    data: { url: data.deepLink || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tap sulla notifica di sistema -> apre/porta in primo piano una finestra già
// aperta sull'URL giusto se esiste, altrimenti ne apre una nuova. Stesso
// deepLink già usato dal notification center in-app (SEEN del banner di
// sistema è quindi indipendente dal cursore in-app — nota nota, vedi doc).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
