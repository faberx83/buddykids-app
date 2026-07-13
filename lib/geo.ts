// Calcolo distanza reale (formula haversine) fra due coordinate — usato per
// la geolocalizzazione in Home e Cerca, al posto del valore distanceKm
// statico che arriva dai dati (placeholder finché non c'è la posizione
// dell'utente).

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // raggio terrestre in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Lettura/scrittura della posizione rilevata in questa sessione del browser
// (sessionStorage, non DB — nessuna posizione viene salvata lato server).
// NOTA: HomeFeed.tsx e SearchClient.tsx (LEGACY) hanno ciascuno una propria
// copia locale IDENTICA di queste due funzioni, scritta prima che esistesse
// questo punto comune — non le abbiamo toccate per non rischiare
// regressioni su codice funzionante. Il nuovo codice NEXTGEN usa queste,
// centralizzate qui, per non introdurre una TERZA copia duplicata.
const GEO_STORAGE_KEY = "bk_last_geo";

export function readStoredGeo(): { lat: number; lng: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GEO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.lat === "number" && typeof parsed.lng === "number") return parsed;
  } catch {
    // storage non disponibile o dato corrotto: ignoriamo, si richiede di nuovo
  }
  return null;
}

export function writeStoredGeo(lat: number, lng: number): void {
  try {
    sessionStorage.setItem(GEO_STORAGE_KEY, JSON.stringify({ lat, lng }));
  } catch {
    // storage non disponibile (es. modalità privata): non blocchiamo l'uso
  }
}

// SPRINT 5.7 (NEXTGEN) — Ricerca: ripristino dei filtri LEGACY ("Zona" può
// essere azzerata come gli altri filtri). Aggiunta pura (nessuna funzione
// esistente modificata): SearchClient.tsx (LEGACY) continua a fare
// sessionStorage.removeItem(...) inline con la propria copia della chiave,
// invariato — questa funzione serve solo al nuovo codice NEXTGEN.
export function clearStoredGeo(): void {
  try {
    sessionStorage.removeItem(GEO_STORAGE_KEY);
  } catch {
    // storage non disponibile, non blocchiamo l'azione
  }
}
