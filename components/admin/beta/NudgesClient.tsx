"use client";

// TRAMA — SOLLECITI ALLE FAMIGLIE DELLA BETA (20/11/2026). Fabrizio: "dobbiamo
// definire una campagna di push per 'sollecitare' chi non si è iscritto".
// Beta Famiglie → Frizioni: per ogni sollecito quante persone lo riceverebbero,
// il testo della push e "Invia" (con conferma). Sotto, i messaggi WhatsApp per
// chi ha ricevuto il link d'invito e non si è ancora registrato.

import { useState } from "react";
import { sendNudgeCampaignAction } from "@/app/actions/beta-nudges";
import { WHATSAPP_NUDGES } from "@/lib/beta-cockpit/nudges";
import type { NudgeOverviewRow } from "@/lib/data/beta-nudges";

function when(iso: string | null): string {
  if (!iso) return "mai inviato";
  return `ultimo invio ${new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}`;
}

export default function NudgesClient({ rows, defaultLink }: { rows: NudgeOverviewRow[] | null; defaultLink: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, string>>({});
  const [link, setLink] = useState(defaultLink);
  const [copied, setCopied] = useState<number | null>(null);

  async function send(key: string) {
    setBusy(key);
    const r = await sendNudgeCampaignAction(key);
    setBusy(null);
    setConfirm(null);
    setResult((prev) => ({
      ...prev,
      [key]: r.ok
        ? `Inviato a ${r.people} ${r.people === 1 ? "persona" : "persone"} (push a chi le ha accese, ${r.emails} email)${r.skippedCooldown ? `; ${r.skippedCooldown} saltate perché già sollecitate da meno di 7 giorni` : ""}.`
        : r.error,
    }));
  }

  async function copy(i: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3">
          <h2 className="text-sm font-bold text-ink">Solleciti alle famiglie registrate</h2>
          <p className="mt-0.5 text-xs text-ink-2">
            Push a chi ha le notifiche accese ed email a chi non le ha spente. Mai agli account di prova, mai lo stesso sollecito alla stessa
            persona prima di 7 giorni. Parte solo quando premi Invia.
          </p>
        </div>
        {!rows ? (
          <p className="px-4 py-3 text-sm text-ink-2">Dati non disponibili.</p>
        ) : (
          <ul className="divide-y divide-[#F0F2F5]">
            {rows.map((r) => (
              <li key={r.key} className="px-4 py-3" data-testid={`nudge-${r.key}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink">{r.audience}</div>
                    <div className="mt-0.5 text-xs text-ink-2">
                      {r.families} {r.families === 1 ? "famiglia" : "famiglie"} · {r.recipients} {r.recipients === 1 ? "persona" : "persone"} da sollecitare ora ·{" "}
                      {when(r.lastSentAt)}
                    </div>
                    <div className="mt-2 rounded-md bg-[#F7F8FA] px-3 py-2 text-xs text-ink">
                      <b>{r.push.title}</b>
                      <br />
                      {r.push.body}
                    </div>
                  </div>
                  {confirm === r.key ? (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirm(null)} className="rounded-md border border-[#D8DEE8] px-3 py-1.5 text-xs font-semibold text-ink-2">
                        Annulla
                      </button>
                      <button
                        type="button"
                        disabled={busy === r.key}
                        onClick={() => void send(r.key)}
                        className="rounded-md bg-[#172A4D] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {busy === r.key ? "Invio…" : `Conferma: invia a ${r.recipients}`}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={r.recipients === 0}
                      onClick={() => setConfirm(r.key)}
                      className="rounded-md bg-[#172A4D] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                    >
                      Invia
                    </button>
                  )}
                </div>
                {result[r.key] && <p className="mt-2 text-xs font-medium text-[#1F7A55]">{result[r.key]}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3">
          <h2 className="text-sm font-bold text-ink">Messaggi WhatsApp per chi non si è ancora registrato</h2>
          <p className="mt-0.5 text-xs text-ink-2">L&apos;app non sa a chi hai mandato il link: copia il messaggio e mandalo tu.</p>
        </div>
        <div className="px-4 py-3">
          <label className="mb-3 block text-xs font-semibold text-ink-2">
            Link d&apos;invito
            <input value={link} onChange={(e) => setLink(e.target.value)} className="mt-1 w-full rounded-md border border-[#D8DEE8] px-2 py-1.5 text-sm font-normal" />
          </label>
          <ul className="flex flex-col gap-3">
            {WHATSAPP_NUDGES.map((m, i) => {
              const text = m.text.replace("{link}", link);
              return (
                <li key={m.label} className="rounded-md border border-[#E8EBF0] p-3">
                  <div className="mb-1 text-xs font-bold text-ink">{m.label}</div>
                  <p className="text-sm text-ink">{text}</p>
                  <button type="button" onClick={() => void copy(i, text)} className="mt-2 rounded-md border border-[#D8DEE8] px-3 py-1 text-xs font-semibold text-ink">
                    {copied === i ? "Copiato ✓" : "Copia"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
