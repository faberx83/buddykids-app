"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import LogoutButton from "@/components/LogoutButton";
import ProfileHeaderClient from "@/components/ProfileHeaderClient";
import ProfileKidsSection from "@/components/ProfileKidsSection";
import { ComingSoonBadge } from "@/components/StatusBadge";
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
function HubCard({
  href,
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  badge,
  comingSoon,
}: {
  href?: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  badge?: number;
  comingSoon?: boolean;
}) {
  const content = (
    <div className={`flex items-center gap-3 rounded-2xl bg-white p-4 ${comingSoon ? "opacity-60" : ""}`}>
      <div
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[19px]"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        <i className={`ti ${icon}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink">
          {title}
          {comingSoon && <ComingSoonBadge />}
        </div>
        {subtitle && <div className="text-[11.5px] text-ink-2">{subtitle}</div>}
      </div>
      {comingSoon ? null : badge !== undefined && badge > 0 ? (
        <span className="flex-shrink-0 rounded-full bg-trama-orange px-2 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : (
        <i className="ti ti-chevron-right flex-shrink-0 text-[16px] text-ink-3" />
      )}
    </div>
  );

  return href && !comingSoon ? <Link href={href}>{content}</Link> : content;
}

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
            piano prima vivevano in un hub separato raggiungibile da un link
            in fondo al Planner (/nextgen/planner/logistica, ora eliminato,
            redirect qui). Sono impostazioni che si toccano di rado (si
            configurano una volta, non si rivedono ogni settimana come Chi fa
            cosa nel Calendario, che resta li'), quindi il loro posto naturale
            e' Profilo, non il Planner. */}
        <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">Famiglia</div>
        <HubCard
          href="/nextgen/planner/indirizzi"
          icon="ti-map-pin"
          iconBg="#F0EEFF"
          iconColor="#6F63C5"
          title="Indirizzi di famiglia"
          subtitle="Casa, lavoro e altri punti di partenza"
        />
        <HubCard
          href="/nextgen/planner/famiglia"
          icon="ti-users"
          iconBg="#E3F9F5"
          iconColor="#2DBA8C"
          title="Famiglia"
          subtitle="Invita l'altro genitore, condividete tutto"
        />
        <HubCard
          href="/nextgen/planner?mode=calendario"
          icon="ti-share"
          iconBg="#FFF0EA"
          iconColor="#F6A623"
          title="Condivisione piano"
          subtitle="Crea un link di sola lettura per mese o settimana"
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

        <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">Impostazioni</div>
        <HubCard
          href="/profile/sicurezza"
          icon="ti-shield-lock"
          iconBg="#E8F6FD"
          iconColor="#4DAFEF"
          title="Sicurezza"
          subtitle="Password, accesso rapido"
        />
        <HubCard
          href="/profile/preferenze"
          icon="ti-adjustments"
          iconBg="#FFF3E6"
          iconColor="#E08A2D"
          title="Preferenze"
          subtitle="Lingua, tema, notifiche"
        />
        <HubCard
          icon="ti-credit-card"
          iconBg="#E8F9EE"
          iconColor="#52C87A"
          title="Metodi di pagamento"
          comingSoon
        />
        <HubCard
          href="/profile/privacy"
          icon="ti-lock"
          iconBg="#FCE8EC"
          iconColor="#D6497A"
          title="Privacy e account"
          subtitle="Consenso, disattivazione"
        />
      </div>

      <LogoutButton />
      <div className="h-4" />
    </div>
  );
}
