"use client";

// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), NOVITÀ TRAMA — LEVEL 2
// "CONTEXTUAL NEW" (§10 del task).
//
// Callout discreto, MAI un tutorial: "✨ Nuovo — ... [ Ho capito ]", mostrato
// alla prima visita della superficie interessata (il chiamante server-side,
// vedi app/nextgen/search/page.tsx, passa `announcement` SOLO quando
// !isDismissed per QUESTO utente/versione — nessuna logica di "prima
// visita" qui, è già implicita in "non ancora dismesso"). Una volta
// dismesso: mai più per la stessa announcementVersion (§15) — persistito in
// public.announcement_receipts.dismissed_at via dismissAnnouncementCalloutAction,
// MAI localStorage (vietato esplicitamente dalla governance di questo lavoro).

import { useState } from "react";
import Link from "next/link";
import { dismissAnnouncementCalloutAction } from "@/app/actions/announcements";

export default function AnnouncementCallout({
  announcementId,
  title,
  body,
  deepLink,
  className = "mx-5",
}: {
  announcementId: string;
  title: string;
  body: string;
  deepLink: string;
  /** Il chiamante può azzerare il margine orizzontale (default mx-5) quando è già dentro un contenitore con padding — vedi SearchDiscoveryClient.tsx. */
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  if (dismissed) return null;

  async function handleDismiss() {
    setDismissing(true);
    setDismissed(true); // ottimistico: il callout non deve mai sembrare "bloccato" per un utente che ha già cliccato
    await dismissAnnouncementCalloutAction(announcementId);
    setDismissing(false);
  }

  return (
    <div className={`${className} mb-3 flex items-start gap-2.5 rounded-lg border border-[#F3F0FF] bg-[#FAF9FF] p-3`}>
      <span aria-hidden className="text-base leading-none">✨</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-ink-2">{body}</p>
        <div className="mt-2 flex items-center gap-3">
          <Link
            href={deepLink}
            onClick={handleDismiss}
            className="text-[11.5px] font-semibold text-trama-violet underline underline-offset-2"
          >
            Scopri le novità
          </Link>
          <button
            type="button"
            disabled={dismissing}
            onClick={handleDismiss}
            className="text-[11.5px] font-semibold text-ink-3 disabled:opacity-60"
          >
            Ho capito
          </button>
        </div>
      </div>
    </div>
  );
}
