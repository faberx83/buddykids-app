// Segnalazione di Fabrizio (FINAL MICRO-PILOT LIVE ACCEPTANCE, 01/09/2026):
// un account senza il ruolo giusto per partner./admin. veniva rimbalzato in
// silenzio sulla Home famiglie, senza nessun "accesso negato" — sembrava un
// redirect casuale. Il blocco vero avviene già in proxy.ts, PRIMA che
// qualunque dato di /center o /admin venga caricato (nessuna falla, solo
// mancanza di un messaggio) — questo banner aggiunge solo il messaggio,
// letto da ?denied=wrong_role in query string (vedi proxy.ts#mainDomainUrl).
export default function AccessDeniedBanner({ denied }: { denied?: string }) {
  if (denied !== "wrong_role") return null;

  return (
    <div className="mx-5 mt-3 rounded-lg border border-[#F3D9A6] bg-[#FFF6E5] px-3.5 py-2.5 text-xs text-[#8A6116]">
      <span className="font-semibold">Accesso non consentito. </span>
      Il tuo account non ha i permessi per quella sezione — sei stato riportato qui.
    </div>
  );
}
