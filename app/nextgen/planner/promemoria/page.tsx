import { getParentAddresses } from "@/lib/data/addresses";
import { getTravelReminderForParent } from "@/lib/data/travel-reminders";
import PromemoriaClient from "./PromemoriaClient";

// SPRINT CORRETTIVO (Fabrizio: "non abbiamo messo da nessuna parte la
// sezione Promemoria e avvisi, come da screenshot — possiamo pensare a dove
// inserirlo? anche tutto stubbato se vuoi come next release") — verificato
// che nessuna pagina esistente copriva questo screenshot (lib/nextgen/
// reminders.ts produce solo gli alert testuali del Planner, mai stata una
// UI di impostazioni utente). Aggiunta come nuova sezione di Profilo, stesso
// livello di Indirizzi/Famiglia/Condivisione piano — vedi
// ProfileNextgenClient.tsx.
//
// SPRINT CORRETTIVO 2 (Fabrizio: "'Partenza consigliata' deve prevedere
// selezione dell'indirizzo di partenza") — riusa getParentAddresses() (già
// usato da /nextgen/planner/indirizzi, INVARIATO) per far scegliere al
// genitore DA QUALE indirizzo salvato calcolare la partenza, invece di un
// esempio fisso senza contesto. Nessuna nuova query: stessa fonte dati,
// stesso modello a 4 slot fissi (Casa/Lavoro Genitore 1/Lavoro Genitore
// 2/Altro).
//
// SPRINT CORRETTIVO 3 (Fabrizio 03/09/2026: "possiamo attivare i reminder
// ora che ci sono le notifiche?") — non più solo anteprima: le preferenze
// sono ora persistite davvero (vedi supabase/migration_36_travel_reminders.sql,
// NON ANCORA APPLICATA — getTravelReminderForParent() degrada da sola ai
// default finché Fabrizio non la applica, nessuna rottura). L'orario di
// partenza resta impostato MANUALMENTE dal genitore (mai calcolato da un
// tempo di percorrenza reale — scope concordato per la beta, vedi commento
// nella migration).
export default async function PromemoriaPage() {
  const [addresses, initial] = await Promise.all([getParentAddresses(), getTravelReminderForParent()]);
  return <PromemoriaClient addresses={addresses} initial={initial} />;
}
