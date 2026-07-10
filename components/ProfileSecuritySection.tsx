"use client";

import { useState } from "react";
import { changePasswordAction } from "@/app/actions/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Sottosezione "Sicurezza" (dentro Impostazioni) — condivisa tra genitore e
// gestore centro (entrambi usano la stessa auth.users/profiles). Copre il
// cambio password; l'accesso con dati biometrici (Face ID/impronta, via
// WebAuthn/passkey) è mostrato come "Prossimamente": richiede
// un'integrazione più ampia con Supabase Auth (MFA/passkey) non ancora
// presente — 2FA e gestione dispositivi/sessioni attive restano nella
// stessa fase successiva.
export default function ProfileSecuritySection() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSuccess(false);
    if (newPassword.length < 8) {
      setError("La password deve avere almeno 8 caratteri");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Le due password non coincidono");
      return;
    }
    if (!isSupabaseConfigured) {
      setSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      return;
    }
    setSaving(true);
    const result = await changePasswordAction(newPassword);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="rounded-lg bg-white p-3.5">
      <label htmlFor="security-new-password" className="mb-1.5 block text-xs font-semibold text-ink-2">
        Nuova password
      </label>
      <input
        id="security-new-password"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="Almeno 8 caratteri"
        className="mb-3 w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
      />
      <label htmlFor="security-confirm-password" className="mb-1.5 block text-xs font-semibold text-ink-2">
        Conferma nuova password
      </label>
      <input
        id="security-confirm-password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="mb-3 w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
      />
      {error && <p className="mb-2 text-xs font-medium text-orange">{error}</p>}
      {success && <p className="mb-2 text-xs font-medium text-teal">Password aggiornata.</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="rounded-md bg-sky px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
      >
        {saving ? "Salvo…" : "Aggiorna password"}
      </button>

      <div className="mt-3.5 flex items-center justify-between border-t border-[#E8EBF0] pt-3.5">
        <div>
          <div className="text-sm text-ink">Accesso con Face ID / impronta</div>
          <div className="text-[11px] text-ink-2">Accesso rapido senza password</div>
        </div>
        <span className="rounded-full bg-bg px-2.5 py-1 text-[10px] font-semibold text-ink-2">
          Prossimamente
        </span>
      </div>
    </div>
  );
}
