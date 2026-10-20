"use client";

// TRAMA — ritorno alla Home dopo una pausa (20/10/2026). Regola e motivi in
// lib/nextgen/return-home.ts. Montato una volta in app/nextgen/layout.tsx,
// solo con la release "home-dopo-pausa" accesa. Solo app installata
// (display-mode standalone): nel browser una scheda riaperta resta dov'era.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FROM_NOTIFICATION_PARAM,
  FROM_NOTIFICATION_VALUE,
  HOME_PATH,
  RETURN_HOME_STORAGE_KEY,
  parseLastSeen,
  shouldReturnHome,
} from "@/lib/nextgen/return-home";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function ReturnHomeAfterIdle() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || !isStandalone()) return;
    const here = () => `${window.location.pathname}${window.location.search}`;
    const read = () => {
      try {
        return parseLastSeen(window.localStorage.getItem(RETURN_HOME_STORAGE_KEY));
      } catch {
        return null;
      }
    };
    const save = () => {
      try {
        window.localStorage.setItem(RETURN_HOME_STORAGE_KEY, JSON.stringify({ at: Date.now(), path: here() }));
      } catch {
        // spazio pieno o modalità privata: nessun ritorno automatico, nessun errore
      }
    };

    // Aperta da una notifica (public/sw.js aggiunge ?da=notifica o manda un messaggio): si rispetta.
    let fromNotification = false;
    let notificationTimer: ReturnType<typeof setTimeout> | null = null;
    const params = new URLSearchParams(window.location.search);
    if (params.get(FROM_NOTIFICATION_PARAM) === FROM_NOTIFICATION_VALUE) {
      fromNotification = true;
      params.delete(FROM_NOTIFICATION_PARAM);
      const qs = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
    const onSwMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type !== "trama-opened-from-notification") return;
      fromNotification = true;
      if (notificationTimer) clearTimeout(notificationTimer);
      notificationTimer = setTimeout(() => {
        fromNotification = false;
      }, 5000);
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    const check = () => {
      if (shouldReturnHome({ now: Date.now(), last: read(), currentPath: here(), fromNotification })) {
        router.replace(HOME_PATH);
      }
      save();
    };

    check(); // riapertura dell'app (iOS riapre l'ultima pagina)
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        save();
        return;
      }
      // Un attimo di attesa: se una notifica sta portando altrove, l'indirizzo cambia prima.
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(check, 300);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", save);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      if (resumeTimer) clearTimeout(resumeTimer);
      if (notificationTimer) clearTimeout(notificationTimer);
    };
  }, [router]);

  return null;
}
