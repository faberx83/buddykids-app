"use client";

import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import HubCard from "@/components/nextgen/HubCard";

// Stessi 4 link già presenti in ProfileNextgenClient.tsx, spostati qui
// dietro un solo ingresso "Famiglia e logistica" (vedi commento in
// ProfileNextgenClient.tsx e in page.tsx di questa cartella).
export default function FamigliaHubClient() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Famiglia e logistica" onBack={() => router.push("/nextgen/profile")} showBrandIcon />

      <div className="flex flex-col gap-2.5 px-5 pt-4">
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
        <HubCard
          href="/nextgen/planner/promemoria"
          icon="ti-bell"
          iconBg="#FFF3E6"
          iconColor="#E08A2D"
          title="Promemoria e avvisi"
          subtitle="Avvisami prima di partire (anteprima)"
        />
      </div>
    </div>
  );
}
