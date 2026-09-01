// PLANNER BETA v1.1 (Wave 5, punto 25-26 della revisione) — unica source of
// truth per la versione Beta mostrata nell'app genitori. Verificato: prima
// di questa modifica non esisteva alcuna costante di versione — il ribbon
// "Beta" in components/nextgen/NextgenBadge.tsx era testo hardcoded senza
// numero di versione, e nessun'altra pagina mostrava un numero di versione.
// Per cambiare la versione visibile in futuro, modificare SOLO questa riga:
// nessuna altra stringa "v1.1" va disseminata nelle pagine (vedi
// NextgenBadge.tsx, unico consumer).
export const TRAMA_BETA_VERSION = "v1.1";
