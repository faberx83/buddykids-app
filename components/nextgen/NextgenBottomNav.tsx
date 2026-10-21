"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationItem, applyClientCursor } from "@/lib/notifications/model";
import { readLastSeenAt } from "@/lib/notifications/seen-cursor";
import AddSheet from "@/components/nextgen/AddSheet";

// SPRINT 3 (NEXTGEN) — "trasformare il Planner nella feature principale del
// prodotto... il cuore dell'esperienza" (richiesta di Fabrizio): finché
// NEXTGEN aveva solo Dashboard e Ricerca bastava un link testuale ("Scopri
// attività"). Ora che il Planner è una destinazione di primo livello, serve
// una navigazione persistente per renderlo raggiungibile in un tocco da
// ovunque — non il BottomNav di LEGACY (components/BottomNav.tsx, 5 voci,
// rotte "/"), che non esiste sotto /nextgen: componente NUOVO e separato,
// stessa idea (Link + isActive su prefisso), rotte proprie.
// SPRINT 4 — 4ª voce "Community" (Esperienze condivise): stessa idea di
// navigazione, nessuna modifica alle 3 voci esistenti.
// REBRAND TRAMA Sprint 1 — il mockup ("TRAMA - Dev Handoff.dc.html", sezione
// 11.4a) mostra una bottom nav a 5 voci: Home/Planner/Scopri/Prenotazioni/
// Profilo. "Community" esce da qui (non sparisce: dallo sprint 5.6 è già
// raggiungibile da Planner → scheda "Gruppi", vedi PlannerGroupsView.tsx),
// lasciando spazio a "Prenotazioni" e "Profilo". Al momento del rebrand
// entrambe puntavano alle pagine LEGACY esistenti (/prenotazioni, /profile):
// tradeoff accettato con Fabrizio finché non avessero una schermata NEXTGEN
// dedicata. "Cerca" rinominata "Scopri" per coerenza col mockup, stessa rotta.
//
// SPRINT 6 (NEXTGEN, ultimo dei 6 sprint "punch list" di Fabrizio) — "Profilo"
// ora punta a /nextgen/profile (nuova pagina ridisegnata, vedi
// app/nextgen/profile/ProfileNextgenClient.tsx): il tradeoff sopra resta
// valido SOLO per "Prenotazioni" (/prenotazioni, ancora LEGACY).
// TRAMA ONE Prenotazioni NEXTGEN-native (24/08/2026) — chiuso anche l'ultimo
// tradeoff: "Prenotazioni" ora punta a /nextgen/prenotazioni (guscio NEXTGEN,
// vedi app/nextgen/prenotazioni/page.tsx), stesso contenuto TRAMA-current.
// TRAMA ONE Parent Spotlight sprint (24/08/2026) — "planner_nav" è il target
// reale dell'ultimo step del percorso Genitore (discover_book_parent, vedi
// lib/walkthrough/registry.ts), stesso pattern di "dashboard" sulla voce
// omonima della sidebar Partner (components/dashboard/DashboardLayout.tsx).
// Campo opzionale: solo la voce "Planner" lo imposta, le altre 4 restano
// invariate (nessun data-spotlight = nessun attributo renderizzato).
const items: { href: string; icon: string; label: string; spotlightTarget?: string }[] = [
  { href: "/nextgen", icon: "ti-home", label: "Home" },
  { href: "/nextgen/planner", icon: "ti-calendar-event", label: "Planner", spotlightTarget: "planner_nav" },
  { href: "/nextgen/search", icon: "ti-search", label: "Scopri" },
  { href: "/nextgen/prenotazioni", icon: "ti-ticket", label: "Prenotazioni" },
  { href: "/nextgen/profile", icon: "ti-user-circle", label: "Profilo" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/nextgen") return pathname === "/nextgen";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Richiesta di Fabrizio (31/08/2026): un pallino di notifica anche sulla
// bottom nav, "contestualizzato" — non un conteggio generico ripetuto in due
// posti, ma ognuno dei due tab mostra SOLO ciò che gli appartiene:
// "Prenotazioni" = risposte del centro a una PRENOTAZIONE (conferma/rifiuto/
// proposta alternativa); "Profilo" = tutto il resto di non visto (invito
// gruppo, risposta a una RICHIESTA/domanda, gruppo accettato, match
// carpool) — un "catch-all" per ciò che non ha già un tab dedicato, cosi
// niente risulta segnalato in due punti contemporaneamente. Stessa lista
// `notifications` già calcolata una volta sola in app/nextgen/layout.tsx per
// la campanella (NotificationCenter.tsx): zero nuove query.
function useNavBadges(notifications: NotificationItem[], uxFix = false) {
  // Stesso cursore client-side della campanella (localStorage) — stesso
  // pattern SSR-safe one-shot-al-mount già stabilito lì, vedi
  // lib/notifications/seen-cursor.ts per il motivo dell'estrazione.
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  useEffect(() => {
    // Questa bottom nav esiste SOLO lato Genitore (il Partner usa la sidebar
    // di DashboardLayout) — scope "parent" fisso, nessuna variante qui.
    const stored = readLastSeenAt("parent");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot al mount per leggere un valore che esiste SOLO lato client (localStorage), stesso pattern SSR-safe già in uso in NotificationCenter.tsx/BetaFeedbackButton.tsx/InstallPrompt.tsx.
    if (stored !== null) setLastSeenAt(stored);
  }, []);

  const items = applyClientCursor(notifications, lastSeenAt);
  const hasUnseenBookingResponse = items.some((i) => i.type === "booking_response" && !i.isSeen);
  // Correzioni dal test UX (21/10/2026): le Novità di TRAMA non accendono pallini.
  const hasUnseenOther = items.some((i) => i.type !== "booking_response" && !(uxFix && i.type === "trama_announcement") && !i.isSeen);
  return { hasUnseenBookingResponse, hasUnseenOther };
}

// TRAMA — NUOVA BARRA (14/10/2026, NAV_V2_ENABLED): Home, Planner, + al
// centro (AddSheet), Scopri, Prenotazioni. Il Profilo esce dalla barra e si
// apre dall'avatar nell'intestazione della Home V2. variant="classic"
// (default) = barra attuale, invariata.
const V2_LEFT = items.slice(0, 2);
const V2_RIGHT = items.slice(2, 4);

export default function NextgenBottomNav({
  notifications = [],
  variant = "classic",
  addItemEnabled = false,
  radarEnabled = false,
  uxFix = false,
}: {
  notifications?: NotificationItem[];
  variant?: "classic" | "v2";
  addItemEnabled?: boolean;
  /** RADAR (14/10/2026): "Una scoperta" nel foglio del +. */
  radarEnabled?: boolean;
  /** Correzioni dal test UX (21/10/2026, PARENT_UX_FIX_ENABLED): nel + co-genitore e altra famiglia separati. */
  uxFix?: boolean;
}) {
  const pathname = usePathname();
  const { hasUnseenBookingResponse, hasUnseenOther } = useNavBadges(notifications, uxFix);
  const [addOpen, setAddOpen] = useState(false);

  if (variant === "v2") {
    const renderItem = (item: (typeof items)[number]) => {
      const active = isActive(pathname, item.href);
      const showDot = item.href === "/nextgen/prenotazioni" && hasUnseenBookingResponse;
      return (
        <Link
          key={item.href}
          href={item.href}
          data-spotlight={item.spotlightTarget}
          aria-label={showDot ? `${item.label}, nuove notifiche` : undefined}
          className="flex flex-1 flex-col items-center gap-[3px] active:scale-90"
        >
          <span className="relative">
            {/* POLISH V2 (14/10/2026): attivo = navy primario + trattino sopra (non solo colore). */}
            {active && <span aria-hidden="true" className="absolute -top-2 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-trama-primary" />}
            <i className={`ti ${item.icon} text-[22px] transition-colors ${active ? "text-trama-primary" : "text-ink-3"}`} />
            {showDot && (
              <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-trama-orange ring-2 ring-white" />
            )}
          </span>
          <span className={`font-poppins text-[10px] transition-colors ${active ? "font-semibold text-trama-primary" : "font-medium text-ink-3"}`}>
            {item.label}
          </span>
        </Link>
      );
    };
    return (
      <>
        <div
          className={`relative flex flex-shrink-0 items-end border-t border-[#E8EBF0] bg-white pt-2 ${addOpen ? "z-50" : ""}`}
          style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        >
          {V2_LEFT.map(renderItem)}
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            aria-expanded={addOpen}
            aria-haspopup="dialog"
            aria-label={addOpen ? "Chiudi" : "Aggiungi"}
            className="-mt-7 flex flex-1 flex-col items-center gap-1 active:scale-95"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_6px_16px_rgba(23,42,77,0.28),0_0_0_5px_#FFFFFF] transition-colors ${
                addOpen ? "bg-trama-primary-press" : "bg-trama-primary"
              }`}
            >
              <i className={`ti ${addOpen ? "ti-x" : "ti-plus"} text-[26px]`} aria-hidden="true" />
            </span>
            <span className="font-poppins text-[10px] font-semibold text-trama-primary">
              {addOpen ? "Chiudi" : "Aggiungi"}
            </span>
          </button>
          {V2_RIGHT.map(renderItem)}
        </div>
        <AddSheet open={addOpen} onClose={() => setAddOpen(false)} addItemEnabled={addItemEnabled} radarEnabled={radarEnabled} uxFix={uxFix} />
      </>
    );
  }

  return (
    <div
      className="flex flex-shrink-0 border-t border-[#E8EBF0] bg-white pt-2"
      style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        // Contestualizzato per tab, non un conteggio generico duplicato:
        // vedi commento su useNavBadges sopra.
        const showDot =
          (item.href === "/nextgen/prenotazioni" && hasUnseenBookingResponse) ||
          (item.href === "/nextgen/profile" && hasUnseenOther);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-spotlight={item.spotlightTarget}
            aria-label={showDot ? `${item.label}, nuove notifiche` : undefined}
            className="flex flex-1 flex-col items-center gap-[3px] active:scale-90"
          >
            <span className="relative">
              <i
                className={`ti ${item.icon} text-[22px] transition-colors ${
                  active ? "text-trama-violet" : "text-ink-3"
                }`}
              />
              {showDot && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-trama-orange ring-2 ring-white"
                />
              )}
            </span>
            <span
              className={`font-poppins text-[10px] font-medium transition-colors ${
                active ? "text-trama-violet" : "text-ink-3"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
