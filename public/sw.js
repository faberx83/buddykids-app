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
