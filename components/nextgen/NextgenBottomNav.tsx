"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
// lasciando spazio a "Prenotazioni" e "Profilo". Queste ultime due puntano
// alle pagine LEGACY esistenti (/prenotazioni, /profile — non ancora
// duplicate sotto /nextgen): decisione presa con Fabrizio, tradeoff
// accettato per ora è che uscendo da queste due voci si vede la bottom nav
// LEGACY finché non avranno una schermata NEXTGEN dedicata in uno sprint
// futuro. "Cerca" rinominata "Scopri" per coerenza col mockup, stessa rotta.
const items = [
  { href: "/nextgen", icon: "ti-home", label: "Home" },
  { href: "/nextgen/planner", icon: "ti-calendar-event", label: "Planner" },
  { href: "/nextgen/search", icon: "ti-search", label: "Scopri" },
  { href: "/prenotazioni", icon: "ti-ticket", label: "Prenotazioni" },
  { href: "/profile", icon: "ti-user-circle", label: "Profilo" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/nextgen") return pathname === "/nextgen";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NextgenBottomNav() {
  const pathname = usePathname();

  return (
    <div
      className="flex flex-shrink-0 border-t border-[#E8EBF0] bg-white pt-2"
      style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} className="flex flex-1 flex-col items-center gap-[3px]">
            <i
              className={`ti ${item.icon} text-[22px] transition-colors ${
                active ? "text-trama-violet" : "text-ink-3"
              }`}
            />
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
