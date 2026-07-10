import { redirect } from "next/navigation";

// Le notifiche sono state unite dentro "Preferenze" (richiesto da Fabrizio,
// vedi ProfileSettingsSection.tsx e ProfilePreferencesSection.tsx) — questa
// pagina resta solo per non rompere eventuali link/segnalibri vecchi.
export default function GestoreNotifichePage() {
  redirect("/center/account/preferenze");
}
