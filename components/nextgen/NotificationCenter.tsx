"use client";

// TRAMA — Wave 3 "Actionable In-App Notifications". Entry point discreto
// (sezione 13 del task): bottone flottante fisso, stesso principio visivo
// già stabilito da BetaFeedbackButton.tsx (position:absolute ancorato a
// .app-shell via offsetParent, cosi resta dentro la cornice "telefono" sia
// su mobile reale che nell'anteprima desktop) — MA senza trascinamento: un
// bell va trovato sempre nello stesso punto, a differenza della CTA
// feedback. Angolo BASSO-SINISTRA (BetaFeedbackButton occupa basso-destra
// di default, NextgenBadge il "Beta" ribbon in alto-destra su Home, PageHeader
// il back-arrow in alto-sinistra): nessuna sovrapposizione nota.
//
// Montato UNA sola volta in app/nextgen/layout.tsx (stesso principio di
// NextgenToastProvider/BetaFeedbackButton) — copre ogni pagina genitore
// NEXTGEN senza doverlo aggiungere pagina per pagina.
//
// SEEN — architettura COMPUTED (nessuna migration): per i tipi con una
// colonna DB reale (inquiry_reply/booking_response, read_by_parent) isSeen
// arriva già corretto dal server e NON viene mai sovrascritto qui. Per i tipi
// senza colonna dedicata (group_request_accepted, carpool_*) — e SOLO per
// quelli — questo componente applica un cursore "ultimo accesso al center"
// salvato in localStorage: un limite noto e documentato (per-dispositivo,
// non sincronizzato fra device), scelto esplicitamente per evitare qualunque
// migration in questa wave (vedi doc implementazione). group_invite_pending
// resta SEMPRE non-visto finché pending (SEEN ≠ RESOLVED: aprire il center
// non equivale ad accettare l'invito).

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  NotificationItem,
  applyClientCursor,
  countUnseen,
  formatRelativeTimeIt,
  sortNotifications,
} from "@/lib/notifications/model";
import { markInquiriesReadAction } from "@/app/actions/inquiries";
import { markBookingsReadAction } from "@/app/actions/booking-response";
// Estratto in un file dedicato (31/08/2026): NextgenBottomNav.tsx ora usa la
// STESSA logica per i pallini "Prenotazioni"/"Profilo" — vedi
// lib/notifications/seen-cursor.ts per il motivo dell'estrazione.
import { readLastSeenAt, writeLastSeenAt } from "@/lib/notifications/seen-cursor";

const BUTTON_SIZE = 52;

const PRIORITY_ICON: Record<NotificationItem["priority"], string> = {
  action: "ti-alert-circle",
  important: "ti-info-circle",
  info: "ti-bell",
};
const PRIORITY_COLOR: Record<NotificationItem["priority"], string> = {
  action: "text-trama-orange",
  important: "text-trama-violet",
  info: "text-ink-3",
};

