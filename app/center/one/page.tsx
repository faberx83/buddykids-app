import Link from "next/link";

// TRAMA ONE — Partner. Sprint 0: shell/foundation. Sprint 1: prima
// funzionalità di business reale (onboarding), collegata da qui. Sprint 2:
// aggiunto il percorso Walkthrough "activity_creation_partner" (registry.ts).
//
// CONTROLLED BETA EXPERIENCE GATE (§4-6, restyle prima del wiring/DEC-58) —
// rimosso l'`<h1>` di sistema, il `style={{padding:24}}` inline e il colore
// hardcoded `#2E86DE` per il link. Nessun wrapper `<main>` aggiuntivo:
// `DashboardLayout` (app/center/layout.tsx) applica già `p-5 md:p-8`
// responsive al suo `<main>`. Questa route resta `INTERNAL_ONLY` (§6.2 del
// Route Release Matrix): nessuna voce di menu viene aggiunta qui.
//
// CONTROLLED BETA EXPERIENCE GATE (§7-14, DEC-58) — la `WalkthroughCard`
// prima mostrata qui è stata RIMOSSA (non spostata altrove come componente):
// il vero Spotlight (`components/spotlight/PartnerSpotlight.tsx`) è ora
// montato una sola volta in `app/center/layout.tsx` e persiste su ogni
// pagina Partner, evidenziando l'elemento REALE di ciascuno step nella
// pagina dove quel passo va davvero compiuto (`/center/activities`, la
// scheda attività, il calendario Giorni spot) — non più una card testuale
// isolata su questa route orfana, mai vista da un Partner reale prima
// d'ora. Nessuna duplicazione: lo stesso `tutorial_key` non ha più due
// presentazioni contemporanee.
export default function OneCenterPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-ink">TRAMA ONE — Partner</h1>
      <p className="mt-1 text-sm text-ink-2">
        <Link href="/center/one/onboarding" className="font-semibold text-trama-violet hover:underline">
          Vai all&apos;onboarding del centro →
        </Link>
      </p>
    </div>
  );
}
