"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

// SPRINT CORRETTIVO (feedback Fabrizio): "Indirizzi di Famiglia/Famiglia/
// Gestisci prenotazioni ora sono presenti in tutte le sezioni [del Planner],
// secondo me vanno riportate in una unica pagina" — prima questi 3 link
// comparivano ripetuti in fondo a PlannerClient.tsx, sotto OGNI modalità
// (Organizzazione/Calendario/Mappa/Budget/Gruppi). Ora un solo link
// "Logistica & Famiglia" porta qui, un hub con 4 card:
//   - Indirizzi di famiglia (pagina esistente, invariata)
//   - Famiglia (pagina esistente, invariata)
//   - Condivisione piano (vive ancora dentro Calendario — PlannerCalendarView,
//     Sprint 5.3 — una riscrittura completa e' rimandata allo sprint che
//     unifica Organizzazione+Calendario, per non duplicare lavoro; qui la
//     card salta direttamente alla modalita' Calendario tramite ?mode=)
//   - Le tue prenotazioni (era "Gestisci prenotazioni (annulla/modifica) ->",
//     un link nudo poco chiaro — ora una card con testo che spiega perche'
//     porta a una pagina LEGACY: "annullare o modificare richiede ancora la
//     vista classica")
function HubCard({
  href,
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
}: {
  href: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl bg-white p-4">
      <div
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[19px]"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        <i className={`ti ${icon}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold text-ink">{title}</div>
        <div className="text-[11.5px] text-ink-2">{subtitle}</div>
      </div>
      <i className="ti ti-chevron-right flex-shrink-0 text-[16px] text-ink-3" />
    </Link>
  );
}

export default function LogisticaClient() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Logistica & Famiglia" onBack={() => router.push("/nextgen/planner")} showBrandIcon />
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Famiglia</div>
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

        <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">Piano condiviso</div>
        <HubCard
          href="/nextgen/planner?mode=calendario"
          icon="ti-share"
          iconBg="#FFF0EA"
          iconColor="#F6A623"
          title="Condivisione piano"
          subtitle="Crea un link di sola lettura per mese o settimana"
        />

        <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">Prenotazioni</div>
        <HubCard
          href="/prenotazioni"
          icon="ti-ticket"
          iconBg="#E8F6FD"
          iconColor="#4DAFEF"
          title="Le tue prenotazioni"
          subtitle="Per annullare o modificare una prenotazione (vista classica)"
        />
      </div>
    </div>
  );
}
