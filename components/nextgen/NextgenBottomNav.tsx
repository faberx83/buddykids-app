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
const items = [
  { href: "/nextgen", icon: "ti-home", label: "Home" },
  { href: "/nextgen/planner", icon: "ti-calendar-event", label: "Planner" },
  { href: "/nextgen/community", icon: "ti-users-group", label: "Community" },
  { href: "/nextgen/search", icon: "ti-search", label: "Cerca" },
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
                active ? "text-[#5B4FE9]" : "text-ink-3"
              }`}
            />
            <span
              className={`text-[10px] font-medium transition-colors ${
                active ? "text-[#5B4FE9]" : "text-ink-3"
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
