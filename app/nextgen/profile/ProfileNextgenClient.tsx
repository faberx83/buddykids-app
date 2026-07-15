"use client";

import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import LogoutButton from "@/components/LogoutButton";
import ProfileHeaderClient from "@/components/ProfileHeaderClient";
import ProfileKidsSection from "@/components/ProfileKidsSection";
import HubCard from "@/components/nextgen/HubCard";
import type { ParentRole, Gender } from "@/lib/data/profile";
import type { Kid } from "@/lib/types";

// SPRINT 6 (NEXTGEN) — ultimo dei 6 sprint richiesti da Fabrizio ("redesign
// Profilo away from legacy"): /profile era rimasto 100% LEGACY (header
// gradiente, MenuItem con bordo, nessun PageHeader/icona brand) mentre tutto
// il resto di NEXTGEN (Planner/Scopri/Community) era già stato ridisegnato.
// Riusa i DATI e la LOGICA di sempre (ProfileHeaderClient, ProfileKidsSection
// — accent="violet", opt-in, vedi quei file — nessuna nuova query), cambia
// solo il contenitore visivo: PageHeader con icona brand invece del gradiente,
// card bianche stondate (stesso linguaggio di HubCard in Logistica) invece
// di MenuItem con bordo.
//
// "Condivisione Piano potrebbe diventare un'impostazione qui" (richiesta di
// Fabrizio): aggiunta una card "Piano condiviso" che porta allo stesso posto
// della card equivalente nell'hub Logistica (/nextgen/planner?mode=calendario
// — la UI di condivisione vive ancora dentro PlannerCalendarView, Sprint
// 5.3) — non duplicata, stesso link, solo raggiungibile anche da qui.
//
// SPRINT CORRETTIVO (Fabrizio, dopo aver discusso se "Famiglia" meritasse di
// essere promossa in bottom nav accanto a Planner/Scopri: no, restano
// impostazioni "una tantum" — ma la discussione ha fatto notare che 4 righe
// intere sotto un solo header pesano comunque troppo in questa lista) —
// HubCard estratto in components/nextgen/HubCard.tsx (ora condiviso con le
// nuove sotto-pagine). Le sezioni "Famiglia" e "Impostazioni" sono
// consolidate a un solo ingresso ciascuna; "Attività" e "Supporto" restano
// invariate: sono destinazioni toccate con una certa regolarità (prenotare,
// controllare i preferiti, scrivere al centro), non impostazioni "si
// configura una volta e non si tocca più" come indirizzi/inviti/promemoria
// o sicurezza/preferenze/privacy.


export default function ProfileNextgenClient({
  fullName,
  email,
  parentRole,
  avatarUrl,
  phone,
  dateOfBirth,
  gender,
  kids,
  unreadReplies,
  autoOpenEdit,
  autoOpenAddKid,
}: {
  fullName: string;
  email: string;
  parentRole: ParentRole | null;
  avatarUrl?: string | null;
  phone: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  kids: Kid[];
  unreadReplies: number;
  autoOpenEdit: boolean;
  autoOpenAddKid: boolean;
}) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Profilo" onBack={() => router.push("/nextgen")} showBrandIcon />

      <div className="px-5 pt-4">
        <div className="rounded-2xl bg-white p-4">
          <ProfileHeaderClient
            initialFullName={fullName}
            initialParentRole={parentRole}
            initialAvatarUrl={avatarUrl}
            email={email}
            autoOpenEdit={autoOpenEdit}
            initialPhone={phone}
            initialDateOfBirth={dateOfBirth}
            initialGender={gender}
            accent="violet"
          />
        </div>
      </div>

      <ProfileKidsSection initialKids={kids} autoOpenAddKid={autoOpenAddKid} accent="violet" />

      <div className="flex flex-col gap-2.5 px-5 pt-2">
        <div className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Attività</div>
        <HubCard
          href="/prenotazioni"
          icon="ti-ticket"
          iconBg="#E8F6FD"
          iconColor="#4DAFEF"
          title="Le mie prenotazioni"
          subtitle="Elenco delle tue prenotazioni"
        />
        <HubCard
          href="/preferiti"
          icon="ti-heart"
          iconBg="#FFF8E7"
          iconColor="#c49a00"
          title="Preferiti"
          subtitle="Attività salvate"
        />
        <HubCard
          href="/presenze"
          icon="ti-clipboard-check"
          iconBg="#E3F9F5"
          iconColor="#2DBA8C"
          title="Le presenze"
          subtitle="Storico presenze, ritardi e assenze per i tuoi bambini"
        />

        {/* SPRINT 7 (feedback Fabrizio: "Logistica e Famiglia non devono
            diventare una sezione ad hoc?") — Indirizzi/Famiglia/Condivisione
            piano/Promemoria vivevano prima in un hub separato raggiungibile
            da un link in fondo al Planner (/nextgen/planner/logistica, ora
            eliminato, redirect qui). Sono impostazioni che si toccano di
            rado (si configurano una volta, non si rivedono ogni settimana
            come Chi fa cosa nel Calendario, che resta li').
            SPRINT CORRETTIVO — consolidate a un solo ingresso (vedi
            /nextgen/profile/famiglia/FamigliaHubClient.tsx per i 4 link
            originali, invariati): 4 righe intere sotto un solo header
            davano lo stesso peso visivo di intere destinazioni come
            Planner/Scopri, ma sono solo impostazioni minori. */}
        <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">Famiglia</div>
        <HubCard
          href="/nextgen/profile/famiglia"
          icon="ti-users"
          iconBg="#F0EEFF"
          iconColor="#6F63C5"
          title="Famiglia e logistica"
          subtitle="Indirizzi, condivisione piano, promemoria"
        />

        <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">Supporto</div>
        <HubCard
          href="/richieste"
          icon="ti-message-circle"
          iconBg="#F4F6FA"
          iconColor="#6B7280"
          title="Le mie richieste"
          subtitle="Messaggi ai centri e risposte ricevute"
          badge={unreadReplies}
        />
        <HubCard
          icon="ti-file-invoice"
          iconBg="#F4F6FA"
          iconColor="#6B7280"
          title="Ricevute e fatture"
          comingSoon
        />

        {/* SPRINT CORRETTIVO — stesso ragionamento di "Famiglia" sopra:
            Sicurezza/Preferenze/Metodi di pagamento/Privacy sono
            impostazioni account "una tantum", consolidate a un solo
            ingresso (vedi /nextgen/profile/impostazioni/ImpostazioniHubClient.tsx
            per i 4 link originali, invariati). */}
        <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">Impostazioni</div>
        <HubCard
          href="/nextgen/profile/impostazioni"
          icon="ti-settings"
          iconBg="#F4F6FA"
          iconColor="#6B7280"
          title="Impostazioni"
          subtitle="Sicurezza, preferenze, privacy"
        />
      </div>

      <LogoutButton />
      <div className="h-4" />
    </div>
  );
}
