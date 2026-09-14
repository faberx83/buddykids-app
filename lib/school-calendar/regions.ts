// TRAMA — SCHOOL CALENDAR INTELLIGENCE (14/09/2026) — riferimento statico
// (dato pubblico non personale, NON dato reale di un utente/account: le 20
// regioni italiane, usate SOLO per popolare il menu "Dove va a scuola?
// Regione" — §B3). Nessuna tabella dedicata: 20 valori fissi, un file di
// costanti è sufficiente e coerente con "non aggiungere infrastruttura non
// necessaria" (§B4/§B11 — stesso principio).
//
// STOP applicato correttamente (§B5): questo file NON contiene alcun dato
// specifico dell'account di Fabrizio o dei suoi bambini — è solo l'elenco
// ufficiale delle regioni italiane, identico per chiunque lo usi. La scelta
// di QUALE regione/comune usare per popolare school_calendars con dati reali
// resta interamente a Fabrizio (vedi report finale).
export const ITALIAN_REGIONS = [
  "Abruzzo",
  "Basilicata",
  "Calabria",
  "Campania",
  "Emilia-Romagna",
  "Friuli-Venezia Giulia",
  "Lazio",
  "Liguria",
  "Lombardia",
  "Marche",
  "Molise",
  "Piemonte",
  "Puglia",
  "Sardegna",
  "Sicilia",
  "Toscana",
  "Trentino-Alto Adige",
  "Umbria",
  "Valle d'Aosta",
  "Veneto",
] as const;

export type ItalianRegion = (typeof ITALIAN_REGIONS)[number];

export function isKnownItalianRegion(value: string): value is ItalianRegion {
  return (ITALIAN_REGIONS as readonly string[]).includes(value);
}
