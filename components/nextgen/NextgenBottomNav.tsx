"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationItem, applyClientCursor } from "@/lib/notifications/model";
import { readLastSeenAt } from "@/lib/notifications/seen-cursor";

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
function useNavBadges(notifications: NotificationItem[]) {
  // Stesso cursore client-side della campanella (localStorage) — stesso
  // pattern SSR-safe one-shot-al-mount già stabilito lì, vedi
  // lib/notifications/seen-cursor.ts per il motivo dell'estrazione.
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  useEffect(() => {
    const stored = readLastSeenAt();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot al mount per leggere un valore che esiste SOLO lato client (localStorage), stesso pattern SSR-safe già in uso in NotificationCenter.tsx/BetaFeedbackButton.tsx/InstallPrompt.tsx.
    if (stored !== null) setLastSeenAt(stored);
  }, []);

  const items = applyClientCursor(notifications, lastSeenAt);
  const hasUnseenBookingResponse = items.some((i) => i.type === "booking_response" && !i.isSeen);
  const hasUnseenOther = items.some((i) => i.type !== "booking_response" && !i.isSeen);
  return { hasUnseenBookingResponse, hasUnseenOther };
}

export default function NextgenBottomNav({ notifications = [] }: { notifications?: NotificationItem[] }) {
  const pathname = usePathname();
  const { hasUnseenBookingResponse, hasUnseenOther } = useNavBadges(notifications);

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
