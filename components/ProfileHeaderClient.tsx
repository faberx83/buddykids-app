"use client";

import { useState } from "react";
import { ParentRole } from "@/lib/data/profile";
import { updateParentProfileAction, updateParentAvatarAction } from "@/app/actions/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import AvatarUploadButton from "@/components/AvatarUploadButton";

const roleLabels: Record<ParentRole, string> = {
  padre: "Padre",
  madre: "Madre",
  tutore: "Tutore/tutrice",
};

export default function ProfileHeaderClient({
  initialFullName,
  initialParentRole,
  initialAvatarUrl,
  email,
  autoOpenEdit,
}: {
  initialFullName: string;
  initialParentRole: ParentRole | null;
  initialAvatarUrl?: string | null;
  email: string;
  autoOpenEdit?: boolean;
}) {
  const [editing, setEditing] = useState(Boolean(autoOpenEdit));
  const [fullName, setFullName] = useState(initialFullName);
  const [parentRole, setParentRole] = useState<ParentRole | "">(initialParentRole ?? "");
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
    if (!fullName.trim() || !parentRole) {
      setError("Inserisci nome e cognome e scegli un ruolo");
      return;
    }
    if (!isSupabaseConfigured) {
      setDisplayName(fullName.trim());
      setSavedRole(parentRole);
      setEditing(false);
      return;
    }
    setSaving(true);
    const result = await updateParentProfileAction({ fullName, parentRole });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDisplayName(fullName.trim());
    setSavedRole(parentRole);
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
            className="mb-3 w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
          />
          <label className="mb-1.5 block text-xs font-semibold text-ink-2">Sei</label>
          <div className="mb-3 flex gap-2">
            {(Object.keys(roleLabels) as ParentRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setParentRole(r)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  parentRole === r ? "border-sky bg-sky text-white" : "border-[#E8EBF0] bg-bg text-ink-2"
                }`}
              >
                {roleLabels[r]}
              </button>
            ))}
          </div>
          {error && <p className="mb-2 text-xs font-medium text-orange">{error}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-sky px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {saving ? "Salvo…" : "Salva"}
          </button>
        </div>
      )}
    </>
  );
}
