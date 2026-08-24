"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GroupCard from "@/components/GroupCard";
import {
  createGroupAction,
  joinGroupAction,
  acceptGroupInviteAction,
  declineGroupInviteAction,
} from "@/app/actions/groups";
import { GroupItem, PublicGroupItem, GroupInviteItem } from "@/lib/types";

const tabs = ["I miei gruppi", "Scopri", "Inviti"];

// TRAMA ONE — Gruppi "Scopri"/"Inviti" (24/08/2026, migration_25): chiude il
// gap segnalato da Fabrizio ("dove sono tutti quei gap...la 'visibilità'
// della feature gruppi?") — le due tab erano placeholder statici
// ("funzionalità in arrivo"), senza alcuna logica o modello dati dietro.
// "Scopri" mostra i gruppi resi pubblici da altri genitori (is_public=true,
// vedi migration_25 + lib/data/groups.ts#getPublicGroups) con un CTA
// "Unisciti" che riusa joinGroupAction (già esistente, stesso meccanismo
// del link /groups/join/[id]). "Inviti" mostra gli inviti reali indirizzati
// all'email del genitore loggato (group_invites, stesso pattern collaudato
// di family_invites) con Accetta/Rifiuta.
// TRAMA ONE (24/08/2026) — basePath/backHref/showBrandIcon opzionali per
// essere riusato anche dal guscio NEXTGEN-native app/nextgen/groups (task
// #528, "rimandi legacy dentro NEXTGEN"): LEGACY continua a raggiungere
// questa schermata dalla bottom nav (nessun back, nessun basePath diverso
// da "/groups"), NEXTGEN la raggiunge come sotto-pagina del Planner e ha
// bisogno di un back-arrow e di restare dentro /nextgen/groups/*.
export default function GroupsClient({
  initialGroups,
  initialPublicGroups,
  initialInvites,
  basePath = "/groups",
  backHref,
  showBrandIcon,
}: {
  initialGroups: GroupItem[];
  initialPublicGroups: PublicGroupItem[];
  initialInvites: GroupInviteItem[];
  basePath?: string;
  backHref?: string;
  showBrandIcon?: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [groups] = useState<GroupItem[]>(initialGroups);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setError(null);
    setSaving(true);
    const result = await createGroupAction(newName);
    setSaving(false);
    if (result.error || !result.group) {
      setError(result.error || "Errore nella creazione");
      return;
    }
    // Appena creato, si entra subito nella configurazione del gruppo
    // (bambini, attività, richiesta) invece di restare sulla lista.
    router.push(`${basePath}/${result.group.id}`);
  }

  return (
    <div className="animate-fade-in">
      <div className="flex-shrink-0 border-b border-[#F0F2F5] bg-white px-5 py-3.5">
        <div className="mb-3 flex items-center gap-3">
          {backHref && (
            <button
              onClick={() => router.push(backHref)}
              aria-label="Indietro"
              className="flex items-center text-[22px] text-ink"
            >
              <i className="ti ti-arrow-left" />
            </button>
          )}
          {showBrandIcon && (
            <img
              src="/brand/trama-logo-mark.png"
              alt=""
              aria-hidden="true"
              className="h-5 w-auto flex-shrink-0"
            />
          )}
          <h2 className="text-lg font-bold text-ink">Gruppi & Community</h2>
        </div>
        <div className="flex rounded-lg bg-[#F4F6FA] p-[3px]">
          {tabs.map((t, i) => (
            <div
              key={t}
              onClick={() => setActive(i)}
              className={`flex-1 cursor-pointer rounded-md py-2 text-center text-xs font-medium transition-all ${
                active === i
                  ? "bg-white font-bold text-ink shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                  : "text-ink-2"
              }`}
            >
              {t}
              {i === 2 && initialInvites.length > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange px-1 text-[9px] font-bold text-white">
                  {initialInvites.length}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {active === 0 && (
        <>
          <div
            className="mx-5 my-3 flex items-center gap-3 rounded-lg p-3.5"
            style={{ background: "linear-gradient(120deg,#E8F6FD,#E3F9F5)" }}
          >
            <div className="text-[34px]">🤝</div>
            <div>
              <div className="text-sm font-bold text-ink">Andiamo Insieme</div>
              <div className="mt-0.5 text-xs text-ink-2">
                Crea un gruppo e ottieni sconti con gli amici
              </div>
            </div>
            {!showNew && (
              <button
                onClick={() => setShowNew(true)}
                className="ml-auto whitespace-nowrap rounded-md bg-sky px-3 py-2 text-xs font-bold text-white"
              >
                + Nuovo
              </button>
            )}
          </div>

          {showNew && (
            <div className="mx-5 mb-3 rounded-md border-[1.5px] border-[#E3F0FB] bg-sky-light/40 p-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome del gruppo"
                className="mb-2 w-full rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-sky"
              />
              {error && <p className="mb-2 text-xs font-medium text-orange">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={saving}
                  className="rounded-md bg-sky px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  {saving ? "Creo…" : "Crea gruppo"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNew(false);
                    setError(null);
                  }}
                  className="rounded-md border border-[#E8EBF0] px-4 py-2 text-xs font-semibold text-ink"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}

          {groups.length === 0 && !showNew && (
            <p className="mx-5 mb-3 text-sm text-ink-2">
              Non fai ancora parte di nessun gruppo — creane uno per iniziare a risparmiare con gli
              amici.
            </p>
          )}

          {groups.map((g) => (
            <GroupCard key={g.id} group={g} basePath={basePath} />
          ))}
          <div className="h-5" />
        </>
      )}

      {active === 1 && <ScopriTab initialPublicGroups={initialPublicGroups} basePath={basePath} />}
      {active === 2 && <InvitiTab initialInvites={initialInvites} basePath={basePath} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab "Scopri" — gruppi pubblici di cui non fai ancora parte
// ─────────────────────────────────────────────
function ScopriTab({
  initialPublicGroups,
  basePath = "/groups",
}: {
  initialPublicGroups: PublicGroupItem[];
  basePath?: string;
}) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialPublicGroups);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function handleJoin(groupId: string) {
    setJoiningId(groupId);
    setErrorId(null);
    const result = await joinGroupAction(groupId);
    setJoiningId(null);
    if (result.error) {
      setErrorId(groupId);
      return;
    }
    // Rimuovi dalla lista "Scopri" (ora sei membro) e vai al gruppo.
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    router.push(`${basePath}/${groupId}`);
  }

  if (groups.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-ink-2">
        Nessun gruppo pubblico da scoprire al momento — i genitori possono rendere pubblico un
        gruppo dalla sua pagina, per farlo trovare da altre famiglie.
      </div>
    );
  }

  return (
    <div className="px-5 pt-3">
      {groups.map((g) => (
        <div
          key={g.id}
          className="mb-3 flex items-center gap-3 rounded-xl border border-[#E8EBF0] bg-white p-3.5"
        >
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-xl"
            style={{ background: g.gradient }}
          >
            {g.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-ink">{g.name}</div>
            <div className="mt-0.5 truncate text-xs text-ink-2">
              {g.location} · {g.familyCount} {g.familyCount === 1 ? "famiglia" : "famiglie"}
            </div>
            {errorId === g.id && (
              <p className="mt-1 text-[11px] font-medium text-orange">Errore nell&apos;adesione</p>
            )}
          </div>
          <button
            onClick={() => handleJoin(g.id)}
            disabled={joiningId === g.id}
            className="flex-shrink-0 whitespace-nowrap rounded-md bg-sky px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {joiningId === g.id ? "Un momento…" : "Unisciti"}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab "Inviti" — inviti reali indirizzati alla tua email
// ─────────────────────────────────────────────
function InvitiTab({
  initialInvites,
  basePath = "/groups",
}: {
  initialInvites: GroupInviteItem[];
  basePath?: string;
}) {
  const router = useRouter();
  const [invites, setInvites] = useState(initialInvites);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function handleAccept(inviteId: string) {
    setBusyId(inviteId);
    setErrorId(null);
    const result = await acceptGroupInviteAction(inviteId);
    setBusyId(null);
    if (result.error) {
      setErrorId(inviteId);
      return;
    }
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    if (result.groupId) router.push(`${basePath}/${result.groupId}`);
  }

  async function handleDecline(inviteId: string) {
    setBusyId(inviteId);
    setErrorId(null);
    const result = await declineGroupInviteAction(inviteId);
    setBusyId(null);
    if (result.error) {
      setErrorId(inviteId);
      return;
    }
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }

  if (invites.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-ink-2">
        Nessun invito in attesa — quando un amico ti invita per email a un gruppo, lo trovi qui.
      </div>
    );
  }

  return (
    <div className="px-5 pt-3">
      {invites.map((inv) => (
        <div key={inv.id} className="mb-3 rounded-xl border border-[#E8EBF0] bg-white p-3.5">
          <div className="text-sm font-bold text-ink">{inv.groupName}</div>
          <div className="mt-0.5 text-xs text-ink-2">
            {inv.inviterName ? `${inv.inviterName} ti ha invitato` : "Sei stato invitato"}
            {inv.activityName ? ` · ${inv.activityName}` : ""}
            {inv.centerName ? ` (${inv.centerName})` : ""}
          </div>
          {inv.discountPercent > 0 && (
            <div className="mt-1 text-xs font-semibold text-green">Sconto {inv.discountPercent}%</div>
          )}
          {errorId === inv.id && (
            <p className="mt-1 text-[11px] font-medium text-orange">Errore nella risposta all&apos;invito</p>
          )}
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => handleAccept(inv.id)}
              disabled={busyId === inv.id}
              className="rounded-md bg-sky px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {busyId === inv.id ? "Un momento…" : "Accetta"}
            </button>
            <button
              onClick={() => handleDecline(inv.id)}
              disabled={busyId === inv.id}
              className="rounded-md border border-[#E8EBF0] px-3.5 py-2 text-xs font-semibold text-ink disabled:opacity-60"
            >
              Rifiuta
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
