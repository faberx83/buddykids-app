import PromemoriaClient from "./PromemoriaClient";

// SPRINT CORRETTIVO (Fabrizio: "non abbiamo messo da nessuna parte la
// sezione Promemoria e avvisi, come da screenshot — possiamo pensare a dove
// inserirlo? anche tutto stubbato se vuoi come next release") — verificato
// che nessuna pagina esistente copriva questo screenshot (lib/nextgen/
// reminders.ts produce solo gli alert testuali del Planner, mai stata una
// UI di impostazioni utente). Aggiunta come nuova sezione di Profilo, stesso
// livello di Indirizzi/Famiglia/Condivisione piano — vedi
// ProfileNextgenClient.tsx. Nessun dato reale da leggere: è un'anteprima
// (DemoBadge), le preferenze restano solo in memoria finché non arriverà la
// vera integrazione con le notifiche push.
export default function PromemoriaPage() {
  return <PromemoriaClient />;
}
