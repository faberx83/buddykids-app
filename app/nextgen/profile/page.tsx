import ProfileNextgenClient from "./ProfileNextgenClient";
import { getKidsForUser } from "@/lib/data/kids";
import { getParentProfile } from "@/lib/data/profile";
import { getUnreadRepliesCountForParent } from "@/lib/data/inquiries";

// SPRINT 6 (NEXTGEN) — stessi data-loader del profilo LEGACY
// (app/(main)/profile/page.tsx), nessuna nuova query: solo un nuovo punto di
// ingresso NEXTGEN che passa gli stessi dati a un componente client
// ridisegnato (ProfileNextgenClient).
//
// NOTA (tradeoff accettato, stesso principio già in uso per il link
// "Prenotazioni" della bottom nav NEXTGEN): le pagine di destinazione delle
// card qui sotto — Sicurezza/Preferenze/Privacy (ProfileSettingsSection),
// Le mie prenotazioni, Preferiti, Le presenze, Le mie richieste — sono
// ancora tutte LEGACY con <PageHeader backHref="/profile"> fisso: uscendo da
// una di esse il tasto Indietro riporta al profilo LEGACY invece che qui.
// Nessuna di queste pagine viene toccata in questo sprint (fuori scope:
// "redesign Profilo", non redesign di ogni sua destinazione) — un restyle
// di quelle pagine è la naturale prossima opportunità (vedi riepilogo).
export default async function NextgenProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ complete?: string; addKid?: string }>;
}) {
  const [profile, kids, params, unreadReplies] = await Promise.all([
    getParentProfile(),
    getKidsForUser(),
    searchParams,
    getUnreadRepliesCountForParent(),
  ]);

  return (
    <ProfileNextgenClient
      fullName={profile.fullName}
      email={profile.email}
      parentRole={profile.parentRole}
      avatarUrl={profile.avatarUrl}
      phone={profile.phone}
      dateOfBirth={profile.dateOfBirth}
      gender={profile.gender}
      kids={kids}
      unreadReplies={unreadReplies}
      autoOpenEdit={params.complete === "1"}
      autoOpenAddKid={params.addKid === "1"}
    />
  );
}
