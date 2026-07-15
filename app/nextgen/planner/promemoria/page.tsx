import { getParentAddresses } from "@/lib/data/addresses";
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
//
// SPRINT CORRETTIVO 2 (Fabrizio: "'Partenza consigliata' deve prevedere
// selezione dell'indirizzo di partenza") — riusa getParentAddresses() (già
// usato da /nextgen/planner/indirizzi, INVARIATO) per far scegliere al
// genitore DA QUALE indirizzo salvato calcolare la partenza, invece di un
// esempio fisso senza contesto. Nessuna nuova query: stessa fonte dati,
// stesso modello a 4 slot fissi (Casa/Lavoro Genitore 1/Lavoro Genitore
// 2/Altro). La scelta resta solo in memoria (stesso limite dichiarato di
// tutta questa pagina anteprima).
export default async function PromemoriaPage() {
  const addresses = await getParentAddresses();
  return <PromemoriaClient addresses={addresses} />;
}
