"use client";

import { useRef, useState } from "react";
import { DemoBadge } from "@/components/StatusBadge";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { InviteItem, InviteStatus } from "@/lib/data/invites";
import {
  createInviteAction,
  createInvitesBulkAction,
  toggleInviteActiveAction,
  InviteContactInput,
} from "@/app/actions/invites";

const STATUS_LABEL: Record<InviteStatus, string> = {
  pending: "Da inviare",
  sent: "Inviato",
  registered: "Registrato",
  redeemed: "Sconto usato",
  expired: "Scaduto",
};

const STATUS_CLASSES: Record<InviteStatus, string> = {
  pending: "bg-[#F4F6FA] text-ink-3",
  sent: "bg-sky-light text-sky",
  registered: "bg-green-light text-[#2d8f52]",
  redeemed: "bg-purple-light text-[#6b58d4]",
  expired: "bg-orange-light text-trama-orange",
};

function parseContactsCsv(text: string): InviteContactInput[] {
  // Parser volutamente semplice: una riga per contatto, colonne separate da
  // virgola, ordine "nome,email,telefono" (header opzionale, riconosciuto e
  // scartato se la prima riga contiene "email" o "mail"). Non gestisce virgole
  // dentro ai campi (es. nomi tra virgolette) — per liste semplici va bene,
  // per casi più complessi meglio inserire i contatti uno a uno.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const first = lines[0].toLowerCase();
  const startIdx = first.includes("email") || first.includes("mail") ? 1 : 0;

  const contacts: InviteContactInput[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    const [name, email, phone] = parts;
    if (!email && !phone) continue;
    contacts.push({
      contactName: name || undefined,
      contactEmail: email || undefined,
      contactPhone: phone || undefined,
    });
  }
  return contacts;
}

