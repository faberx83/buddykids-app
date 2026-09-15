"use client";

import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import LogoutButton from "@/components/LogoutButton";
import ProfileHeaderClient from "@/components/ProfileHeaderClient";
import ProfileKidsSection from "@/components/ProfileKidsSection";
import HubCard from "@/components/nextgen/HubCard";
import DecorativeIntroCard from "@/components/nextgen/DecorativeIntroCard";
import { writeVersionPreference } from "@/lib/version-preference";
import type { ParentRole, Gender } from "@/lib/data/profile";
import type { Kid } from "@/lib/types";
// TRAMA — SCHOOL CALENDAR UX REFINEMENT (§10-11, 14/09/2026): "import type"
// (stesso motivo di ParentRole/Gender sopra) — lib/data/school-calendar.ts
// importa lib/supabase/server, un componente "use client" non può
// attraversare quel confine, solo il TIPO serve qui.
import type { KidSchoolProfileSummary } from "@/lib/data/school-calendar";

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
  schoolCalendarEnabled,
  schoolProfiles,
  residenceCity,
  classicFallbackEnabled,
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
  schoolCalendarEnabled: boolean;
  schoolProfiles: Record<string, KidSchoolProfileSummary>;
  residenceCity: string | null;
  // TRAMA — FINAL BETA CHROME CLEANUP (15/09/2026, PART C): risolto
  // server-side in app/nextgen/profile/page.tsx via NEXTGEN_CLASSIC_FALLBACK_ENABLED
  // (default false) — governa SOLO se la sezione "Esperienza TRAMA" sotto è
  // renderizzata. Quando false: zero DOM aggiuntivo, nessuna riga fantasma.
  classicFallbackEnabled: boolean;
}) {
  const router = useRouter();

  // TRAMA — FINAL BETA CHROME CLEANUP (15/09/2026, PART C): riusa
  // ESATTAMENTE lo stesso meccanismo di components/VersionToggle.tsx
  // (writeVersionPreference("legacy") + router.push("/")) — nessuna
  // logica di switch versione duplicata qui, solo un secondo punto di
  // ingresso per lo stesso meccanismo esistente, condizionato al flag.
  function switchToClassicVersion() {
    writeVersionPreference("legacy");
    router.push("/");
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* TRAMA — BACK NAVIGATION PROGRESS FIX (15/09/2026, live bug: "Profilo
          → indietro" non mostrava la barra). Causa: onBack={() =>
          router.push(...)} qui era una navigazione REALE con destinazione
          STATICA nota in anticipo, ma PageHeader chiama runNavigation() SOLO
          nel ramo backHref/router.back() — mai quando è passato onBack
          (per costruzione: onBack è spesso un cambio di step locale, non
          navigazione, vedi commento in PageHeader.tsx). Fix: backHref invece
          di onBack — stesso identico router.push("/nextgen") (PageHeader fa
          router.push(backHref) internamente), ma ora coperto da
          runNavigation() come le altre frecce "indietro" già corrette. */}
      <PageHeader title="Profilo" backHref="/nextgen" showBrandIcon />

      <div className="px-5 pt-4">
        {/* SPRINT 7 — stessa texture decorativa (due cerchi) della hero
            card di Home, vedi DecorativeIntroCard.
            FEEDBACK FABRIZIO (31/08): la card bianca annidata dentro questa
            cornice era ridondante — sulla Hero Card di Home il contenuto sta
            direttamente sullo sfondo viola tenue, senza un secondo strato
            bianco sopra. Tolto qui allo stesso modo (ProfileHeaderClient
            resta invariato: i suoi colori — text-ink/text-ink-2 — hanno
            contrasto sufficiente anche su bg-trama-violet/[0.08], stesso
            principio già verificato sulla Hero Card). Il pannello di modifica
            interno (bg-white, quando si preme "Modifica") resta bianco di
            proposito: è un'area con campi di input, non la riga di stato. */}
        <DecorativeIntroCard padding="p-4">
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
        </DecorativeIntroCard>
      </div>

      <ProfileKidsSection
        initialKids={kids}
        autoOpenAddKid={autoOpenAddKid}
        accent="violet"
        schoolCalendarEnabled={schoolCalendarEnabled}
        schoolProfiles={schoolProfiles}
        residenceCity={residenceCity}
      />

      <div className="flex flex-col gap-2.5 px-5 pt-2">
        <div className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Attività</div>
        <HubCard
          href="/nextgen/prenotazioni"
          icon="ti-ticket"
          iconBg="#E8F6FD"
          iconColor="#4DAFEF"
          title="Le mie prenotazioni"
          subtitle="Elenco delle tue prenotazioni"
        />
        <HubCard
          href="/nextgen/preferiti"
          icon="ti-heart"
          iconBg="#FFF8E7"
          iconColor="#c49a00"
          title="Preferiti"
          subtitle="Attività salvate"
        />
        <HubCard
          href="/nextgen/presenze"
          icon="ti-clipboard-check"
          iconBg="#E3F9F5"
          iconColor="#2DBA8C"
          title="Le presenze"
          subtitle="Storico presenze, ritardi e assenze per i tuoi bambini"
        />
        {/* TRAMA ONE Build Sprint 5 — J11: "I tuoi suggerimenti" (CenterLead),
            stessa collocazione delle altre pagine sola-lettura sull'attività
            del genitore (prenotazioni/preferiti/presenze). */}
        <HubCard
          href="/nextgen/center-leads"
          icon="ti-map-pin-plus"
          iconBg="#F3EEFF"
          iconColor="#6C4FE0"
          title="I tuoi suggerimenti"
          subtitle="Centri che hai segnalato perché non ancora su TRAMA"
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
          href="/nextgen/richieste"
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

        {/* SPRINT 5 (feedback Fabrizio: "anche lato genitore ci vuole una
            sezione 'temporanea' per la fase beta in cui rivedere
            aggiornamenti delle segnalazioni") — sezione volutamente marcata
            "BETA" per ricordare che va rimossa a fine fase, invece che
            mimetizzata tra le altre come se fosse permanente. */}
        <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">Beta</div>
        <HubCard
          href="/nextgen/profile/segnalazioni"
          icon="ti-message-report"
          iconBg="#FFF0E9"
          iconColor="#D4622A"
          title="Le mie segnalazioni"
          subtitle="Stato dei bug/suggerimenti inviati durante la BETA"
        />

        {/* TRAMA — FINAL BETA CHROME CLEANUP (15/09/2026, PART C): fallback
            operativo, non uno stato — per questo NON è un badge/CTA
            persistente in top chrome, ma una riga utility discreta qui in
            fondo a Profilo, dietro flag (nascosta interamente quando
            NEXTGEN_CLASSIC_FALLBACK_ENABLED risolve false). Icona
            "rotate/back" da sola (nessun cerchio colorato come le HubCard
            sopra — resta visivamente meno prominente, coerente con "azione
            operativa" e non "destinazione prodotto"), nessun bottone pieno. */}
        {classicFallbackEnabled && (
          <>
            <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">Esperienza TRAMA</div>
            <button
              type="button"
              onClick={switchToClassicVersion}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 text-left active:bg-black/[0.06]"
            >
              <i className="ti ti-history flex-shrink-0 text-[17px] text-ink-3" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold text-ink">Torna alla versione classica</div>
                <div className="text-[11.5px] text-ink-2">Usa temporaneamente la precedente esperienza TRAMA.</div>
              </div>
              <i className="ti ti-chevron-right flex-shrink-0 text-[16px] text-ink-3" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <LogoutButton />
      <div className="h-4" />
    </div>
  );
}
