"use client";

import Link from "next/link";
import { CommunityItem, CommunityRole, GroupItem } from "@/lib/types";

// SPRINT 5.6 (NEXTGEN) — riempie l'ultima scheda del Planner ancora "in
// arrivo" (Organizzazione/Budget/Calendario/Mappa/Famiglia fatte nelle fasi
// precedenti). NESSUNA nuova tabella/RLS: riusa 1:1 getCommunitiesForUser()
// (Sprint 4) e getGroupsForUser() (già esistente, "Gruppi"/Andiamo Insieme)
// — questa vista è solo un nuovo "collage" di dati già letti altrove, con
// link al dettaglio reale (/nextgen/community/[id], /groups/[id]). Le due
// funzionalità restano concettualmente distinte (vedi commenti in
// lib/data/communities.ts): Community = persistente/multi-attività,
// Gruppi = legati a una singola attività per lo sconto/car pooling. Una
// proposta di Community con interesse può generare un Gruppo vero e proprio
// (spawnGroupFromProposalAction, già esistente in app/actions/communities.ts)
// — qui solo un piccolo badge rende più visibile questa possibilità.

const ROLE_LABEL: Record<CommunityRole, string> = {
  creatore: "Creatore",
  admin: "Admin",
  membro: "Membro",
};

function CommunityCard({ community }: { community: CommunityItem }) {
  return (
    <Link
      href={`/nextgen/community/${community.id}`}
      className="flex items-center gap-3 rounded-2xl bg-white p-3.5 active:bg-black/[0.06]"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-trama-lilac/20 text-lg">
        {community.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-bold text-ink">{community.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-2">
          <span>{community.membersCount} famigli{community.membersCount === 1 ? "a" : "e"}</span>
          <span>·</span>
          <span>{ROLE_LABEL[community.myRole]}</span>
        </div>
      </div>
      {community.activeProposalsCount > 0 && (
        <span className="flex-shrink-0 rounded-full bg-trama-lilac/20 px-2.5 py-1 text-[11px] font-bold text-trama-violet">
          {community.activeProposalsCount} proposta{community.activeProposalsCount === 1 ? "" : "e"} pronta
          {community.activeProposalsCount === 1 ? "" : "e"} per un Gruppo
        </span>
      )}
      <i className="ti ti-chevron-right flex-shrink-0 text-ink-3" />
    </Link>
  );
}

function GroupCard({ group }: { group: GroupItem }) {
  return (
    <Link href={`/groups/${group.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 active:bg-black/[0.06]">
      <span
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg"
        style={{ background: group.gradient }}
      >
        {group.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-bold text-ink">{group.name}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-ink-2">
          {group.totalFamilies} famigli{group.totalFamilies === 1 ? "a" : "e"} · {group.discountLabel}
        </div>
      </div>
      <i className="ti ti-chevron-right flex-shrink-0 text-ink-3" />
    </Link>
  );
}

export default function PlannerGroupsView({
  communities,
  groups,
}: {
  communities: CommunityItem[];
  groups: GroupItem[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-poppins text-[13px] font-bold text-ink">Le tue Community</span>
          <Link href="/nextgen/community" className="text-[12px] font-semibold text-trama-violet active:bg-black/[0.04]">
            {communities.length > 0 ? "Vedi tutte" : "Crea o entra"}
          </Link>
        </div>
        {communities.length > 0 ? (
          <div className="flex flex-col gap-2">
            {communities.map((c) => (
              <CommunityCard key={c.id} community={c} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-4 text-center text-xs text-ink-2">
            Non fai ancora parte di nessuna Community — condividi proposte di attività con altre famiglie.
          </div>
        )}
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-poppins text-[13px] font-bold text-ink">I tuoi Gruppi sconto</span>
          <Link href="/groups" className="text-[12px] font-semibold text-trama-violet active:bg-black/[0.04]">
            {groups.length > 0 ? "Vedi tutti" : "Scopri come"}
          </Link>
        </div>
        {groups.length > 0 ? (
          <div className="flex flex-col gap-2">
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-4 text-center text-xs text-ink-2">
            Nessun Gruppo attivo — nasce da una prenotazione condivisa (sconto/car pooling) o da una proposta di
            Community.
          </div>
        )}
      </div>
    </div>
  );
}
