import PreferenzeView from "@/components/PreferenzeView";

// Sotto-pagina dedicata "Preferenze" (dentro Impostazioni) — include anche
// le notifiche (unite qui su richiesta di Fabrizio, vedi
// ProfileSettingsSection.tsx e ProfilePreferencesSection.tsx).
//
// TRAMA ONE (24/08/2026) — JSX estratto in components/PreferenzeView.tsx per
// essere riusato anche dal guscio NEXTGEN-native, stesso pattern di "Le mie
// prenotazioni" (task #524).
export default function ProfilePreferenzePage() {
  return <PreferenzeView />;
}
