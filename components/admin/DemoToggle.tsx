import Link from "next/link";

// TRAMA — ADMIN OPERATIVO, retest del 12/11/2026 (Fabrizio): "Allinea
// contatore, anteprima e coda di destinazione; mantieni le prove
// raggiungibili con un filtro esplicito." Striscia sopra le code che
// nascondono le prove di default: quante sono nascoste e il link per vederle
// (?demo=1), o per nasconderle di nuovo. Stessa regola delle card di "Oggi"
// (lib/admin-ops/demo.ts).
export default function DemoToggle({ hidden, showing, showHref, hideHref }: { hidden: number; showing: boolean; showHref: string; hideHref: string }) {
  if (!showing && hidden === 0) return null;
  return (
    <div className="mb-3 rounded-lg border border-dashed border-navy-3 px-4 py-2 text-xs text-navy-text2" data-testid="demo-toggle">
      {showing ? (
        <>
          Prove visibili.{" "}
          <Link href={hideHref} className="font-semibold text-white underline">
            Nascondile
          </Link>
        </>
      ) : (
        <>
          {hidden} di prova {hidden === 1 ? "nascosta" : "nascoste"} (non contate in Oggi).{" "}
          <Link href={showHref} className="font-semibold text-white underline">
            Mostrale
          </Link>
        </>
      )}
    </div>
  );
}
