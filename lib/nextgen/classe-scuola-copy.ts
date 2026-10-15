// TRAMA — "CLASSE E SCUOLA" (15/10/2026, risposta di Fabrizio al dubbio 4:
// "Va bene classe e scuola"). Con la nuova barra la vecchia "Community"
// prende un nome che una famiglia capisce subito: il giro dei genitori di una
// classe o di una scuola, dove ci si propongono attività. Cambia SOLO il
// testo: stesse tabelle (communities…), stesse azioni, stesse rotte
// (/nextgen/community). Legacy e barra attuale restano con "Community".
//
// Differenza con i GRUPPI (da tenere coerente nei testi):
//   - Classe e scuola = un giro stabile di famiglie che si conoscono
//     (classe, scuola, quartiere), dura tutto l'anno, serve a proporre e
//     scoprire attività insieme;
//   - Gruppo = poche famiglie che si iscrivono INSIEME a UNA attività
//     ("Andiamo insieme": sconto, passaggi). Nasce da una prenotazione
//     condivisa o da una proposta fatta in Classe e scuola.

export const CLASSE_SCUOLA_COPY = {
  title: "Classe e scuola",
  intro:
    "I genitori della classe o della scuola dei tuoi figli: vi proponete attività e vedete chi è interessato. I Gruppi, invece, sono le poche famiglie che si iscrivono insieme a un'attività.",
  sectionTitle: "Classe e scuola",
  create: "Crea nuova",
  createTitle: "Crea la classe o la scuola",
  namePlaceholder: "Nome (es. 2ª B Scuola Manzoni)",
  empty:
    "Non sei ancora in nessuna classe o scuola. Creala tu per i genitori della classe di tuo figlio, oppure entra con il codice che ti hanno mandato.",
  plannerEmpty:
    "Non sei ancora in nessuna classe o scuola: serve per proporre attività agli altri genitori.",
  groupsEmptyOrigin: "una proposta in Classe e scuola",
  proposalsTitle: "Attività proposte",
  toastCreated: "Fatto! Invita gli altri genitori con il codice.",
  toastJoined: "Ci sei! Ora vedi le attività proposte.",
  toastAlreadyIn: "Ne fai già parte.",
  toastProposed: "Proposta condivisa con gli altri genitori!",
} as const;
