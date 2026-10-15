"use client";

// TRAMA — SALVATI V2 (15/10/2026, segnalazione Fabrizio sui Preferiti: "qui
// ancora vecchio stile"). Con DISCOVER_V2_ENABLED la pagina /nextgen/preferiti
// usa lo stesso stile di Scopri: titolo "Salvati" (stesso nome del Profilo V2),
// card V2 (DiscoverResultCard, DiscoveryLeadCard v2, CommunityDiscoveryCard v2),
// niente km, voto ed emoji inseriti a mano. Dati invariati
// (getUnifiedFavoritesForParent). Fuori da V2 resta PreferitiView.

import { useRouter } from "next/navigation";
import { goBackInApp } from "@/lib/nextgen/in-app-history";
import Link from "next/link";
import type { Kid } from "@/lib/types";
import type { UnifiedFavoriteItem } from "@/lib/discovery/unified-favorites";
import DiscoverResultCard from "@/components/nextgen/DiscoverResultCard";
import DiscoveryLeadCard from "@/components/nextgen/DiscoveryLeadCard";
import CommunityDiscoveryCard from "@/components/nextgen/CommunityDiscoveryCard";
import TramaThread from "@/components/nextgen/TramaThread";
import ProfileChip from "@/components/nextgen/ProfileChip";

export default function SalvatiV2View({
  favorites,
  kids,
  plannerEnabled,
}: {
  favorites: UnifiedFavoriteItem[];
  kids: Kid[];
  plannerEnabled: boolean;
}) {
  const router = useRouter();
  const count = favorites.length;
  return (
    <div className="-mb-40 flex min-h-[calc(100%+10rem)] flex-col gap-4 bg-trama-page px-5 pb-24 pt-[14px]">
      <header className="flex items-start gap-1">
        <button
          type="button"
          onClick={() => {
            goBackInApp(router, "/nextgen/profile");
          }}
          aria-label="Indietro"
          className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-full text-[22px] text-ink active:bg-black/[0.04]"
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
        </button>
        <div className="flex flex-1 flex-col pt-1.5">
          <h1 className="font-poppins text-[24px] font-semibold leading-tight text-ink">Salvati</h1>
          <TramaThread className="mt-1.5" />
          <span className="mt-1.5 text-[13px] text-ink-2">
            {count === 0 ? "Ancora niente" : count === 1 ? "1 attività salvata" : `${count} attività salvate`}
          </span>
        </div>
        <ProfileChip />
      </header>

      {count === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-trama-line bg-white px-5 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-trama-primary-soft text-trama-primary">
            <i className="ti ti-bookmark text-[24px]" aria-hidden="true" />
          </span>
          <p className="text-[14.5px] text-ink-2">Tocca il segnalibro su un&apos;attività in Scopri per ritrovarla qui.</p>
          <Link
            href="/nextgen/search"
            className="flex min-h-[44px] items-center rounded-[12px] bg-trama-primary px-5 text-[14px] font-bold text-white active:bg-trama-primary-press"
          >
            Vai a Scopri
          </Link>
        </section>
      ) : (
        <div className="flex flex-col gap-3">
          {favorites.map((item) =>
            item.kind === "partner" ? (
              <DiscoverResultCard key={`partner-${item.activity.id}`} activity={item.activity} reasons={[]} distanceKm={null} initialFavorite />
            ) : item.kind === "community" ? (
              <CommunityDiscoveryCard key={`community-${item.discovery.id}`} discovery={item.discovery} initialFavorite v2 />
            ) : (
              <DiscoveryLeadCard
                key={`curated-${item.curatedLeadId}`}
                lead={item.lead}
                initialFavorite
                kids={kids}
                plannerEnabled={plannerEnabled}
                v2
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
