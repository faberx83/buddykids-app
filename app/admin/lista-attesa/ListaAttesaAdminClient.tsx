"use client";

// TRAMA — LISTA D'ATTESA (20/10/2026). Chi ha chiesto un invito dalla pagina
// di benvenuto. Per ognuno: "Scrivi l'invito" apre l'email già pronta con il
// link di un codice Inviti Beta attivo (o, se non ce n'è, senza link), poi
// "Segna invitato". Stato locale seedato dal server, aggiornamento ottimistico.
// ADMIN OPERATIVO (12/11/2026): "copiare un link non equivale a inviarlo" —
// "Scrivi l'invito" prepara soltanto (apre la posta); la riga diventa
// "Invito inviato" solo con "Segna come inviato", da premere dopo l'invio.
// Funnel completo in /admin/famiglie.
// LOTTO 2 (16/11/2026): filtri e conteggi seguono la regola unica di
// lib/admin-ops/invitations.ts (inviteQueueState), la stessa di Oggi e di
// Famiglie: chi ha già un account non è "Da invitare", resta visibile come
// "Registrata · invio non segnato" e non si può più segnare come inviata
// (la data sarebbe inventata).

import { useMemo, useState } from "react";
import Link from "next/link";
import type { WaitlistAdminData, WaitlistItem, WaitlistStatus } from "@/lib/data/waitlist";
import { updateWaitlistStatusAction } from "@/app/actions/waitlist-admin";
import { INVITE_QUEUE_RULE, inviteNotMarked, inviteQueueState, type InviteQueueState } from "@/lib/admin-ops/invitations";

type Filter = InviteQueueState | "tutte";

const STATE: Record<InviteQueueState, { label: string; cls: string }> = {
  da_invitare: { label: "Da invitare", cls: "bg-orange-light text-trama-orange" },
  invito_segnato: { label: "Invito inviato", cls: "bg-sky-light text-sky" },
  registrata: { label: "Registrata", cls: "bg-green-light text-[#2d8f52]" },
  archiviata: { label: "Archiviata", cls: "bg-[#EEF0F4] text-[#6B7280]" },
};


