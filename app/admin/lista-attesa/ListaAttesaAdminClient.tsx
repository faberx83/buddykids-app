"use client";

// TRAMA — LISTA D'ATTESA (20/10/2026). Chi ha chiesto un invito dalla pagina
// di benvenuto. Per ognuno: "Scrivi l'invito" apre l'email già pronta con il
// link di un codice Inviti Beta attivo (o, se non ce n'è, senza link), poi
// "Segna invitato". Stato locale seedato dal server, aggiornamento ottimistico.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { WaitlistAdminData, WaitlistItem, WaitlistStatus } from "@/lib/data/waitlist";
import { updateWaitlistStatusAction } from "@/app/actions/waitlist-admin";

const STATUS: Record<WaitlistStatus, { label: string; cls: string }> = {
  nuovo: { label: "Nuova", cls: "bg-orange-light text-trama-orange" },
  invitato: { label: "Invitata", cls: "bg-green-light text-[#2d8f52]" },
  archiviato: { label: "Archiviata", cls: "bg-[#EEF0F4] text-[#6B7280]" },
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
  const [filter, setFilter] = useState<WaitlistStatus | "tutte">("nuovo");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      nuovo: items.filter((i) => i.status === "nuovo").length,
      invitato: items.filter((i) => i.status === "invitato").length,
      archiviato: items.filter((i) => i.status === "archiviato").length,
    }),
    [items]
  );
  const shown = items.filter((i) => filter === "tutte" || i.status === filter);

  async function setStatus(id: string, status: WaitlistStatus) {
    setBusy(id);
    setError(null);
    const res = await updateWaitlistStatusAction(id, status);
    setBusy(null);
    if (res.error) return setError(res.error);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status, invitedAt: status === "invitato" ? new Date().toISOString() : null } : i)));
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Lista d&apos;attesa</h1>
        <p className="text-sm text-navy-text2">
          Chi ha chiesto un invito dalla pagina di benvenuto (tramapp.it/benvenuto). Scrivi l&apos;invito, poi segnalo come invitato.
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

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Visite (30 giorni)", value: data.views30d ?? "—" },
          { label: "Da invitare", value: counts.nuovo },
          { label: "Invitate", value: counts.invitato },
          { label: "Archiviate", value: counts.archiviato },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-[#E8EBF0] bg-white p-3">
            <div className="text-xs text-ink-2">{c.label}</div>
            <div className="text-xl font-bold text-ink">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtra per stato">
        {(["nuovo", "invitato", "archiviato", "tutte"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === f ? "bg-white text-ink" : "bg-white/10 text-white"}`}
          >
            {f === "tutte" ? "Tutte" : STATUS[f].label}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm font-medium text-orange">{error}</p>}

      {shown.length === 0 ? (
        <p className="rounded-lg border border-[#E8EBF0] bg-white p-4 text-sm text-ink-2">Nessuna richiesta qui.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((i) => (
            <li key={i.id} className="rounded-lg border border-[#E8EBF0] bg-white p-4 text-sm text-ink">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{i.email}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS[i.status].cls}`}>{STATUS[i.status].label}</span>
                <span className="text-xs text-ink-2">{dateIt(i.createdAt)}</span>
              </div>
              <div className="mt-1 text-xs text-ink-2">
                {[i.comune, i.kidsCount ? `${i.kidsCount >= 4 ? "4 o più" : i.kidsCount} ${i.kidsCount === 1 ? "figlio" : "figli"}` : null, i.source ? `da ${i.source}` : null]
                  .filter(Boolean)
                  .join(" · ") || "Nessun dettaglio"}
              </div>
              {i.note && <p className="mt-2 whitespace-pre-line rounded-md bg-[#F7F9FC] p-2 text-[13px]">{i.note}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={inviteMailto(i, inviteCode)} className="rounded-md bg-trama-primary px-3 py-1.5 text-xs font-bold text-white">
                  Scrivi l&apos;invito
                </a>
                {i.status !== "invitato" && (
                  <button type="button" disabled={busy === i.id} onClick={() => setStatus(i.id, "invitato")} className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                    Segna invitata
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
          ))}
        </ul>
      )}
    </div>
  );
}
