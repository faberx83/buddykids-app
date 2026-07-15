// SPRINT 7 (NEXTGEN, feedback Fabrizio: "gli elementi decorativi della Home
// dovrebbero essere coerenti su tutte le pagine NEXTGEN") — la Home
// (HomeDashboardClient.tsx) ha una "hero card" con due cerchi decorativi
// (bg-trama-violet/10 in alto a destra, bg-trama-lilac/20 in basso a
// destra) dietro il riepilogo stagionale; Planner/Scopri/Community/Profilo
// avevano invece un'intestazione puramente testuale, senza nessuna delle
// texture di brand della Home. Estratto qui lo STESSO markup/classi
// (nessun nuovo colore o forma inventati) come wrapper riusabile, cosi
// l'intro di ogni pagina di primo livello condivide la stessa firma visiva
// della Home invece di sembrare una sezione "diversa" dell'app.
export default function DecorativeIntroCard({
  children,
  className = "",
  padding = "p-4",
}: {
  children: React.ReactNode;
  // Margini esterni (es. "mb-4") — SEMPRE sicuri da combinare con la classe
  // di padding di base, nessun conflitto di specificità.
  className?: string;
  // Padding interno — prop SEPARATA da className apposta: due utility
  // Tailwind "p-*" diverse nella stessa lista di classi (es. "p-4 p-2" da un
  // className passato dal chiamante) danno un risultato indeterministico,
  // perché dipendono dall'ordine con cui Tailwind genera il CSS, non
  // dall'ordine nel markup. Il chiamante che vuole un padding diverso da
  // quello di default passa "padding", mai "p-*" dentro className.
  padding?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] bg-trama-violet/[0.08] ${padding} shadow-[0_8px_24px_rgba(111,99,197,0.12)] ${className}`}
    >
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-trama-violet/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-12 -right-2 h-24 w-24 rounded-full bg-trama-lilac/20" />
      <div className="relative">{children}</div>
    </div>
  );
}
