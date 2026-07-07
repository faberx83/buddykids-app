"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDemoRole } from "./DemoRoleProvider";
import { Role } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const roles: { id: Role; label: string; emoji: string; href: string }[] = [
  { id: "parent", label: "Genitore", emoji: "👨‍👩‍👧", href: "/" },
  { id: "center_admin", label: "Gestore centro", emoji: "🏫", href: "/center" },
  { id: "platform_admin", label: "Admin piattaforma", emoji: "🛠️", href: "/admin" },
];

// Selettore di ruolo per la demo — permette di navigare tra vista genitore,
// vista gestore centro e vista admin piattaforma senza un vero login con ruoli.
// Sparisce del tutto quando Supabase è collegato: con account reali il ruolo
// arriva da profiles.role e questo switcher non avrebbe più alcun effetto
// (lasciarlo visibile sarebbe solo fuorviante).
export default function RoleSwitcher() {
  const { role, setRole } = useDemoRole();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const current = roles.find((r) => r.id === role) ?? roles[0];

  if (isSupabaseConfigured) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 w-56 overflow-hidden rounded-lg border border-[#E8EBF0] bg-white shadow-xl">
          <div className="border-b border-[#F0F2F5] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            Ruolo demo
          </div>
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setRole(r.id);
                setOpen(false);
                router.push(r.href);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-sky-light ${
                r.id === role ? "font-semibold text-sky" : "text-ink"
              }`}
            >
              <span>{r.emoji}</span>
              {r.label}
              {r.id === role && <i className="ti ti-check ml-auto text-sm" />}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition-transform hover:scale-105"
      >
        <span>{current.emoji}</span>
        {current.label}
        <i className={`ti ${open ? "ti-chevron-down" : "ti-chevron-up"} text-sm`} />
      </button>
    </div>
  );
}
