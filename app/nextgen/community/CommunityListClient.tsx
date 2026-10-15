"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CommunityItem, CommunityRole } from "@/lib/types";
import { createCommunityAction, joinCommunityByCodeAction } from "@/app/actions/communities";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import DecorativeIntroCard from "@/components/nextgen/DecorativeIntroCard";
import PageHeader from "@/components/PageHeader";
import { useNavV2 } from "@/components/nextgen/ProfileChip";
import { CLASSE_SCUOLA_COPY as V2_COPY } from "@/lib/nextgen/classe-scuola-copy";

// SPRINT 4 (NEXTGEN) — Elenco Community + creazione/adesione. Stesso tono
// caldo/informale della Home rifinita (sprint correttivo): niente linguaggio
// da "gestionale" ("Community" invece di "gruppo di lavoro", CTA dirette).

const ROLE_LABEL: Record<CommunityRole, string> = {
  creatore: "Creatore",
  admin: "Admin",
  membro: "Membro",
};

export default function CommunityListClient({ initialCommunities }: { initialCommunities: CommunityItem[] }) {
  const router = useRouter();
  const showToast = useNextgenToast();
  // 15/10/2026 (Fabrizio: "Va bene classe e scuola"): con la nuova barra la
  // "Community" si chiama "Classe e scuola" — il giro dei genitori di una
  // classe o di una scuola. Stessa logica e stesse tabelle; Legacy e barra
  // attuale invariate.
  const v2 = useNavV2();
  // Elenco letto dal server (page.tsx): non serve stato locale mutabile qui,
  // creare/entrare porta al dettaglio e router.refresh() aggiorna questa
  // lista al ritorno indietro.
  const communities = initialCommunities;
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    const res = await createCommunityAction(name, description);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    showToast(v2 ? V2_COPY.toastCreated : "Community creata! Invita le prime famiglie con il codice.");
    router.push(`/nextgen/community/${res.communityId}`);
  }

  async function handleJoin() {
    setBusy(true);
    setError(null);
    const res = await joinCommunityByCodeAction(code);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    showToast(
      v2
        ? res.alreadyMember
          ? V2_COPY.toastAlreadyIn
          : V2_COPY.toastJoined
        : res.alreadyMember
          ? "Fai già parte di questa community."
          : "Ti sei unito alla community!"
    );
    router.push(`/nextgen/community/${res.communityId}`);
  }

  return (
    <div className={v2 ? "flex flex-col" : "flex flex-col gap-6 px-5 py-6"}>
      {v2 && (
        <>
          <PageHeader title={V2_COPY.title} showBrandIcon />
          <p className="px-5 pb-1 pt-2 text-[14px] leading-snug text-ink-2">{V2_COPY.intro}</p>
        </>
      )}
      <div className={v2 ? "flex flex-col gap-5 px-5 pb-8 pt-4" : "contents"}>
      {/* SPRINT 7 — stessa texture decorativa (due cerchi) della hero card
          di Home, vedi DecorativeIntroCard. */}
      {!v2 && (
      <DecorativeIntroCard>
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 font-poppins text-xl font-bold text-ink">
            <img src="/brand/trama-logo-mark.png" alt="" aria-hidden="true" className="h-6 w-auto flex-shrink-0" />
            Community
          </h1>
        </div>
      </DecorativeIntroCard>
      )}

      {mode === "none" && (
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setMode("create")}
            className={
              v2
                ? "min-h-[48px] flex-1 rounded-[12px] bg-trama-primary px-4 py-3 text-[15px] font-semibold text-white active:bg-trama-primary-press"
                : "flex-1 rounded-2xl bg-trama-violet px-4 py-3 text-sm font-bold text-white active:scale-[0.97]"
            }
          >
            <i className="ti ti-plus mr-1.5" />
            {v2 ? V2_COPY.create : "Crea community"}
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className={
              v2
                ? "min-h-[48px] flex-1 rounded-[12px] border border-trama-line bg-white px-4 py-3 text-[15px] font-semibold text-ink active:bg-black/[0.04]"
                : "flex-1 rounded-2xl bg-bg px-4 py-3 text-sm font-bold text-ink active:brightness-95"
            }
          >
            <i className="ti ti-login-2 mr-1.5" />
            Entra con codice
          </button>
        </div>
      )}

      {mode === "create" && (
        <div className="nextgen-warm-shadow flex flex-col gap-3 rounded-[20px] bg-white p-5">
          <div className="text-base font-semibold text-ink">{v2 ? V2_COPY.createTitle : "Crea una nuova community"}</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={v2 ? V2_COPY.namePlaceholder : "Nome (es. Famiglie del quartiere)"}
            className="rounded-xl border border-[#E8EBF0] px-3.5 py-2.5 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrizione (opzionale)"
            rows={2}
            className="resize-none rounded-xl border border-[#E8EBF0] px-3.5 py-2.5 text-sm"
          />
          {error && <div className="text-[13px] font-medium text-red-500">{error}</div>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleCreate}
              className="flex-1 rounded-full bg-trama-violet px-4 py-2.5 text-sm font-bold text-white active:scale-[0.97] disabled:opacity-50"
            >
              {busy ? "Creazione…" : "Crea"}
            </button>
            <button
              type="button"
              onClick={() => setMode("none")}
              className="rounded-full bg-bg px-4 py-2.5 text-sm font-semibold text-ink-2 active:brightness-95"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {mode === "join" && (
        <div className="nextgen-warm-shadow flex flex-col gap-3 rounded-[20px] bg-white p-5">
          <div className="text-base font-semibold text-ink">Entra con un codice invito</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Es. BK7X9K"
            className="rounded-xl border border-[#E8EBF0] px-3.5 py-2.5 text-sm uppercase tracking-wide"
          />
          {error && <div className="text-[13px] font-medium text-red-500">{error}</div>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleJoin}
              className="flex-1 rounded-full bg-trama-violet px-4 py-2.5 text-sm font-bold text-white active:scale-[0.97] disabled:opacity-50"
            >
              {busy ? "Verifica…" : "Entra"}
            </button>
            <button
              type="button"
              onClick={() => setMode("none")}
              className="rounded-full bg-bg px-4 py-2.5 text-sm font-semibold text-ink-2 active:brightness-95"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {communities.length === 0 ? (
        <div
          className={
            v2
              ? "rounded-[20px] border border-dashed border-[#D6DAE3] bg-white p-4 text-[14px] leading-snug text-ink-2"
              : "rounded-[20px] bg-bg p-6 text-center text-sm text-ink-2"
          }
        >
          {v2
            ? V2_COPY.empty
            : "Non fai ancora parte di nessuna community. Creane una o entra con un codice invito ricevuto da altre famiglie."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {communities.map((c) => (
            <Link
              key={c.id}
              href={`/nextgen/community/${c.id}`}
              className={
                v2
                  ? "flex min-h-[64px] items-center gap-3 rounded-2xl border border-trama-line bg-white p-4 active:bg-black/[0.04]"
                  : "nextgen-warm-shadow flex items-center gap-3 rounded-[20px] bg-white p-4 active:bg-black/[0.06]"
              }
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-bg text-2xl">
                {c.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-ink">{c.name}</div>
                <div className="text-[13px] text-ink-3">
                  {c.membersCount} {c.membersCount === 1 ? "famiglia" : "famiglie"} · {ROLE_LABEL[c.myRole]}
                </div>
              </div>
              {c.activeProposalsCount > 0 && (
                <span className="flex-shrink-0 rounded-full bg-trama-lilac/20 px-2.5 py-1 text-[11px] font-bold text-trama-violet">
                  {c.activeProposalsCount} {c.activeProposalsCount === 1 ? "proposta" : "proposte"}
                </span>
              )}
              <i className="ti ti-chevron-right flex-shrink-0 text-ink-3" />
            </Link>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
