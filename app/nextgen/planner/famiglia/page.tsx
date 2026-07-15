import { getFamilyForUser } from "@/lib/data/family";
import { getFamilyInvitePreviewAction } from "@/app/actions/family";
import FamigliaClient from "./FamigliaClient";

// SPRINT 5.5 (NEXTGEN) — Profilo Famiglia multi-genitore: pagina per creare
// una famiglia, invitare un secondo genitore (codice), vedere i membri, o
// entrare/uscire. Raggiungibile dal Planner (Organizzazione) — vedi
// PlannerClient.tsx, stesso trattamento del link "Indirizzi di famiglia".
//
// INVITO VIA EMAIL (segnalato da Fabrizio: "il solo codice non è
// sufficiente") — il link nell'email porta qui con ?accept=TOKEN (via
// /auth/login?next=..., già gestito da LoginForm.tsx per loggati e non).
// L'anteprima è letta lato server (get_family_invite_preview, pubblica) così
// il prompt "Sei stato invitato da X" appare subito, senza flash client-side.
export default async function FamigliaPage({
  searchParams,
}: {
  searchParams: Promise<{ accept?: string }>;
}) {
  const { accept } = await searchParams;
  const [family, invitePreview] = await Promise.all([
    getFamilyForUser(),
    accept ? getFamilyInvitePreviewAction(accept) : Promise.resolve(null),
  ]);
  return <FamigliaClient initialFamily={family} acceptToken={accept || null} invitePreview={invitePreview} />;
}
