"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Family } from "@/lib/data/family";
import { FAMILY_ROLE_LABELS } from "@/lib/nextgen/family-roles";
import {
  createFamilyAction,
  joinFamilyByCodeAction,
  leaveFamilyAction,
  inviteToFamilyAction,
  acceptFamilyInviteAction,
  type FamilyInvitePreview,
} from "@/app/actions/family";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import PageHeader from "@/components/PageHeader";

// SPRINT 5.5 (NEXTGEN) — Profilo Famiglia multi-genitore: crea/entra in una
// famiglia con un secondo genitore (account separato), tramite codice invito
// — stesso pattern già collaudato per le Community (vedi
// app/nextgen/community). Una volta nella stessa famiglia, Indirizzi/"Chi fa
// cosa?"/Condivisione Piano diventano condivisi in lettura e scrittura fra
// tutti i membri (RLS aggiornata in supabase/schema.sql). Bambini e
// prenotazioni restano SEMPRE visibili solo a chi li ha creati — questa
// pagina non cambia quello.
// Mostrato quando si arriva dal link di un invito email (?accept=TOKEN),
// sia che l'utente abbia già una famiglia (mostrerà l'errore "ne fai già
// parte di una") sia che ne sia privo — sempre sopra il resto della pagina,
// così è la prima cosa che si vede tornando dal link.
function AcceptInviteBanner({
  token,
  preview,
  onAccepted,
}: {
  token: string;
  preview: FamilyInvitePreview | null;
  onAccepted: () => void;
}) {
  const router = useRouter();
  const showToast = useNextgenToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleAccept() {
    setBusy(true);
    setError(null);
    const res = await acceptFamilyInviteAction(token);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDone(true);
    showToast(`Ti sei unito alla famiglia "${res.familyName}"!`);
    router.replace("/nextgen/planner/famiglia");
    router.refresh();
    onAccepted();
  }

  if (done) return null;

  if (!preview || !preview.valid) {
    return (
      <div className="mx-5 mt-4 rounded-2xl bg-orange-light p-4 text-[13px] font-medium text-trama-orange">
        Questo invito non è (più) valido — potrebbe essere già stato usato o scaduto.
      </div>
    );
  }

  return (
    <div className="mx-5 mt-4 rounded-2xl bg-trama-lilac/15 p-4">
      <p className="mb-3 text-[13.5px] font-medium text-ink">
        <b>{preview.inviterName || "Un genitore"}</b> ti ha invitato a unirti alla famiglia &quot;
        {preview.familyName}&quot; su TRAMA.
      </p>
      {error && <div className="mb-2 text-[12px] font-medium text-red-500">{error}</div>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleAccept}
          className="rounded-full bg-trama-violet px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Accetto…" : "Accetta l'invito"}
        </button>
      </div>
    </div>
  );
}

function NoFamilyView({ onCreated }: { onCreated: (f: Family) => void }) {
  const router = useRouter();
  const showToast = useNextgenToast();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busyCreate, setBusyCreate] = useState(false);
  const [busyJoin, setBusyJoin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusyCreate(true);
    setError(null);
    const res = await createFamilyAction(name);
    setBusyCreate(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    showToast("Famiglia creata!");
    router.refresh();
    onCreated({
      id: res.familyId!,
      name: name.trim(),
      inviteCode: res.inviteCode!,
      myRole: "creatore",
      members: [],
      pendingInvites: [],
    });
  }

  async function handleJoin() {
    setBusyJoin(true);
    setError(null);
    const res = await joinFamilyByCodeAction(code);
    setBusyJoin(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    showToast(res.alreadyMember ? "Fai già parte di questa famiglia" : "Ti sei unito alla famiglia!");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <p className="text-xs text-ink-2">
        Condividi Indirizzi, &quot;Chi fa cosa?&quot; e Condivisione Piano con l&apos;altro genitore, ognuno col
        proprio account. Bambini e prenotazioni restano sempre solo tuoi.
      </p>

      <div className="rounded-2xl bg-white p-4">
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-3">Crea una famiglia</div>
        <div className="flex flex-col gap-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome (es. Famiglia Rossi)"
            className="rounded-xl border border-[#E8EBF0] px-3 py-2 text-[13.5px] text-ink"
          />
          <button
            type="button"
            disabled={busyCreate}
            onClick={handleCreate}
            className="rounded-full bg-trama-violet px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
          >
            {busyCreate ? "Creo…" : "Crea famiglia"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4">
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Entra con un codice invito
        </div>
        <div className="flex flex-col gap-2.5">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Codice (es. AB2CD9)"
            className="rounded-xl border border-[#E8EBF0] px-3 py-2 text-[13.5px] font-semibold uppercase tracking-wider text-ink"
          />
          <button
            type="button"
            disabled={busyJoin}
            onClick={handleJoin}
            className="rounded-full bg-bg px-4 py-2 text-[12.5px] font-semibold text-ink-2 disabled:opacity-50"
          >
            {busyJoin ? "Entro…" : "Entra nella famiglia"}
          </button>
        </div>
      </div>

      {error && <div className="text-[12px] font-medium text-red-500">{error}</div>}
    </div>
  );
}

// Invito "vero" via email — segnalato da Fabrizio: "il solo codice non è
// sufficiente". Flusso principale (form sopra il box codice), che resta
// comunque disponibile come alternativa manuale (scelta di Fabrizio: tenere
// entrambi). Solo creatore/admin possono invitare — stesso controllo
// lato server in inviteToFamilyAction.
function InviteByEmailBox({ onSent }: { onSent: () => void }) {
  const showToast = useNextgenToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleInvite() {
    setBusy(true);
    setError(null);
    const res = await inviteToFamilyAction(email);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    showToast(res.emailSent ? "Invito inviato!" : "Invito creato (email non configurata — condividi il link a mano)");
    setEmail("");
    onSent();
  }

  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-3">Invita per email</div>
      <div className="flex flex-col gap-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email dell'altro genitore"
          className="rounded-xl border border-[#E8EBF0] px-3 py-2 text-[13.5px] text-ink"
        />
        <button
          type="button"
          disabled={busy || !email.trim()}
          onClick={handleInvite}
          className="rounded-full bg-trama-violet px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Invio…" : "Invia invito"}
        </button>
        {error && <div className="text-[12px] font-medium text-red-500">{error}</div>}
      </div>
    </div>
  );
}

