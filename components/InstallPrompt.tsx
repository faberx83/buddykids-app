"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Banner "Installa l'app" per Android/Chrome/Edge: cattura l'evento
// beforeinstallprompt (impedendo il mini-infobar automatico di Chrome, poco
// visibile) e mostra un invito nostro, coerente con il tema del tenant
// (famiglie/partner/admin). Su iOS Safari questo evento non esiste — lì
// mostriamo invece istruzioni manuali (vedi sotto).
//
// SPRINT 3 (NEXTGEN) — richiesta di Fabrizio: poter installare LEGACY e
// NEXTGEN come DUE app separate sullo stesso telefono, senza che i due
// banner "Installa" si sovrappongano. NEXTGEN ha il proprio manifest
// (scope/start_url/id "/nextgen", vedi public/manifest-nextgen.json) e la
// propria istanza di questo componente (mountata in app/nextgen/layout.tsx
// con appName="BuddyKids NextGen", vedi lì). Questa istanza — quella
// "storica", mountata una volta sola in app/layout.tsx per TUTTE le pagine —
// deve quindi disattivarsi da sola sulle rotte /nextgen, altrimenti sotto
// /nextgen comparirebbero DUE banner "Installa" insieme (questo e quello
// NEXTGEN): niente di nuovo per LEGACY (stesso comportamento su ogni altra
// rotta), solo un self-check di percorso.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function dismissKey(appName: string) {
  return `bk_install_dismissed_${appName}`;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error -- proprietà non standard usata da Safari iOS
    window.navigator.standalone === true
  );
}

export default function InstallPrompt({
  appName,
  themeColor,
  // Prefisso di rotta su cui questa istanza NON deve comparire, perché lì
  // c'è già un'altra istanza di InstallPrompt dedicata (vedi commento sopra).
  // Solo l'istanza "storica" in app/layout.tsx la usa (routeExclude="/nextgen");
  // quella NEXTGEN non la passa, perché è già scoped a /nextgen dal punto in
  // cui è mountata.
  routeExclude,
}: {
  appName: string;
  themeColor: string;
  routeExclude?: string;
}) {
  // Nessuno stato "dismissed" separato: il banner parte nascosto di default
  // (deferredEvent null, showIosHint false) e viene mostrato SOLO se
  // l'effetto qui sotto decide che ci sono le condizioni giuste — quindi il
  // controllo "l'utente l'aveva già chiuso in passato" può uscire subito
  // dall'effetto senza dover "resettare" nessuno stato via setState.
  const pathname = usePathname();
  const excluded = Boolean(routeExclude && pathname?.startsWith(routeExclude));
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (excluded) return; // rotta gestita da un'altra istanza (vedi routeExclude)

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    if (isStandalone()) return; // già installata: niente banner
    if (localStorage.getItem(dismissKey(appName)) === "1") return; // chiuso in passato

    if (isIos()) {
      // Safari iOS non espone beforeinstallprompt: qui l'unica via è mostrare
      // istruzioni manuali, non un prompt nativo. L'informazione (user agent)
      // esiste solo lato client e non è derivabile durante il render — va per
      // forza letta qui, in questo effetto "one-shot" al mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowIosHint(true);
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, [appName, excluded]);

  function dismiss() {
    localStorage.setItem(dismissKey(appName), "1");
    setDeferredEvent(null);
    setShowIosHint(false);
  }

  if (excluded || (!deferredEvent && !showIosHint)) return null;

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 flex items-center gap-3 rounded-lg border border-[#E8EBF0] bg-white p-4 shadow-lg md:inset-x-auto md:bottom-6 md:right-6 md:w-80">
      <span className="text-2xl">📲</span>
      <div className="flex-1">
        <p className="text-sm font-bold text-ink">Installa {appName}</p>
        <p className="text-xs text-ink-2">
          {showIosHint
            ? <>Tocca <i className="ti ti-share-2" /> Condividi, poi &quot;Aggiungi a Home&quot;.</>
            : "Accesso più rapido, come un'app vera."}
        </p>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
        {deferredEvent && (
          <button
            onClick={async () => {
              await deferredEvent.prompt();
              await deferredEvent.userChoice;
              dismiss();
            }}
            style={{ background: themeColor }}
            className="rounded-md px-3 py-1.5 text-xs font-bold text-white"
          >
            Installa
          </button>
        )}
        <button onClick={dismiss} className="text-[11px] text-ink-3">
          Non ora
        </button>
      </div>
    </div>
  );
}
