"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinGroupAction } from "@/app/actions/groups";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function JoinGroupClient({
  groupId,
  basePath = "/groups",
  v2 = false,
}: {
  groupId: string;
  /** 22/10/2026: "/nextgen/groups" dall'app nuova (app/nextgen/groups/join/[id]). Default: app vecchia, come prima. */
  basePath?: string;
  v2?: boolean;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setJoining(true);
    setError(null);
    const result = await joinGroupAction(groupId);
    setJoining(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(`${basePath}/${groupId}`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
      {v2 ? (
        <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl bg-trama-primary-soft text-trama-primary">
          <i className="ti ti-users-group text-[30px]" />
        </span>
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-light text-3xl">🤝</div>
      )}
      <div className={v2 ? "font-poppins text-[22px] font-semibold text-ink" : "text-lg font-bold text-ink"}>Sei stato invitato a un gruppo</div>
      <p className="max-w-sm text-sm text-ink-2">
        Unisciti per aggiungere i tuoi bambini, indicare le loro preferenze e organizzare
        l&apos;accompagnamento con le altre famiglie.
      </p>
      {error && <p className="text-xs font-medium text-orange">{error}</p>}
      {!isSupabaseConfigured && (
        <p className="max-w-sm text-xs text-ink-3">
          Supabase non è collegato in questo ambiente: l&apos;adesione reale richiede Supabase.
        </p>
      )}
      <button
        onClick={handleJoin}
        disabled={joining || !isSupabaseConfigured}
        className={
          v2
            ? "min-h-[48px] rounded-[12px] bg-trama-primary px-6 text-[15px] font-semibold text-white active:bg-trama-primary-press disabled:opacity-60"
            : "rounded-md bg-sky px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
        }
      >
        {joining ? "Mi unisco…" : "Unisciti al gruppo"}
      </button>
    </div>
  );
}
