"use client";

// TRAMA — "LA TUA FAMIGLIA" (15/10/2026). Una pagina, quattro blocchi:
//   1. I tuoi figli   — ProfileKidsSection v2 (stessa logica di sempre:
//                       aggiunta, modifica, scuola);
//   2. Genitori       — tu, l'altro genitore, inviti in attesa; "Invita" crea
//                       il gruppo famiglia da solo (inviteCoParentAction);
//   3. Chi vi aiuta   — nonni e tata sono già scelte fisse; qui le altre
//                       persone (family_people): aggiungi, rinomina, togli;
//   4. Luoghi         — casa, lavoro… (riepilogo, si gestiscono in Indirizzi).
// Le pagine di prima restano: /nextgen/planner/famiglia serve ancora per i
// link d'invito (?accept=), /nextgen/planner/indirizzi per modificare i luoghi.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ProfileKidsSection from "@/components/ProfileKidsSection";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import { inviteCoParentAction, joinFamilyByCodeAction, leaveFamilyAction } from "@/app/actions/family";
import { addFamilyPersonAction, removeFamilyPersonAction, renameFamilyPersonAction } from "@/app/actions/family-people";
import { ADDRESS_KIND_LABELS, type ParentAddress } from "@/lib/nextgen/address-kinds";
import type { Family } from "@/lib/nextgen/family-roles";
import type { FamilyPerson } from "@/lib/nextgen/responsibility-options";
import type { Kid } from "@/lib/types";
import type { KidSchoolProfileSummary } from "@/lib/data/school-calendar";

const CARD = "rounded-2xl border border-trama-line bg-white";
const H2 = "font-poppins text-[18px] font-semibold text-ink";
const INPUT = "min-h-[48px] min-w-0 flex-1 rounded-[12px] border border-trama-line bg-white px-3.5 text-[16px] outline-none focus:border-trama-primary";
const PRIMARY = "min-h-[48px] flex-shrink-0 rounded-[12px] bg-trama-primary px-4 text-[15px] font-semibold text-white active:bg-trama-primary-press disabled:opacity-60";
const LINK = "flex min-h-[44px] items-center text-[14px] font-semibold text-trama-accent-ink";

