"use client";

import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import HubCard from "@/components/nextgen/HubCard";

// Stessi 4 link già presenti in ProfileNextgenClient.tsx, spostati qui
// dietro un solo ingresso "Impostazioni" (vedi commento in
// ProfileNextgenClient.tsx e in page.tsx di questa cartella).
export default function ImpostazioniHubClient() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Impostazioni" onBack={() => router.push("/nextgen/profile")} showBrandIcon />

      <div className="flex flex-col gap-2.5 px-5 pt-4">
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
    </div>
  );
}
