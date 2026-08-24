import SicurezzaView from "@/components/SicurezzaView";

// Sotto-pagina dedicata "Sicurezza" (dentro Impostazioni) — prima era una
// sezione sempre visibile in linea nel profilo, ora una pagina propria
// raggiunta dal menu Impostazioni (vedi ProfileSettingsSection).
//
// TRAMA ONE (24/08/2026) — JSX estratto in components/SicurezzaView.tsx per
// essere riusato anche dal guscio NEXTGEN-native, stesso pattern di "Le mie
// prenotazioni" (task #524).
export default function ProfileSicurezzaPage() {
  return <SicurezzaView />;
}
