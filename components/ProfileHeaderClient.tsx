"use client";

import { useState } from "react";
import type { ParentRole, Gender, BusinessRole } from "@/lib/data/profile";
import { updateParentProfileAction, updateParentAvatarAction } from "@/app/actions/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import AvatarUploadButton from "@/components/AvatarUploadButton";

const roleLabels: Record<ParentRole, string> = {
  padre: "Padre",
  madre: "Madre",
  tutore: "Tutore/tutrice",
};

const genderLabels: Record<Gender, string> = {
  M: "Uomo",
  F: "Donna",
  altro: "Altro",
};

// Segnalazione di Fabrizio: "nella scheda profilo gestore forse non serve
// avere genere e data di nascita ma altre info più legate al business" —
// per il gestore sostituiamo quei due campi con il ruolo aziendale.
const businessRoleLabels: Record<BusinessRole, string> = {
  titolare: "Titolare",
  responsabile: "Responsabile struttura",
  amministrazione: "Amministrazione",
  staff: "Staff",
};

export default function ProfileHeaderClient({
  initialFullName,
  initialParentRole,
  initialAvatarUrl,
  email,
  autoOpenEdit,
  initialPhone = "",
  initialDateOfBirth = null,
  initialGender = null,
  initialBusinessRole = null,
  showRoleSelector = true,
  showPersonalDetails = true,
  showBusinessRole = false,
  accent = "sky",
}: {
  initialFullName: string;
  initialParentRole: ParentRole | null;
  initialAvatarUrl?: string | null;
  email: string;
  autoOpenEdit?: boolean;
  initialPhone?: string;
  initialDateOfBirth?: string | null;
  initialGender?: Gender | null;
  initialBusinessRole?: BusinessRole | null;
  // La selezione "Sei: Padre/Madre/Tutore" ha senso solo per il profilo
  // genitore — nella pagina "Il mio account" del gestore viene nascosta.
  showRoleSelector?: boolean;
  // Genere e data di nascita: rilevanti per il genitore, non per il profilo
  // aziendale del gestore (vedi showBusinessRole più sotto).
  showPersonalDetails?: boolean;
  // Solo lato gestore: mostra "Ruolo in azienda" al posto di genere/data di
  // nascita.
  showBusinessRole?: boolean;
  // SPRINT 6 (NEXTGEN) — Profilo NEXTGEN usa il viola del brand (trama-violet)
  // invece dell'azzurro "sky" di LEGACY; opt-in con default invariato così il
  // profilo genitore LEGACY (/profile) e "Il mio account" del gestore
  // (/center/account) restano identici a prima.
  accent?: "sky" | "violet";
}) {
  const accentBorder = accent === "violet" ? "focus:border-trama-violet" : "focus:border-sky";
  const accentActive = accent === "violet" ? "border-trama-violet bg-trama-violet text-white" : "border-sky bg-sky text-white";
  const accentBg = accent === "violet" ? "bg-trama-violet" : "bg-sky";
  const [editing, setEditing] = useState(Boolean(autoOpenEdit));
  const [fullName, setFullName] = useState(initialFullName);
  const [parentRole, setParentRole] = useState<ParentRole | "">(initialParentRole ?? "");
  const [phone, setPhone] = useState(initialPhone);
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth ?? "");
  const [gender, setGender] = useState<Gender | "">(initialGender ?? "");
  const [businessRole, setBusinessRole] = useState<BusinessRole | "">(initialBusinessRole ?? "");
  const [displayName, setDisplayName] = useState(initialFullName || email.split("@")[0]);
  const [savedRole, setSavedRole] = useState(initialParentRole);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAvatarUploaded(url: string) {
    setAvatarUrl(url);
    if (isSupabaseConfigured) {
      await updateParentAvatarAction(url);
    }
  }

  const initials =
    (displayName || "?")
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  async function handleSave() {
    setError(null);
    if (!fullName.trim() || (showRoleSelector && !parentRole)) {
      setError(showRoleSelector ? "Inserisci nome e cognome e scegli un ruolo" : "Inserisci nome e cognome");
      return;
    }
    if (!isSupabaseConfigured) {
      setDisplayName(fullName.trim());
      setSavedRole(parentRole || null);
      setEditing(false);
      return;
    }
    setSaving(true);
    const result = await updateParentProfileAction({
      fullName,
      parentRole: parentRole || undefined,
      phone,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender || undefined,
      ...(showBusinessRole ? { businessRole: businessRole || undefined } : {}),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDisplayName(fullName.trim());
    setSavedRole(parentRole || null);
    setEditing(false);
  }

  return (
    <>
      <div className="mb-[18px] flex items-center gap-3.5">
        <AvatarUploadButton
          folder="avatars"
          currentUrl={avatarUrl}
          onUploaded={handleAvatarUploaded}
          size={62}
          fallback={
            <div
              className="flex h-full w-full items-center justify-center text-xl font-bold text-white"
              style={{ background: "linear-gradient(135deg,#4DAFEF,#3ECFB2)" }}
            >
              {initials}
            </div>
          }
        />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold text-ink">{displayName}</div>
          <div className="mt-0.5 text-xs text-ink-2">
            {email}
            {savedRole && ` · ${roleLabels[savedRole]}`}
          </div>
        </div>
        <button
          onClick={() => setEditing((e) => !e)}
          className="ml-auto flex-shrink-0 rounded-sm border border-[#E8EBF0] bg-white px-3 py-1.5 text-xs font-medium text-ink"
        >
          {editing ? "Chiudi" : "Modifica"}
        </button>
      </div>

      {editing && (
        <div className="mb-4 rounded-lg bg-white p-3.5">
          <label className="mb-1.5 block text-xs font-semibold text-ink-2">Nome e cognome</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={`mb-3 w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none ${accentBorder}`}
          />

          {showRoleSelector && (
            <>
              <label className="mb-1.5 block text-xs font-semibold text-ink-2">Sei</label>
              <div className="mb-3 flex gap-2">
                {(Object.keys(roleLabels) as ParentRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setParentRole(r)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      parentRole === r ? accentActive : "border-[#E8EBF0] bg-bg text-ink-2"
                    }`}
                  >
                    {roleLabels[r]}
                  </button>
                ))}
              </div>
            </>
          )}

          <label htmlFor="profile-phone" className="mb-1.5 block text-xs font-semibold text-ink-2">
            Telefono
          </label>
          <input
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Es. 333 1234567"
            className={`mb-3 w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none ${accentBorder}`}
          />

          {showPersonalDetails && (
            <>
              <label htmlFor="profile-dob" className="mb-1.5 block text-xs font-semibold text-ink-2">
                Data di nascita
              </label>
              <input
                id="profile-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={`mb-3 w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none ${accentBorder}`}
              />

              <label className="mb-1.5 block text-xs font-semibold text-ink-2">Genere</label>
              <div className="mb-3 flex gap-2">
                {(Object.keys(genderLabels) as Gender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      gender === g ? accentActive : "border-[#E8EBF0] bg-bg text-ink-2"
                    }`}
                  >
                    {genderLabels[g]}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Solo lato gestore: ruolo in azienda al posto di genere/data di
              nascita, più utile per un profilo di lavoro. */}
          {showBusinessRole && (
            <>
              <label className="mb-1.5 block text-xs font-semibold text-ink-2">Ruolo in azienda</label>
              <div className="mb-3 flex flex-wrap gap-2">
                {(Object.keys(businessRoleLabels) as BusinessRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setBusinessRole(r)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      businessRole === r ? accentActive : "border-[#E8EBF0] bg-bg text-ink-2"
                    }`}
                  >
                    {businessRoleLabels[r]}
                  </button>
                ))}
              </div>
            </>
          )}

          {error && <p className="mb-2 text-xs font-medium text-orange">{error}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`rounded-md ${accentBg} px-4 py-2 text-xs font-bold text-white disabled:opacity-60`}
          >
            {saving ? "Salvo…" : "Salva"}
          </button>
        </div>
      )}
    </>
  );
}
