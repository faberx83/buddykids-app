"use client";

import { useState } from "react";
import type { DeployEvent } from "@/lib/data/deploy-events";

// Banner "ultimo deploy" per l'app Admin — richiesta di Fabrizio: sapere
// dentro l'app se l'ultimo "bash deploy.sh" è andato a buon fine o no,
// senza controllare il terminale. Vedi supabase/migration_33_deploy_events.sql
// e app/internal/deploy-notify/route.ts per il resto della feature.
//
// Dismissibile: una volta chiuso (o già visto), l'id dell'evento va in
// localStorage — riaprendo l'Admin lo stesso evento non ricompare, un
// deploy NUOVO invece sì (id diverso). localStorage qui è legittimo (non è
// l'artifact-preview del sandbox Cowork): questa è l'app Next.js reale di
// Fabrizio, in esecuzione nel suo browser.
const DISMISS_KEY = "trama-admin-last-seen-deploy-event";

function relativeTimeIt(iso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "adesso";
  if (diffMin < 60) return `${diffMin} minut${diffMin === 1 ? "o" : "i"} fa`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} or${diffH === 1 ? "a" : "e"} fa`;
  const diffD = Math.round(diffH / 24);
  return `${diffD} giorn${diffD === 1 ? "o" : "i"} fa`;
}

// Lazy initializer (stesso pattern di components/HomeFeed.tsx,
// readStoredView) invece di un useEffect con setState: sul server
// `event` è già noto in fase di render (passato da app/admin/layout.tsx),
// quindi possiamo calcolare "dismissed" una sola volta, alla creazione
// dello state, leggendo localStorage — niente giro aggiuntivo via effect,
// niente flash del banner al mount.
function readDismissed(event: DeployEvent | null): boolean {
  if (!event || typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === event.id;
  } catch {
    return false; // localStorage non disponibile (rarissimo): mostra comunque il banner
  }
}

export default function DeployStatusBanner({ event }: { event: DeployEvent | null }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(event));

  if (!event || dismissed) return null;

  const isOk = event.status === "ok";

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, event!.id);
    } catch {
      // localStorage non disponibile: il banner riapparirà al prossimo
      // caricamento, non bloccante.
    }
  }

  return (
    <div
      className={`mb-4 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${
        isOk ? "border-[#B9E8CC] bg-[#EAFAF1] text-[#1a6b3f]" : "border-[#F3C1BE] bg-[#FDEEED] text-[#9a2c26]"
      }`}
    >
      <i className={`ti ${isOk ? "ti-circle-check" : "ti-alert-circle"} mt-0.5 flex-shrink-0 text-base`} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">
          {isOk ? "Ultimo deploy riuscito" : "Ultimo deploy fallito"}
          <span className="ml-2 font-normal opacity-75">{relativeTimeIt(event.createdAt)}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs opacity-90">
          {event.branch && <span>branch: {event.branch}</span>}
          {event.commitSha && <span>commit: {event.commitSha}</span>}
          {event.testScope && <span>test: {event.testScope}</span>}
          {event.testResult && <span>{event.testResult}</span>}
        </div>
        {event.message && <div className="mt-1 text-xs opacity-90">{event.message}</div>}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Chiudi"
        className="flex-shrink-0 opacity-60 hover:opacity-100"
      >
        <i className="ti ti-x text-sm" />
      </button>
    </div>
  );
}
