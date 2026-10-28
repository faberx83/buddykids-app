import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { getMyCenter } from "@/lib/data/center-admin";
import { getActivitiesForCenter } from "@/lib/data/activities";
import { getMyCenterActivation } from "@/lib/data/center-activation";
import { activationView, profileChecks, type ProfileCheckKey } from "@/lib/centers/activation";
import { buildFamilyPreviewHref, pickFamilyPreviewSlug } from "@/lib/center/family-preview";
import { partnerShellEnabledForCurrentUser } from "@/lib/centers/partner-v2-flag";

// TRAMA — PORTALE CENTRI V2, SEZIONE "CENTRO" (28/10/2026, tavola 8 del mock).
// Una pagina di sole righe verso le pagine che esistono già (REUSE): profilo,
// regole, strumenti, account. Lo stato "Da fare / Fatto" viene dagli stessi
// controlli dell'attivazione (lib/centers/activation.ts), così il centro vede
// la stessa cosa qui e nella card di Oggi.
export const dynamic = "force-dynamic";

type RowState = "done" | "todo" | "optional" | "soon" | "link";

interface Row {
  label: string;
  href?: string;
  state: RowState;
  hint?: string;
}

function StateMark({ state }: { state: RowState }) {
  if (state === "done") return <i className="ti ti-check text-[20px] text-trama-green" role="img" aria-label="Fatto" />;
  if (state === "todo")
    return (
      <span className="rounded-full bg-[#FFF3DC] px-2.5 py-1 text-[12px] font-bold text-[#7A4F00]">Da fare</span>
    );
  if (state === "optional") return <span className="text-[12.5px] text-ink-2">Facoltativo</span>;
  if (state === "soon")
    return (
      <span className="rounded-full border border-dashed border-[#B9C6C2] px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">
        In programma
      </span>
    );
  return <i className="ti ti-chevron-right text-[18px] text-ink-2" aria-hidden="true" />;
}

function Section({ id, title, rows }: { id: string; title: string; rows: Row[] }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">
        {title}
      </h2>
      <ul className="overflow-hidden rounded-[18px] border border-partner-line bg-white">
        {rows.map((r, i) => {
          const inner = (
            <>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`text-[15px] ${r.state === "soon" ? "text-ink-2" : "text-ink"}`}>{r.label}</span>
                {r.hint && <span className="text-[12.5px] text-ink-2">{r.hint}</span>}
              </span>
              <StateMark state={r.state} />
            </>
          );
          const cls = `flex min-h-[52px] items-center gap-3 px-4 py-2 ${i < rows.length - 1 ? "border-b border-[#EEF2F1]" : ""}`;
          return (
            <li key={r.label}>
              {r.href ? (
                <Link href={r.href} className={`${cls} transition-colors hover:bg-partner-page`}>
                  {inner}
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function CentroPage() {
  // Senza il guscio V2 la sezione non esiste: si torna al profilo di sempre.
  if (!(await partnerShellEnabledForCurrentUser())) redirect("/center/profile");

  const { center, dbId } = await getMyCenter();
  const [activities, activation] = await Promise.all([getActivitiesForCenter(dbId, center.id), getMyCenterActivation(dbId)]);
  const view = activation ? activationView(activation.facts) : null;
  const checks = activation ? profileChecks(activation.facts.profile) : [];
  const done = (key: ProfileCheckKey): RowState => (checks.find((c) => c.key === key)?.done ? "done" : "todo");
  const previewSlug = pickFamilyPreviewSlug(activities);

  const status = !view
    ? null
    : view.active
      ? { text: "Attivo · visibile alle famiglie", cls: "bg-[#E6F6F0] text-[#146B4F]" }
      : view.current === "verifica"
        ? { text: "In verifica da TRAMA", cls: "bg-partner-soft text-partner-primary" }
        : { text: `In attivazione · profilo ${view.percent}%`, cls: "bg-[#FFF3DC] text-[#7A4F00]" };

  const initials = (center.name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 animate-fade-in">
      <h1 className="font-poppins text-[28px] font-semibold text-ink">Centro</h1>

      <div className="flex items-center gap-3.5 rounded-[20px] border border-partner-line bg-white p-4">
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-partner-soft font-poppins text-[20px] font-semibold text-partner-primary">
          {center.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo caricato dal centro
            <img src={center.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[16px] font-semibold text-ink">{center.name}</span>
          {center.city && <span className="text-[13px] text-ink-2">{center.city}</span>}
          {status && (
            <span className={`self-start rounded-full px-2.5 py-0.5 text-[12px] font-bold ${status.cls}`}>{status.text}</span>
          )}
        </div>
      </div>

      {previewSlug ? (
        <Link
          href={buildFamilyPreviewHref(previewSlug)}
          className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-partner-line bg-white text-[14.5px] font-semibold text-partner-primary hover:bg-partner-soft"
        >
          <i className="ti ti-eye text-[18px]" aria-hidden="true" />
          Come vi vedono le famiglie
        </Link>
      ) : (
        <p className="rounded-xl border border-dashed border-partner-line px-4 py-3 text-[13.5px] text-ink-2">
          Quando avrete la prima attività, da qui vedrete la sua scheda come la vedono le famiglie.
        </p>
      )}

      <Section
        id="c-profilo"
        title="Profilo del centro"
        rows={[
          { label: "Nome, zona e contatti", href: "/center/profile#contatti", state: done("contacts") },
          { label: "Indirizzo e mappa", href: "/center/profile#indirizzo", state: done("address") },
          {
            label: "Descrizione e logo",
            href: "/center/profile#descrizione",
            state: done("description"),
            hint: done("description") === "todo" ? "Almeno 30 caratteri" : undefined,
          },
          { label: "Accessibilità e punto ristoro", href: "/center/profile#accessibilita", state: "optional" },
          { label: "Sito e social", href: "/center/profile#social", state: "optional" },
          { label: "Più sedi", state: "soon" },
        ]}
      />

      <Section
        id="c-regole"
        title="Regole"
        rows={[
          { label: "Cancellazioni e modifiche", href: "/center/profile#cancellazioni", state: done("cancellation") },
          { label: "Sconti per più settimane, fratelli e gruppi", href: "/center/profile#sconti", state: "optional" },
          { label: "Promozioni", href: "/center/promotions", state: "link" },
        ]}
      />

      <Section
        id="c-strumenti"
        title="Strumenti"
        rows={[
          { label: "Registro presenze", href: "/center/attendance", state: "link" },
          { label: "Report presenze", href: "/center/report-presenze", state: "link" },
          { label: "Invita le vostre famiglie", href: "/center/invites", state: "link" },
          { label: "Servizi consigliati", href: "/center/servizi-consigliati", state: "link" },
        ]}
      />

      <Section
        id="c-account"
        title="Account"
        rows={[
          { label: "Persone del centro e permessi", state: "soon" },
          { label: "Il mio account e le notifiche", href: "/center/account", state: "link" },
          {
            label: "Scrivi a TRAMA",
            href: "mailto:trama@tramapp.it?subject=Dal%20portale%20centri",
            state: "link",
            hint: "trama@tramapp.it",
          },
        ]}
      />

      <LogoutButton className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-partner-line bg-white text-[14.5px] font-semibold text-[#B4361F] hover:bg-[#FFF4F1]" />
    </div>
  );
}
