// TRAMA — "APRI NELL'APP / INSTALLA" (22/10/2026, ritest di Fabrizio: "se
// clicco i link dalle mail si apre sempre web: possiamo forzare l'apertura
// dell'app o proporre l'installazione sempre?"). Logica pura del banner di
// components/InstallPrompt.tsx con PARENT_UX_FIX_ENABLED; testata in
// tests/one/parent-ux-fix.spec.ts.
//
// Un sito non può aprire da solo un'app installata: se TRAMA è già sul
// telefono (Android lo sa dire, navigator.getInstalledRelatedApps) diciamo di
// aprirla dall'icona; se non c'è, la proponiamo. Chi chiude il banner lo
// rivede dopo REPROPOSE_DAYS giorni, non mai più.

export const INSTALL_REPROPOSE_DAYS = 7;

export type InstallBanner = "none" | "open_app" | "install" | "ios";

/** Valore salvato quando si chiude il banner: un istante (ms). Il vecchio "1" (chiuso per sempre) vale come molto tempo fa. */
export function parseDismissedAt(raw: string | null): number | null {
  if (raw === null) return null;
  if (raw === "1") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function installBannerFor(input: {
  standalone: boolean;
  ios: boolean;
  /** Android: TRAMA risulta già installata su questo telefono. */
  installed: boolean;
  /** Il browser offre l'installazione (beforeinstallprompt arrivato). */
  canPrompt: boolean;
  dismissedAt: number | null;
  now: number;
}): InstallBanner {
  if (input.standalone) return "none";
  if (input.dismissedAt !== null && input.now - input.dismissedAt < INSTALL_REPROPOSE_DAYS * 86_400_000) return "none";
  if (input.installed) return "open_app";
  if (input.ios) return "ios";
  if (input.canPrompt) return "install";
  return "none";
}
