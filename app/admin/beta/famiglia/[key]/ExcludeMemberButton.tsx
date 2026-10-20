"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setCockpitUserExcludedAction } from "@/app/actions/beta-cockpit";

/** Esclude o riammette un account dai conteggi del cockpit (impostazioni, migration 46). */
export default function ExcludeMemberButton({ userId, excluded, disabled }: { userId: string; excluded: boolean; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={busy || disabled}
        title={disabled ? "Serve la migration 46" : undefined}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await setCockpitUserExcludedAction(userId, !excluded);
          setBusy(false);
          if (r.error) setError(r.error);
          else router.push("/admin/beta?tab=famiglie");
        }}
        className="rounded border border-[#E8EBF0] px-2 py-0.5 text-xs font-semibold text-ink disabled:opacity-40"
      >
        {excluded ? "Riammetti" : "Escludi dai conteggi"}
      </button>
      {error && <span className="text-xs text-[#C0392B]">{error}</span>}
    </>
  );
}
