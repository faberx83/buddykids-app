"use client";

// TRAMA — ADMIN BETA COCKPIT · "Aggiungi famiglia invitata": riusa la lista
// d'attesa (stato "invitato"). Quando la famiglia si registra con la stessa
// email, il cockpit la collega da solo.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addInvitedFamilyAction } from "@/app/actions/beta-cockpit";

export default function InviteFamilyForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-white/40 px-3 py-1.5 text-xs font-semibold text-white">
        + Famiglia invitata
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await addInvitedFamilyAction({ email, label });
    setBusy(false);
    if (r.error) setMsg(r.error);
    else {
      setEmail("");
      setLabel("");
      setMsg("Aggiunta.");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-[#E8EBF0] bg-white p-2 text-xs sm:w-auto">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email con cui si registrerà"
        className="min-w-[200px] flex-1 rounded border border-[#E8EBF0] px-2 py-1 text-ink"
      />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={120}
        placeholder="come la chiami (es. Rossi · 3B)"
        className="min-w-[160px] flex-1 rounded border border-[#E8EBF0] px-2 py-1 text-ink"
      />
      <button type="submit" disabled={busy} className="rounded bg-trama-violet px-3 py-1 font-semibold text-white disabled:opacity-50">
        Salva
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-1 text-ink-2">
        Chiudi
      </button>
      {msg && <span className="w-full text-ink-2">{msg} Niente nomi dei figli nell&apos;etichetta.</span>}
    </form>
  );
}
