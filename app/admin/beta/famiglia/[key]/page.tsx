import Link from "next/link";
import { notFound } from "next/navigation";
import { getBetaCockpitData } from "@/lib/data/beta-cockpit";
import { romeDay, shortDateWithWeekday } from "@/lib/beta-cockpit/dates";
import { buildTimeline, computeFamilyRow, hoursLabel, lastActionLabel } from "@/lib/beta-cockpit/model";
import { Card, Empty, StatusBadge, YesNo, fmtDate } from "@/components/admin/beta/BetaUi";
import ExcludeMemberButton from "./ExcludeMemberButton";

export const dynamic = "force-dynamic";

// TRAMA — ADMIN BETA COCKPIT · Dettaglio di una famiglia: fatti in breve e
// una timeline sintetica (una riga per giorno e tipo di azione). Di default
// solo eventi significativi; "Tutti gli eventi" aggiunge i giorni con app
// aperta senza modifiche (migration 46). Mai nomi dei figli né contenuti
// degli impegni.
export default async function BetaFamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { key: rawKey } = await params;
  const sp = await searchParams;
  const key = decodeURIComponent(rawKey);
  const data = await getBetaCockpitData();
  if (!data) return notFound();
  const fam = data.raw.families.find((f) => f.key === key);
  if (!fam) return notFound();

  const today = romeDay(new Date());
  const actions = data.raw.actions.filter((a) => a.familyKey === key);
  const openDays = data.raw.openDays ? data.raw.openDays.filter((o) => o.familyKey === key) : null;
  const row = computeFamilyRow(fam, actions, openDays, today, data.settings.thresholds);
  const showAll = sp.tutti === "1" && openDays !== null;
  const timeline = buildTimeline(fam, actions, showAll ? openDays : null);
  const members = data.members.filter((m) => m.familyKey === key);
  const feedback = data.feedback.filter((f) => f.familyKey === key);

  const fact = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );

  return (
    <div>
      <Link href="/admin/beta?tab=famiglie" className="text-xs font-semibold text-white underline">
        ← Famiglie
      </Link>
      <div className="mb-4 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-white">{fam.label}</h1>
        <StatusBadge status={row.status} />
        {row.readsOnly && <span className="rounded bg-[#E8F0FE] px-1.5 text-[11px] font-semibold text-[#1A4FB0]">apre l&apos;app senza modificare</span>}
      </div>

      <Card title="In breve">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fact("Invito", fmtDate(row.invitedAt))}
          {fact("Registrazione", fmtDate(row.registeredAt))}
          {fact("Adulti", row.adults)}
          {fact("Onboarding", <YesNo value={row.onboardingDone} />)}
          {fact("Figli", row.kids)}
          {fact("Scuola", <YesNo value={row.school} />)}
          {fact("Impegni reali", row.commitments)}
          {fact("Attivata", row.activatedAt ? `${fmtDate(row.activatedAt)} (dopo ${hoursLabel(row.ttvActivationHours)})` : "no")}
          {fact("Coordinamento", <YesNo value={row.coordinationUsed} />)}
          {fact("Giorni attivi 7 / 14", `${row.activeDays7} / ${row.activeDays14}`)}
          {fact("App aperta, ultimi 7", row.openDays7 ?? "—")}
          {fact("Ultima azione", lastActionLabel(row, today))}
          {fact("Push", <YesNo value={row.pushActive} />)}
          {fact("Zona (scuola)", row.zones.join(", ") || "—")}
          {fact("Inviti genitore in attesa", row.pendingPartnerInvites.length)}
          {fact("Richieste senza risposta", row.openCenterRequests.length)}
        </dl>
        {row.unorganizedClosure && (
          <p className="mt-3 text-xs text-ink-2">
            Chiusura della scuola non organizzata: {fmtDate(row.unorganizedClosure.from + "T12:00:00Z")}–{fmtDate(row.unorganizedClosure.to + "T12:00:00Z")}.
          </p>
        )}
      </Card>

      <Card
        title="Timeline"
        subtitle={showAll ? "Tutti gli eventi, compresi i giorni con app aperta senza modifiche." : "Solo eventi significativi."}
        right={
          openDays !== null ? (
            <Link href={`/admin/beta/famiglia/${encodeURIComponent(key)}${showAll ? "" : "?tutti=1"}`} className="text-xs font-semibold text-trama-violet underline">
              {showAll ? "Solo significativi" : "Tutti gli eventi"}
            </Link>
          ) : null
        }
      >
        {timeline.length === 0 ? (
          <Empty>Ancora niente.</Empty>
        ) : (
          <ol className="flex flex-col gap-0.5 text-sm">
            {timeline.map((e, i) => (
              <li key={i} className={e.significant ? "text-ink" : "text-ink-3"}>
                <span className="inline-block w-24 text-ink-2">{shortDateWithWeekday(e.day)}</span> — {e.text}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {feedback.length > 0 && (
        <Card title="Feedback di questa famiglia">
          <ul className="flex flex-col gap-1.5 text-sm text-ink">
            {feedback.map((f) => (
              <li key={f.id}>
                <span className="text-xs text-ink-2">{fmtDate(f.at)} · </span>
                <span className="whitespace-pre-line">{f.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Adulti" subtitle="Iniziali e data di registrazione. Escludi chi non fa parte della beta (tu, account di prova).">
        {members.length === 0 ? (
          <Empty>Nessun account registrato.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm text-ink">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3">
                <span className="w-16 font-semibold">{m.label}</span>
                <span className="text-xs text-ink-2">dal {fmtDate(m.registeredAt)}</span>
                <ExcludeMemberButton userId={m.userId} excluded={m.excluded} disabled={!data.settings.tableReady} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
