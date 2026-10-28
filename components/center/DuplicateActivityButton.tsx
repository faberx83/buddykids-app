"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { duplicateActivityAction } from "@/app/actions/center-activities-v2";

// Portale centri V2 (28/10/2026): "Duplica" sulla scheda di un'attività. La
// copia nasce senza date e si apre subito in modifica.
export default function DuplicateActivityButton({ activitySlug, name }: { activitySlug: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function duplicate() {
    setError(null);
    setBusy(true);
    const res = await duplicateActivityAction(activitySlug).catch(() => ({ error: "Non siamo riusciti a duplicare, riprovate." }) as { error: string; activitySlug?: string });
    setBusy(false);
    if (res.error || !res.activitySlug) return setError(res.error ?? "Non siamo riusciti a duplicare, riprovate.");
    router.push(`/center/activities/${res.activitySlug}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={duplicate}
        disabled={busy}
        aria-label={`Duplica ${name}`}
        className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-partner-line bg-white px-3 text-[13px] font-semibold text-partner-primary hover:bg-partner-soft disabled:opacity-60"
      >
        <i className="ti ti-copy text-[16px]" aria-hidden="true" />
        {busy ? "Duplico…" : "Duplica"}
      </button>
      {error && (
        <p role="alert" className="basis-full text-[12.5px] font-medium text-[#B4361F]">
          {error}
        </p>
      )}
    </>
  );
}
