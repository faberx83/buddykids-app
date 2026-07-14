import Link from "next/link";

// Barra superiore persistente NEXTGEN — segnalazione di Fabrizio ("manca il
// logo in alto a sinistra"): nessuna pagina NEXTGEN mostrava mai il marchio
// (Home aveva solo "Ciao [nome]"; Planner/Ricerca/Famiglia/Indirizzi solo un
// header back+titolo via components/PageHeader.tsx; Community nemmeno
// quello) — a differenza di Gestore/Admin, che hanno il marchio nella
// sidebar (vedi components/dashboard/DashboardLayout.tsx#BrandMark).
//
// Componente SIBLING di NextgenBottomNav, mountato una sola volta in
// app/nextgen/layout.tsx: un unico punto copre OGNI pagina NEXTGEN presente
// e futura, senza doverlo aggiungere schermata per schermata (e senza
// toccare components/PageHeader.tsx, condiviso anche con LEGACY — nessun
// rischio di regressione lì). Tocco sul marchio -> torna alla Home NEXTGEN,
// pattern comune.
export default function NextgenTopBar() {
  return (
    <Link
      href="/nextgen"
      aria-label="TRAMA — torna alla Home"
      className="flex flex-shrink-0 items-center border-b border-[#E8EBF0] bg-white px-5 py-2.5"
      style={{ paddingTop: "calc(0.625rem + env(safe-area-inset-top))" }}
    >
      <img src="/brand/trama-logo-mark-navy.png" alt="TRAMA" className="h-6 w-auto" />
    </Link>
  );
}