export default function NotificationCenter({ initialNotifications }: { initialNotifications: NotificationItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const bellRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // null = "non ancora letto da localStorage" (SSR-safe: nessun mismatch
  // idratazione, il primo render lato client corrisponde a quello del server).
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  useEffect(() => {
    // Letta solo lato client (localStorage non esiste server-side, stesso
    // motivo/pattern "one-shot al mount" già in uso in BetaFeedbackButton.tsx
    // e InstallPrompt.tsx) — guardia esplicita invece di un setState
    // incondizionato, cosi il valore "nessun cursore ancora noto" (null)
    // resta quello del render server senza un secondo giro superfluo.
    const stored = readLastSeenAt();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot al mount per leggere un valore che esiste SOLO lato client (localStorage), stesso pattern SSR-safe già in uso in BetaFeedbackButton.tsx/InstallPrompt.tsx: senza questo useEffect il valore andrebbe letto durante il render, non disponibile server-side.
    if (stored !== null) setLastSeenAt(stored);
  }, []);

  const items = sortNotifications(applyClientCursor(initialNotifications, lastSeenAt));
  const unseenCount = countUnseen(items);
  const badgeLabel = unseenCount > 9 ? "9+" : String(unseenCount);

  function openCenter() {
    setOpen(true);
    // Avanza il cursore ad ORA: gli elementi attualmente mostrati (per i
    // tipi senza colonna DB) risulteranno "visti" dal prossimo render — mai
    // indietro (Date.now() è sempre >= al cursore precedente).
    const now = new Date().toISOString();
    writeLastSeenAt(now);
    setLastSeenAt(now);
  }

  function closeCenter() {
    setOpen(false);
    bellRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeCenter();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Stesso perimetro di BetaFeedbackButton.tsx: /nextgen/admin e
  // /nextgen/center condividono ancora questo layout genitore (placeholder),
  // non sono destinazioni reali del genitore — nessun notification center lì.
  if (pathname?.startsWith("/nextgen/admin") || pathname?.startsWith("/nextgen/center")) return null;

  async function handleItemClick(item: NotificationItem) {
    // entityId è deterministico dall'id (`${type}:${entityId}`, vedi
    // makeNotificationId) — split solo sul PRIMO ":" perché alcuni uuid non
    // contengono ":" ma il body/entityId non lo contiene mai per costruzione.
    const entityId = item.id.slice(item.type.length + 1);
    if (item.type === "inquiry_reply") {
      await markInquiriesReadAction({ ids: [entityId], side: "parent", read: true });
    } else if (item.type === "booking_response") {
      await markBookingsReadAction({ ids: [entityId], side: "parent", read: true });
    }
    setOpen(false);
    router.push(item.deepLink);
  }

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        onClick={openCenter}
        aria-label={unseenCount > 0 ? `Notifiche, ${unseenCount} da leggere` : "Notifiche"}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
        className="absolute bottom-24 left-4 z-[70] flex items-center justify-center rounded-full bg-white text-ink shadow-lg active:scale-95"
      >
        <i className="ti ti-bell text-[22px]" aria-hidden="true" />
        {unseenCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-trama-orange px-1 text-[10.5px] font-bold text-white"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Notifiche"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCenter();
          }}
        >
          <div className="flex max-h-[70vh] w-full max-w-sm flex-col rounded-2xl bg-white p-4">
            <div className="mb-1 flex flex-shrink-0 items-center justify-between">
              <div className="text-[15px] font-bold text-ink">Notifiche</div>
              <button
                ref={closeRef}
                type="button"
                onClick={closeCenter}
                aria-label="Chiudi notifiche"
                className="flex h-8 w-8 items-center justify-center text-ink-3 active:scale-95"
              >
                <i className="ti ti-x text-[18px]" aria-hidden="true" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <i className="ti ti-bell-off text-[28px] text-ink-3" aria-hidden="true" />
                <p className="text-[13px] text-ink-2">Nessuna notifica al momento.</p>
              </div>
            ) : (
              <ul className="-mx-1 flex flex-1 flex-col gap-1 overflow-y-auto px-1 py-1">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-3 text-left active:scale-[0.99] ${
                        item.isSeen ? "bg-white" : "bg-bg"
                      }`}
                    >
                      <i
                        className={`ti ${PRIORITY_ICON[item.priority]} mt-0.5 flex-shrink-0 text-[18px] ${PRIORITY_COLOR[item.priority]}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-bold text-ink">{item.title}</span>
                          {!item.isSeen && (
                            <span className="flex-shrink-0 rounded-full bg-trama-orange/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-trama-orange">
                              Nuovo
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px] text-ink-2">{item.body}</p>
                        <p className="mt-1 text-[10.5px] text-ink-3">{formatRelativeTimeIt(item.relevantAt)}</p>
                      </div>
                      <i className="ti ti-chevron-right mt-1 flex-shrink-0 text-[16px] text-ink-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