function dateIt(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

export function inviteMailto(item: Pick<WaitlistItem, "email">, inviteCode: string | null): string {
  const link = inviteCode ? `https://tramapp.it/auth/login?beta=${inviteCode}` : "https://tramapp.it";
  const body = [
    "Ciao,",
    "",
    "grazie per l'interesse per TRAMA! C'è posto per la tua famiglia nella beta.",
    "",
    `Apri questo link dal telefono e crea il tuo account: ${link}`,
    "",
    "Ci vogliono due minuti: aggiungi i figli e i loro impegni, poi decidi chi porta e chi ritira.",
    "Per qualsiasi cosa rispondi pure a questa email.",
    "",
    "Fabrizio — TRAMA",
  ].join("\n");
  return `mailto:${item.email}?subject=${encodeURIComponent("Il tuo invito a TRAMA")}&body=${encodeURIComponent(body)}`;
}

export default function ListaAttesaAdminClient({ data, inviteCode }: { data: WaitlistAdminData; inviteCode: string | null }) {
  const [items, setItems] = useState(data.items);
  const [filter, setFilter] = useState<Filter>("da_invitare");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stateOf = (i: WaitlistItem) => inviteQueueState(i, i.account);
  const counts = useMemo(() => {
    const c: Record<InviteQueueState, number> = { da_invitare: 0, invito_segnato: 0, registrata: 0, archiviata: 0 };
    for (const i of items) c[inviteQueueState(i, i.account)]++;
    return c;
  }, [items]);
  const shown = items.filter((i) => filter === "tutte" || stateOf(i) === filter);

  async function setStatus(id: string, status: WaitlistStatus) {
    setBusy(id);
    setError(null);
    const res = await updateWaitlistStatusAction(id, status);
    setBusy(null);
    if (res.error) return setError(res.error);
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status, invitedAt: status === "invitato" ? new Date().toISOString() : status === "nuovo" ? null : i.invitedAt }
          : i
      )
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Lista d&apos;attesa</h1>
        <p className="text-sm text-navy-text2">
          Chi ha chiesto un invito dalla pagina di benvenuto (tramapp.it/benvenuto). &quot;Scrivi l&apos;invito&quot; prepara l&apos;email; dopo averla spedita, premi &quot;Segna come inviato&quot;. Fasi complete in Famiglie → Inviti e registrazioni.
        </p>
      </div>

      {!data.tableReady && (
        <div className="mb-5 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          La tabella della lista d&apos;attesa non c&apos;è ancora: applica supabase/migration_44_beta_waitlist.sql (deploy.sh te la
          propone, scrivi APPLICA). Fino ad allora il modulo della pagina di benvenuto risponde &quot;scrivici a privacy@tramapp.it&quot;.
        </div>
      )}
      {!inviteCode && (
        <div className="mb-5 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          Nessun codice Inviti Beta attivo: l&apos;email pronta non conterrà il link. Creane uno in{" "}
          <Link href="/admin/beta-invites" className="font-semibold underline">
            Inviti Beta
          </Link>
          .
        </div>
      )}

      <p className="mb-2 text-xs text-navy-text2" data-testid="invite-queue-rule">
        {INVITE_QUEUE_RULE} Archiviate: {counts.archiviata}.
      </p>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Visite (30 giorni)", value: data.views30d ?? "—" },
          { label: "Da invitare", value: counts.da_invitare },
          { label: "Invito inviato (segnato)", value: counts.invito_segnato },
          { label: "Già registrate", value: counts.registrata },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-[#E8EBF0] bg-white p-3">
            <div className="text-xs text-ink-2">{c.label}</div>
            <div className="text-xl font-bold text-ink">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtra per stato">
        {(["da_invitare", "invito_segnato", "registrata", "archiviata", "tutte"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === f ? "bg-white text-ink" : "bg-white/10 text-white"}`}
          >
            {f === "tutte" ? "Tutte" : `${STATE[f].label} · ${counts[f]}`}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm font-medium text-orange">{error}</p>}

      {shown.length === 0 ? (
        <p className="rounded-lg border border-[#E8EBF0] bg-white p-4 text-sm text-ink-2">Nessuna richiesta qui.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((i) => {
            const st = stateOf(i);
            const notMarked = inviteNotMarked(i, i.account);
            return (
            <li key={i.id} data-testid={`waitlist-row-${i.id}`} className="rounded-lg border border-[#E8EBF0] bg-white p-4 text-sm text-ink">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{i.email}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATE[st].cls}`}>
                  {STATE[st].label}
                  {st === "registrata" && notMarked ? " · invio non segnato" : ""}
                </span>
                <span className="text-xs text-ink-2">richiesta {dateIt(i.createdAt)}</span>
                {i.invitedAt && <span className="text-xs text-ink-2">· invio segnato {dateIt(i.invitedAt)}</span>}
              </div>
              {i.account && (
                <p className="mt-1 text-xs text-ink-2">
                  Account creato il {dateIt(i.account.createdAt)}
                  {i.account.betaCode ? ` con il codice ${i.account.betaCode}` : ""}
                  {notMarked ? ". L'invio non è stato segnato: nessuna data d'invio registrata." : "."}{" "}
                  {i.account.inPilot ? (
                    <Link href={`/admin/one/pilot/${i.account.id}`} className="font-semibold text-sky">
                      Scheda Pilota →
                    </Link>
                  ) : (
                    <span>Non è nella coorte Pilota.</span>
                  )}
                </p>
              )}
              <div className="mt-1 text-xs text-ink-2">
                {[i.comune, i.kidsCount ? `${i.kidsCount >= 4 ? "4 o più" : i.kidsCount} ${i.kidsCount === 1 ? "figlio" : "figli"}` : null, i.source ? `da ${i.source}` : null]
                  .filter(Boolean)
                  .join(" · ") || "Nessun dettaglio"}
              </div>
              {i.note && <p className="mt-2 whitespace-pre-line rounded-md bg-[#F7F9FC] p-2 text-[13px]">{i.note}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {!i.account && (
                  <a href={inviteMailto(i, inviteCode)} className="rounded-md bg-trama-primary px-3 py-1.5 text-xs font-bold text-white">
                    Scrivi l&apos;invito (prepara)
                  </a>
                )}
                {i.status !== "invitato" && !i.account && (
                  <button type="button" disabled={busy === i.id} onClick={() => setStatus(i.id, "invitato")} className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                    Segna come inviato
                  </button>
                )}
                {i.status !== "archiviato" && (
                  <button type="button" disabled={busy === i.id} onClick={() => setStatus(i.id, "archiviato")} className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink-2 disabled:opacity-60">
                    Archivia
                  </button>
                )}
                {i.status !== "nuovo" && (
                  <button type="button" disabled={busy === i.id} onClick={() => setStatus(i.id, "nuovo")} className="rounded-md px-3 py-1.5 text-xs font-semibold text-ink-2 disabled:opacity-60">
                    Rimetti tra le nuove
                  </button>
                )}
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
