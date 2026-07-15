import ImpostazioniHubClient from "./ImpostazioniHubClient";

// SPRINT CORRETTIVO (Fabrizio: "facciamo hub card se ha senso anche sulle
// altre sezioni") — stesso trattamento della sezione Famiglia: le 4 righe
// intere sotto l'header "Impostazioni" (Sicurezza/Preferenze/Metodi di
// pagamento/Privacy) sono impostazioni account "una tantum", stesso
// identico ragionamento già fatto per Famiglia (si toccano di rado, non
// servono in cima alla lista). Consolidate dietro un solo ingresso.
export default function ImpostazioniHubPage() {
  return <ImpostazioniHubClient />;
}