function PendingInvitesList({ invites }: { invites: Family["pendingInvites"] }) {
  if (invites.length === 0) return null;
  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-3">
        In attesa di risposta ({invites.length})
      </div>
      <div className="flex flex-col gap-2">
        {invites.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-medium text-ink">{inv.invitedEmail}</span>
            <span className="flex-shrink-0 rounded-full bg-bg px-2.5 py-1 text-[11px] font-bold text-ink-2">
              {inv.status === "sent" ? "Email inviata" : "In attesa"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FamilyView({ family }: { family: Family }) {
  const router = useRouter();
  const showToast = useNextgenToast();
  const [copied, setCopied] = useState(false);
  const [busyLeave, setBusyLeave] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canInvite = family.myRole === "creatore" || family.myRole === "admin";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(family.inviteCode);
      setCopied(true);
      showToast("Codice copiato!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Non sono riuscito a copiare il codice");
    }
  }

  async function handleLeave() {
    setBusyLeave(true);
    setError(null);
    const res = await leaveFamilyAction();
    setBusyLeave(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    showToast("Hai lasciato la famiglia");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      {canInvite && <InviteByEmailBox onSent={() => router.refresh()} />}
      <PendingInvitesList invites={family.pendingInvites} />

      <div className="rounded-2xl bg-white p-4">
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-3">{family.name}</div>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2.5">
          <span className="text-[15px] font-bold tracking-wider text-ink">{family.inviteCode}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full bg-trama-lilac/20 px-3 py-1.5 text-[12px] font-bold text-trama-violet"
          >
            {copied ? "Copiato!" : "Copia"}
          </button>
        </div>
        <p className="mt-2 text-[11.5px] text-ink-2">
          Condividi questo codice con l&apos;altro genitore: dalla pagina &quot;Famiglia&quot; può usarlo per unirsi.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4">
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Membri ({family.members.length})
        </div>
        <div className="flex flex-col gap-2">
          {family.members.map((m) => (
            <div key={m.parentId} className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-ink">
                  {m.fullName || m.email || "Genitore"}
                  {m.isMe && <span className="ml-1.5 text-[11px] font-medium text-ink-3">(Tu)</span>}
                </div>
              </div>
              <span className="flex-shrink-0 rounded-full bg-bg px-2.5 py-1 text-[11px] font-bold text-ink-2">
                {FAMILY_ROLE_LABELS[m.role]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="text-[12px] font-medium text-red-500">{error}</div>}

      {confirmingLeave ? (
        <div className="rounded-2xl bg-white p-4">
          <p className="mb-3 text-[13px] font-medium text-ink">
            Sicuro di voler uscire da &quot;{family.name}&quot;? Perderai l&apos;accesso condiviso a
            Indirizzi/&quot;Chi fa cosa?&quot;/Condivisione Piano degli altri membri.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busyLeave}
              onClick={handleLeave}
              className="rounded-full bg-red-500 px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
            >
              {busyLeave ? "Esco…" : "Sì, esci"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingLeave(false)}
              className="rounded-full bg-bg px-4 py-2 text-[12.5px] font-semibold text-ink-2"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingLeave(true)}
          className="text-center text-[12.5px] font-semibold text-red-500"
        >
          Esci dalla famiglia
        </button>
      )}
    </div>
  );
}

export default function FamigliaClient({
  initialFamily,
  acceptToken,
  invitePreview,
}: {
  initialFamily: Family | null;
  // Invito via email (?accept=TOKEN, arrivato dal link nell'email) — vedi
  // page.tsx per come vengono letti/passati.
  acceptToken: string | null;
  invitePreview: FamilyInvitePreview | null;
}) {
  const router = useRouter();
  const [createdFamily, setCreatedFamily] = useState<Family | null>(null);
  const [accepted, setAccepted] = useState(false);
  const family = initialFamily ?? createdFamily;

  return (
    <div className="flex min-h-screen flex-col">
      {/* SPRINT 7 — l'hub "Logistica & Famiglia" e' stato eliminato (feedback
          Fabrizio: "Logistica e Famiglia non devono diventare una sezione ad
          hoc?"): Famiglia e' ora raggiungibile da Profilo (vera sezione
          Famiglia, non piu' link separato dal Planner) — "indietro" torna li'. */}
      <PageHeader title="Famiglia" onBack={() => router.push("/nextgen/profile")} showBrandIcon />
      {acceptToken && !accepted && (
        <AcceptInviteBanner token={acceptToken} preview={invitePreview} onAccepted={() => setAccepted(true)} />
      )}
      {family ? <FamilyView family={family} /> : <NoFamilyView onCreated={setCreatedFamily} />}
    </div>
  );
}
