import FamigliaHubClient from "./FamigliaHubClient";

// SPRINT CORRETTIVO (Fabrizio: "facciamo hub card se ha senso anche sulle
// altre sezioni") — le 4 righe intere che prima stavano direttamente nel
// Profilo sotto l'header "Famiglia" (Indirizzi/Famiglia/Condivisione
// piano/Promemoria) sono spostate qui, dietro UN solo ingresso da Profilo.
// Nessun dato nuovo: stessi 4 link di sempre, solo un livello di
// navigazione in più per alleggerire la lista principale di Profilo.
export default function FamigliaHubPage() {
  return <FamigliaHubClient />;
}
