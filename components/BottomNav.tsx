"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", icon: "ti-home", label: "Home" },
  { href: "/search", icon: "ti-search", label: "Cerca" },
  { href: "/groups", icon: "ti-users", label: "Gruppi" },
  { href: "/calendar", icon: "ti-calendar", label: "Calendario" },
  { href: "/profile", icon: "ti-user", label: "Profilo" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-shrink-0 border-t border-[#F0F2F5] bg-white pb-5 pt-2">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-1 flex-col items-center gap-[3px]"
          >
            <i
              className={`ti ${item.icon} text-[22px] transition-colors ${
                active ? "text-sky" : "text-ink-3"
              }`}
            />
            <span
              className={`text-[10px] font-medium transition-colors ${
                active ? "text-sky" : "text-ink-3"
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
