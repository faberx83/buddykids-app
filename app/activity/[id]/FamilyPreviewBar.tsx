import Link from "next/link";
import { FAMILY_PREVIEW_RETURN_HREF } from "@/lib/center/family-preview";

// TRAMA PARTNER — LIVE MOBILE BUGFIX (01/10/2026). Barra mostrata in cima
// alla scheda attività SOLO in anteprima Partner (vedi
// lib/center/family-preview.ts e app/activity/[id]/page.tsx). Dice al
// gestore dove si trova e lo riporta a "Il mio centro" con un link reale
// (stessa sessione, stesso ruolo, nessun logout). Nessun hook client: è un
// semplice <Link>, renderizzabile anche dentro DetailClient ("use client").
export default function FamilyPreviewBar() {
  return (
    <div
      role="region"
      aria-label="Anteprima famiglia"
      data-testid="family-preview-bar"
      className="flex flex-shrink-0 items-center gap-3 bg-trama-navy px-4 py-2 text-white"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold leading-tight">
          <i className="ti ti-eye mr-1" aria-hidden="true" />
          Anteprima famiglia
        </div>
        <div className="text-[11px] leading-snug text-white/75">
          Così vedono la tua attività le famiglie. Prenota, Preferiti e Contatta sono disattivati.
        </div>
      </div>
      <Link
        href={FAMILY_PREVIEW_RETURN_HREF}
        data-testid="family-preview-back"
        className="flex min-h-[44px] flex-shrink-0 items-center gap-1 rounded-lg bg-white/15 px-3 text-[12.5px] font-bold text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <i className="ti ti-arrow-left" aria-hidden="true" />
        Torna al tuo centro
      </Link>
    </div>
  );
}
