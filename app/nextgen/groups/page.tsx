import GroupsClient from "@/components/GroupsClient";
import { getGroupsForUser, getPublicGroups, getMyGroupInvites } from "@/lib/data/groups";

// TRAMA ONE (24/08/2026) — guscio NEXTGEN-native per "Gruppi & Community",
// stesso pattern di app/nextgen/prenotazioni (task #524): chiude il gap più
// grave del rimando legacy segnalato da Fabrizio — da qui in poi un genitore
// NEXTGEN che entra in Gruppi non finisce più dentro il layout/bottom-nav
// LEGACY (vedi components/BottomNav.tsx, "/groups" è una voce primaria
// LEGACY). basePath="/nextgen/groups" fa sì che creazione gruppo, "Unisciti"
// da Scopri e accettazione inviti restino tutte dentro NEXTGEN.
//
// nextgen (01/09/2026, segnalazione Fabrizio "grafica legacy" in Gruppi):
// GroupsClient era riusato COSÌ COM'ERA (accento sky/orange) — ora
// nextgen=true attiva la variante violetta/Poppins su tab bar, "+Nuovo",
// "Crea gruppo", "Unisciti" e "Accetta", stesso principio di
// GroupDetailClient.tsx. Legacy (app/(main)/groups/page.tsx, nessuna
// prop nextgen) resta invariato.
export default async function NextgenGroupsPage({
  searchParams,
}: {
  // TRAMA — Wave 3 (Notifiche): "tab=inviti" arriva dal deep link di un
  // item del Notification Center ("Sei stato invitato al gruppo...") — apre
  // direttamente la tab "Inviti" invece di "I miei gruppi" (indice di default).
  //
  // TRAMA BETA v1.1.1 (FINAL FUNCTIONAL + UI CONSISTENCY FIXES, punto 4) —
  // segnalazione: "Planner → tab Gruppi → Gruppi & Community → Back" riportava
  // sempre a Planner/Organizzazione (backHref hardcoded "/nextgen/planner",
  // che apre sempre la tab di default). "from" arriva come query string da
  // PlannerGroupsView.tsx (link "Vedi tutti"/card diretta) quando l'origine è
  // davvero la tab Gruppi del Planner — nessun hack su browser history, stessa
  // convenzione già in uso per "tab" qui sopra. Se "from" non è
  // "planner-gruppi" (o assente), comportamento INVARIATO: GroupsClient
  // ricade sul backHref statico "/nextgen/planner" passato sotto.
  searchParams: Promise<{ tab?: string; from?: string }>;
}) {
  const [groups, publicGroups, invites, params] = await Promise.all([
    getGroupsForUser(),
    getPublicGroups(),
    getMyGroupInvites(),
    searchParams,
  ]);
  return (
    <GroupsClient
      initialGroups={groups}
      initialPublicGroups={publicGroups}
      initialInvites={invites}
      basePath="/nextgen/groups"
      backHref="/nextgen/planner"
      backContext={params.from}
      showBrandIcon
      initialTab={params.tab === "inviti" ? 2 : undefined}
      nextgen
    />
  );
}