function initials(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

export default function FamigliaV2Client({
  kids,
  autoOpenAddKid,
  schoolCalendarEnabled,
  schoolProfiles,
  residenceCity,
  family,
  myName,
  myEmail,
  people,
  addresses,
}: {
  kids: Kid[];
  autoOpenAddKid: boolean;
  schoolCalendarEnabled: boolean;
  schoolProfiles: Record<string, KidSchoolProfileSummary>;
  residenceCity: string | null;
  family: Family | null;
  myName: string;
  myEmail: string;
  people: FamilyPerson[];
  addresses: ParentAddress[];
}) {
  return (
    <div className="flex flex-col pb-10">
      <PageHeader title="La tua famiglia" backHref="/nextgen/profile" showBrandIcon />
      <p className="px-5 pt-2 text-[14px] leading-snug text-ink-2">
        Chi sono i tuoi figli, chi se ne occupa con te e da dove partite: TRAMA lo usa nel Planner e in Chi accompagna.
      </p>
      <div className="flex flex-col gap-7 px-5 pt-5">
        <ProfileKidsSection
          initialKids={kids}
          autoOpenAddKid={autoOpenAddKid}
          accent="violet"
          schoolCalendarEnabled={schoolCalendarEnabled}
          schoolProfiles={schoolProfiles}
          residenceCity={residenceCity}
          v2
        />
        <ParentsBlock family={family} myName={myName} myEmail={myEmail} />
        <HelpersBlock people={people} />
        <PlacesBlock addresses={addresses} />
      </div>
    </div>
  );
}

// ─── Genitori ───────────────────────────────────────────────────────────

function ParentsBlock({ family, myName, myEmail }: { family: Family | null; myName: string; myEmail: string }) {
  const router = useRouter();
  const showToast = useNextgenToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");

  const others = (family?.members ?? []).filter((m) => !m.isMe);
  const canInvite = !family || family.myRole === "creatore" || family.myRole === "admin";

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await inviteCoParentAction(email);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setEmail("");
    setLink(res.link ?? null);
    showToast(res.emailSent ? "Invito inviato per email" : "Invito pronto: mandagli il link");
    router.refresh();
  }

  async function shareLink() {
    if (!link) return;
    const text = `Ti invito su TRAMA per organizzare insieme le attività dei bambini: ${link}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "TRAMA", text });
        return;
      }
      await navigator.clipboard.writeText(link);
      showToast("Link copiato");
    } catch {
      // condivisione annullata: niente da fare
    }
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await joinFamilyByCodeAction(code);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    showToast("Ora siete nella stessa famiglia");
    setCode("");
    setShowCode(false);
    router.refresh();
  }

  async function leave() {
    if (!window.confirm("Uscire dalla famiglia? Non vedrai più il piano condiviso con l'altro genitore.")) return;
    const res = await leaveFamilyAction();
    if (res.error) {
      showToast(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <section aria-labelledby="genitori-h" className="flex flex-col gap-2.5">
      <h2 id="genitori-h" className={H2}>
        Genitori
      </h2>
      <ul className={`${CARD} divide-y divide-[#F0F2F5]`}>
        <PersonRow name={myName || "Tu"} detail={`Tu · ${myEmail}`} />
        {others.map((m) => (
          <PersonRow key={m.parentId} name={m.fullName || m.email || "Genitore"} detail={m.email ?? "Nella tua famiglia"} />
        ))}
        {(family?.pendingInvites ?? []).map((i) => (
          <PersonRow key={i.id} name={i.invitedEmail} detail="Invito inviato, in attesa" muted />
        ))}
      </ul>

      {canInvite && (
        <form onSubmit={invite} className="flex flex-col gap-2">
          <label htmlFor="invite-email" className="text-[13.5px] font-semibold text-ink">
            {others.length === 0 ? "Invita l'altro genitore" : "Invita un altro genitore"}
          </label>
          <div className="flex gap-2">
            <input
              id="invite-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="La sua email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
            />
            <button type="submit" disabled={busy || !email.trim()} className={PRIMARY}>
              Invita
            </button>
          </div>
          <p className="text-[12.5px] leading-snug text-ink-2">Vedrete lo stesso Planner e potrete dividervi chi accompagna.</p>
        </form>
      )}
      {link && (
        <button type="button" onClick={shareLink} className={LINK}>
          <i className="ti ti-share mr-1.5" aria-hidden="true" />
          Manda il link anche su WhatsApp
        </button>
      )}
      {error && <p className="text-[13px] font-medium text-[#B3261E]">{error}</p>}

      {!family && (
        <>
          {!showCode ? (
            <button type="button" onClick={() => setShowCode(true)} className={LINK}>
              Hai ricevuto un codice? Entra nella sua famiglia
            </button>
          ) : (
            <form onSubmit={join} className="flex gap-2">
              <label htmlFor="family-code" className="sr-only">
                Codice famiglia
              </label>
              <input
                id="family-code"
                placeholder="Codice"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className={`${INPUT} uppercase tracking-wide`}
              />
              <button type="submit" disabled={busy || !code.trim()} className={PRIMARY}>
                Entra
              </button>
            </form>
          )}
        </>
      )}
      {family && others.length > 0 && (
        <button type="button" onClick={leave} className="flex min-h-[44px] items-center text-[13px] font-semibold text-ink-3">
          Esci dalla famiglia
        </button>
      )}
    </section>
  );
}

function PersonRow({ name, detail, muted = false }: { name: string; detail: string; muted?: boolean }) {
  return (
    <li className="flex min-h-[64px] items-center gap-3 px-4 py-3">
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-poppins text-[15px] font-semibold ${
          muted ? "bg-[#F1F3F6] text-ink-3" : "bg-trama-primary-soft text-trama-primary"
        }`}
      >
        {initials(name)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={`truncate text-[15px] font-semibold ${muted ? "text-ink-2" : "text-ink"}`}>{name}</span>
        <span className="truncate text-[12.5px] text-ink-2">{detail}</span>
      </span>
    </li>
  );
}

// ─── Chi vi aiuta ───────────────────────────────────────────────────────

function HelpersBlock({ people }: { people: FamilyPerson[] }) {
  const router = useRouter();
  const showToast = useNextgenToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await addFamilyPersonAction(name);
    setBusy(false);
    if (res.error) return showToast(res.error);
    setName("");
    router.refresh();
  }

  async function rename(id: string) {
    setBusy(true);
    const res = await renameFamilyPersonAction(id, editName);
    setBusy(false);
    if (res.error) return showToast(res.error);
    setEditing(null);
    router.refresh();
  }

  async function remove(p: FamilyPerson) {
    if (!window.confirm(`Togliere ${p.displayName}? Non comparirà più tra le scelte di Chi accompagna.`)) return;
    const res = await removeFamilyPersonAction(p.id);
    if (res.error) return showToast(res.error);
    router.refresh();
  }

  return (
    <section aria-labelledby="aiuto-h" className="flex flex-col gap-2.5">
      <h2 id="aiuto-h" className={H2}>
        Chi vi aiuta
      </h2>
      <p className="text-[13.5px] leading-snug text-ink-2">
        Nonno, Nonna e Tata ci sono già tra le scelte di Chi accompagna. Aggiungi qui le altre persone: la zia, la vicina,
        il papà di un compagno.
      </p>
      {people.length > 0 && (
        <ul className={`${CARD} divide-y divide-[#F0F2F5]`}>
          {people.map((p) =>
            editing === p.id ? (
              <li key={p.id} className="px-4 py-3">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void rename(p.id);
                  }}
                >
                  <label htmlFor={`rename-${p.id}`} className="sr-only">
                    Nuovo nome
                  </label>
                  <input id={`rename-${p.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} className={INPUT} />
                  <button type="submit" disabled={busy} className={PRIMARY}>
                    Salva
                  </button>
                </form>
              </li>
            ) : (
              <li key={p.id} className="flex min-h-[64px] items-center gap-3 px-4 py-2">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-trama-accent-soft font-poppins text-[15px] font-semibold text-trama-accent-ink">
                  {initials(p.displayName)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{p.displayName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(p.id);
                    setEditName(p.displayName);
                  }}
                  className="min-h-[44px] px-2 text-[13.5px] font-semibold text-trama-accent-ink"
                >
                  Rinomina
                </button>
                <button type="button" onClick={() => remove(p)} className="min-h-[44px] px-2 text-[13.5px] font-semibold text-ink-3">
                  Togli
                </button>
              </li>
            )
          )}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2">
        <label htmlFor="helper-name" className="sr-only">
          Nome della persona
        </label>
        <input id="helper-name" placeholder="Es. Zia Carla" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        <button type="submit" disabled={busy || !name.trim()} className={PRIMARY}>
          Aggiungi
        </button>
      </form>
    </section>
  );
}

// ─── Luoghi ─────────────────────────────────────────────────────────────

function PlacesBlock({ addresses }: { addresses: ParentAddress[] }) {
  const set = addresses.filter((a) => a.address.trim());
  return (
    <section aria-labelledby="luoghi-h" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 id="luoghi-h" className={H2}>
          Luoghi
        </h2>
        <Link href="/nextgen/planner/indirizzi" className={LINK}>
          {set.length > 0 ? "Modifica" : "Aggiungi"}
        </Link>
      </div>
      {set.length > 0 ? (
        <ul className={`${CARD} divide-y divide-[#F0F2F5]`}>
          {set.map((a) => (
            <li key={a.kind} className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
              <i className="ti ti-map-pin text-[18px] text-trama-primary" aria-hidden="true" />
              <span className="flex min-w-0 flex-col">
                <span className="text-[14.5px] font-semibold text-ink">{a.label?.trim() || ADDRESS_KIND_LABELS[a.kind]}</span>
                <span className="truncate text-[12.5px] text-ink-2">{a.address}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[20px] border border-dashed border-[#D6DAE3] bg-white p-4 text-[13.5px] leading-snug text-ink-2">
          Casa e lavoro servono per la Mappa del Planner e per i promemoria di partenza.
        </p>
      )}
    </section>
  );
}
