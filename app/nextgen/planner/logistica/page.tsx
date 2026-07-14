import LogisticaClient from "./LogisticaClient";

// SPRINT CORRETTIVO — hub "Logistica & Famiglia": nessun dato server da
// caricare, solo link verso pagine esistenti (Indirizzi/Famiglia) e verso il
// Planner in modalita' Calendario (Condivisione piano) / la pagina LEGACY
// Prenotazioni. Vedi LogisticaClient.tsx per il contesto completo.
export default function LogisticaPage() {
  return <LogisticaClient />;
}
