"use client";

import Link from "next/link";
import { CommunityItem, CommunityRole, GroupItem } from "@/lib/types";
import RowMark from "@/components/nextgen/RowMark";
import { CLASSE_SCUOLA_COPY } from "@/lib/nextgen/classe-scuola-copy";

// SPRINT 5.6 (NEXTGEN) — riempie l'ultima scheda del Planner ancora "in
// arrivo" (Organizzazione/Budget/Calendario/Mappa/Famiglia fatte nelle fasi
// precedenti). NESSUNA nuova tabella/RLS: riusa 1:1 getCommunitiesForUser()
// (Sprint 4) e getGroupsForUser() (già esistente, "Gruppi"/Andiamo Insieme)
// — questa vista è solo un nuovo "collage" di dati già letti altrove, con
// link al dettaglio reale (/nextgen/community/[id], /nextgen/groups/[id] —
// aggiornato task #528, prima portava dentro il layout LEGACY). Le due
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

/** POLISH V2: monogramma con filo TRAMA al posto dell'emoji. */
function CommunityCard({ community, v2 = false }: { community: CommunityItem; v2?: boolean }) {
  return (
    <Link
      href={`/nextgen/community/${community.id}`}
      className={v2 ? "flex min-h-[64px] items-center gap-3 px-4 py-3 active:bg-black/[0.03]" : "flex items-center gap-3 rounded-2xl bg-white p-3.5 active:bg-black/[0.06]"}
    >
      {v2 ? (
        <RowMark title={community.name} />
      ) : (
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-trama-lilac/20 text-lg">
          {community.emoji}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className={v2 ? "truncate text-[15px] font-semibold text-ink" : "truncate text-[13.5px] font-bold text-ink"}>{community.name}</div>
        <div className={`mt-0.5 flex items-center gap-1.5 text-ink-2 ${v2 ? "text-[13px]" : "text-[11.5px]"}`}>
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

function GroupCard({ group, v2 = false }: { group: GroupItem; v2?: boolean }) {
  return (
    <Link
      href={`/nextgen/groups/${group.id}?from=planner-gruppi`}
      className={v2 ? "flex min-h-[64px] items-center gap-3 px-4 py-3 active:bg-black/[0.03]" : "flex items-center gap-3 rounded-2xl bg-white p-3.5 active:bg-black/[0.06]"}
    >
      {v2 ? (
        <RowMark title={group.name} />
      ) : (
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg"
          style={{ background: group.gradient }}
        >
          {group.emoji}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className={v2 ? "truncate text-[15px] font-semibold text-ink" : "truncate text-[13.5px] font-bold text-ink"}>{group.name}</div>
        <div className={`mt-0.5 truncate text-ink-2 ${v2 ? "text-[13px]" : "text-[11.5px]"}`}>
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
  v2 = false,
}: {
  communities: CommunityItem[];
  groups: GroupItem[];
  /** PLANNER V2 / GRUPPI V2 (14/10/2026): sezioni come Profilo V2 — titolo Poppins, una card bianca con le righe. */
  v2?: boolean;
}) {
  if (v2) {
    const card = "overflow-hidden rounded-2xl border border-trama-line bg-white divide-y divide-[#F0F2F5]";
    const empty = "rounded-[20px] border border-dashed border-[#D6DAE3] bg-white p-4 text-[13px] leading-snug text-ink-2";
    const link = "flex min-h-[44px] items-center text-[14px] font-semibold text-trama-accent-ink";
    return (
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-poppins text-[18px] font-semibold text-ink">I tuoi gruppi</h2>
            <Link href="/nextgen/groups?from=planner-gruppi" className={link}>
              {groups.length > 0 ? "Vedi tutti" : "Crea un gruppo"}
            </Link>
          </div>
          {groups.length > 0 ? (
            <div className={card}>
              {groups.map((g) => (
                <GroupCard key={g.id} group={g} v2 />
              ))}
            </div>
          ) : (
            <p className={empty}>
              Nessun gruppo attivo. Un gruppo nasce da una prenotazione condivisa (sconto, passaggi) o da{" "}
              {CLASSE_SCUOLA_COPY.groupsEmptyOrigin}.
            </p>
          )}
        </section>
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-poppins text-[18px] font-semibold text-ink">{CLASSE_SCUOLA_COPY.sectionTitle}</h2>
            <Link href="/nextgen/community" className={link}>
              {communities.length > 0 ? "Vedi tutte" : "Crea o entra"}
            </Link>
          </div>
          {communities.length > 0 ? (
            <div className={card}>
              {communities.map((c) => (
                <CommunityCard key={c.id} community={c} v2 />
              ))}
            </div>
          ) : (
            <p className={empty}>{CLASSE_SCUOLA_COPY.plannerEmpty}</p>
          )}
        </section>
      </div>
    );
  }

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
          {/* TRAMA BETA v1.1.1 (FINAL FUNCTIONAL + UI CONSISTENCY FIXES, punto 4) —
              "?from=planner-gruppi" marca l'origine Planner/Gruppi cosi il Back
              dalla lista (e dal dettaglio) torni qui, non a Planner/Organizzazione.
              I link Community sopra restano INVARIATI: fuori scope (vedi §4-5,
              "Gruppi & Community" è il titolo della sola pagina Gruppi). */}
          <Link
            href="/nextgen/groups?from=planner-gruppi"
            className="text-[12px] font-semibold text-trama-violet active:bg-black/[0.04]"
          >
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