export default function InvitesClient({
  initialInvites,
  hasCenterId,
}: {
  initialInvites: InviteItem[];
  hasCenterId: boolean;
}) {
  const [invites, setInvites] = useState(initialInvites);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [discountPercent, setDiscountPercent] = useState(10);
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ link: string; emailSent: boolean } | null>(null);
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleCreateSingle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLastResult(null);
    if (!contactEmail.trim() && !contactPhone.trim()) {
      setError("Inserisci almeno un'email o un numero di telefono");
      return;
    }
    setSaving(true);
    const result = await createInviteAction({
      contactName: contactName.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      promoDiscountPercent: discountPercent,
      promoExpiresAt: expiresAt || null,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLastResult({ link: result.inviteLink!, emailSent: Boolean(result.emailSent) });
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setInvites((prev) => [
      {
        id: `local-${Date.now()}`,
        contactName: contactName.trim() || null,
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        inviteCode: result.inviteCode!,
        promoDiscountPercent: discountPercent,
        promoExpiresAt: expiresAt || null,
        active: true,
        status: result.emailSent ? "sent" : "pending",
        emailSentAt: result.emailSent ? new Date().toISOString() : null,
        registeredAt: null,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  async function handleFile(file: File) {
    setError(null);
    setBulkSummary(null);
    const text = await file.text();
    const contacts = parseContactsCsv(text);
    if (contacts.length === 0) {
      setError("Nessun contatto valido trovato nel file (serve almeno email o telefono per riga).");
      return;
    }
    setSaving(true);
    const result = await createInvitesBulkAction(contacts, discountPercent, expiresAt || null);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setBulkSummary(
      `Creati ${result.createdCount} inviti su ${contacts.length} righe (${result.emailSentCount} email inviate automaticamente)` +
        (result.failedRows.length > 0 ? ` — ${result.failedRows.length} righe non valide: ${result.failedRows.join(", ")}` : "")
    );
    // Ricarica la lista dal server per semplicità (più affidabile che
    // ricostruire N righe lato client con i loro codici reali).
    window.location.reload();
  }

  async function handleToggleActive(id: string, active: boolean) {
    setInvites((prev) => prev.map((i) => (i.id === id ? { ...i, active } : i)));
    if (!id.startsWith("local-")) {
      const result = await toggleInviteActiveAction(id, active);
      if (result.error) setError(result.error);
    }
  }

  function copyLink(code: string) {
    const link = `${window.location.origin}/auth/login?invite=${code}`;
    navigator.clipboard?.writeText(link);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-ink">Inviti</h1>
          {!isSupabaseConfigured && <DemoBadge />}
        </div>
        <p className="text-sm text-ink-2">
          Invita famiglie su TRAMA con un codice promo a scadenza — una alla volta o caricando
          un file con più contatti.
        </p>
      </div>

      {!hasCenterId && isSupabaseConfigured && (
        <div className="mb-5 rounded-md bg-orange-light px-4 py-3 text-sm text-trama-orange">
          Il tuo account non è ancora collegato a un centro — non puoi ancora creare inviti.
        </div>
      )}

      <div className="mb-6 rounded-lg border border-[#E8EBF0] bg-white p-5">
        <div className="mb-3 text-sm font-bold text-ink">Sconto promo</div>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">
              Sconto sulla prima prenotazione
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={90}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="w-24 rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-partner"
              />
              <span className="text-sm text-ink-2">%</span>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">
              Scadenza (opzionale)
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-partner"
            />
          </div>
        </div>
        <p className="text-xs text-ink-2">
          Valgono per i contatti aggiunti qui sotto, sia uno a uno sia da file. Puoi disattivare un
          singolo invito in qualsiasi momento dalla tabella, anche prima della scadenza.
        </p>
      </div>

      <div className="mb-6 grid gap-5 md:grid-cols-2">
        <form
          onSubmit={handleCreateSingle}
          className="rounded-lg border border-[#E8EBF0] bg-white p-5"
        >
          <div className="mb-3 text-sm font-bold text-ink">Invita un contatto</div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-2">Nome (opzionale)</label>
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="mb-3 w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-partner"
            placeholder="Es. Maria Rossi"
          />
          <label className="mb-1.5 block text-xs font-semibold text-ink-2">Email</label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="mb-3 w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-partner"
            placeholder="mamma@esempio.it"
          />
          <label className="mb-1.5 block text-xs font-semibold text-ink-2">Telefono</label>
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="mb-4 w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-partner"
            placeholder="+39 333 1234567"
          />
          <button
            type="submit"
            disabled={saving || !hasCenterId}
            className="w-full rounded-md bg-partner px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Creo…" : "Crea invito"}
          </button>
          {lastResult && (
            <div className="mt-3 rounded-md bg-partner-light px-3 py-2.5 text-xs text-ink">
              {lastResult.emailSent ? (
                <p className="mb-1.5 font-semibold text-[#2d8f52]">✓ Email inviata automaticamente</p>
              ) : (
                <p className="mb-1.5 font-semibold text-[#9a6b00]">
                  Email non inviata automaticamente — copia il link e mandalo tu (WhatsApp, SMS,
                  email personale…)
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={lastResult.link}
                  className="flex-1 truncate rounded border border-[#E8EBF0] bg-white px-2 py-1.5 text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(lastResult.link)}
                  className="flex-shrink-0 rounded border border-[#E8EBF0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink"
                >
                  Copia
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="rounded-lg border border-[#E8EBF0] bg-white p-5">
          <div className="mb-1.5 text-sm font-bold text-ink">Carica un file di contatti</div>
          <p className="mb-3 text-xs text-ink-2">
            File .csv/.txt, una riga per contatto: <code className="rounded bg-bg px-1">nome,email,telefono</code>{" "}
            (email o telefono obbligatorio, nome facoltativo). Prima riga con intestazione
            riconosciuta automaticamente e ignorata.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={saving || !hasCenterId}
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-md border-[1.5px] border-dashed border-partner px-4 py-3 text-sm font-semibold text-partner disabled:opacity-60"
          >
            {saving ? "Carico…" : "+ Scegli file"}
          </button>
          {bulkSummary && <p className="mt-3 text-xs text-ink-2">{bulkSummary}</p>}
        </div>
      </div>

      {error && <p className="mb-4 text-xs font-medium text-orange">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
              <th className="px-4 py-3 font-medium">Contatto</th>
              <th className="px-4 py-3 font-medium">Codice</th>
              <th className="px-4 py-3 font-medium">Sconto</th>
              <th className="px-4 py-3 font-medium">Scadenza</th>
              <th className="px-4 py-3 font-medium">Stato</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.id} className="border-b border-[#F0F2F5] last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{inv.contactName || "—"}</div>
                  <div className="text-xs text-ink-2">
                    {[inv.contactEmail, inv.contactPhone].filter(Boolean).join(" · ") || "—"}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-2">{inv.inviteCode}</td>
                <td className="px-4 py-3 text-ink-2">{inv.promoDiscountPercent}%</td>
                <td className="px-4 py-3 text-ink-2">
                  {inv.promoExpiresAt
                    ? new Date(inv.promoExpiresAt + "T00:00:00Z").toLocaleDateString("it-IT", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      })
                    : "Nessuna"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLASSES[inv.status]}`}>
                    {STATUS_LABEL[inv.status]}
                  </span>
                  {!inv.active && (
                    <span className="ml-1.5 rounded-full bg-[#F4F6FA] px-2 py-1 text-[10px] font-semibold text-ink-3">
                      Disattivato
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => copyLink(inv.inviteCode)}
                    className="mr-3 text-xs font-medium text-sky"
                  >
                    Copia link
                  </button>
                  {inv.status === "pending" || inv.status === "sent" ? (
                    <button
                      onClick={() => handleToggleActive(inv.id, !inv.active)}
                      className="text-xs font-medium text-orange"
                    >
                      {inv.active ? "Disattiva" : "Riattiva"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {invites.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-ink-2">
                  Nessun invito creato ancora — crea il primo qui sopra.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-5 text-[11px] text-ink-3">
        {isSupabaseConfigured
          ? "L'invio email automatico richiede una chiave Resend configurata lato sviluppo — finché non è impostata, copia il link e invialo tu (WhatsApp, SMS, email personale…)."
          : "Modalità demo: gli inviti creati qui non vengono salvati — collega Supabase per renderli reali."}
      </p>
    </div>
  );
}
