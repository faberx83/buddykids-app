import { redirect } from "next/navigation";

// Le notifiche sono state unite dentro "Preferenze" (richiesto da Fabrizio:
// "le notifiche le metterei dentro le preferenze", vedi
// ProfileSettingsSection.tsx e ProfilePreferencesSection.tsx) — questa
// pagina resta solo per non rompere eventuali link/segnalibri vecchi.
export default function ProfileNotifichePage() {
  redirect("/profile/preferenze");
}
