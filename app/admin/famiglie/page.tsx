import Link from "next/link";
import { getAdminFamilyFunnel } from "@/lib/data/admin-ops";
import { INVITE_QUEUE_RULE, INVITE_STAGE_LABEL, codeUsage, countPeopleAndFamilies, invitePipeline, type InviteStage } from "@/lib/admin-ops/invitations";
import { buildJourney, type JourneyCell } from "@/lib/admin-ops/journey";
import { withoutTestAccounts } from "@/lib/admin-ops/test-accounts";
import { getPilotUsers, isPilotLastSignInAvailable } from "@/lib/data/pilot-users";

export const dynamic = "force-dynamic";

// TRAMA — ADMIN OPERATIVO (12/11/2026): Famiglie → Inviti e registrazioni.
// Richiesta di Fabrizio: "collega lista d'attesa, inviti, pilota e
// attivazione. Distingui invito preparato, invito effettivamente inviato,
// invito usato e registrazione: copiare un link non equivale a inviarlo.
// Mostra separatamente persone e famiglie. Mantieni gli invii manuali
// attuali". Regole in lib/admin-ops/invitations.ts. Nessun invio da qui: gli
// inviti si scrivono e si segnano in Lista d'attesa, come oggi.
// LOTTO 2 (16/11/2026): stessa regola "Da invitare" di Oggi e Lista d'attesa;
// per ogni richiesta registrata, link alla scheda Pilota e percorso
// richiesta → invio segnato → registrazione → benvenuto → prima azione utile
// → ritorno (definizioni del Pilota, lib/admin-ops/journey.ts).
const STAGE_CLASS: Record<InviteStage, string> = {
  richiesta: "bg-orange-light text-trama-orange",
  inviato: "bg-sky-light text-sky",
  registrata: "bg-green-light text-[#2d8f52]",
};

function day(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" }) : "—";
}

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminFamigliePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const fase = typeof sp.fase === "string" ? sp.fase : "";
  const [data, pilotUsers] = await Promise.all([getAdminFamilyFunnel(), getPilotUsers()]);
  if (!data) {
    return <p className="text-sm text-navy-text2">Dati disponibili solo all&apos;Admin piattaforma con Supabase collegato.</p>;
  }
  const excluded = new Set([...data.excludedIds, ...data.internalIds]);
  const all = countPeopleAndFamilies(data.parents, data.memberships, new Set());
  const beta = countPeopleAndFamilies(data.parents, data.memberships, excluded);
  const rows = invitePipeline(data.waitlist, data.parents);
  // 17/11/2026: le richieste di "Account di prova" sono fuori da fasi e conteggi; ?demo=1 le mostra.
  const showTest = sp.demo === "1";
  const testIds = new Set(data.excludedIds);
  const liveAll = rows.filter((r) => !r.archived);
  const live = withoutTestAccounts(liveAll, (r) => r.accountId, testIds, showTest);
  const hiddenTest = liveAll.length - live.length;
  const stageCount = (s: InviteStage) => live.filter((r) => r.stage === s).length;
  const shown = live.filter((r) => !fase || r.stage === fase);
  const viaCode = data.parents.filter((p) => p.betaCode && !excluded.has(p.id)).length;
  const codes = codeUsage(data.codes, data.parents);
  const pilotById = new Map(pilotUsers.map((u) => [u.id, u]));
  const signInMeasurable = isPilotLastSignInAvailable();
  const notMarked = live.filter((r) => r.inviteNotMarked).length;

  const stages: InviteStage[] = ["richiesta", "inviato", "registrata"];
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Inviti e registrazioni</h1>
        <p className="mt-1 text-sm text-navy-text2">
          Dalla richiesta d&apos;invito all&apos;account. &quot;Scrivi l&apos;invito&quot; e &quot;Copia link invito&quot;
          preparano soltanto: un invito conta come inviato quando lo segni in Lista d&apos;attesa dopo averlo spedito.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Persone (account genitore)" value={beta.people} sub={`${all.people} con quelli di prova`} />
        <Stat label="Famiglie" value={beta.families} sub={`${all.families} con quelle di prova`} />
        <Stat label="Entrate con un codice beta" value={viaCode} sub="codice usato alla registrazione" />
        <Stat label="Escluse dai conteggi" value={beta.excludedPeople} sub="coorte interna o account di prova" />
      </div>

      <h2 className="mb-2 text-[15px] font-bold text-white">Lista d&apos;attesa → invito → registrazione</h2>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <Link href="/admin/famiglie" className={`rounded-full border px-3 py-1 no-underline ${!fase ? "border-sky bg-sky text-white" : "border-navy-3 text-navy-text2"}`}>
          Tutte · {live.length}
        </Link>
        {stages.map((s) => (
          <Link
            key={s}
            href={`/admin/famiglie?fase=${s}`}
            className={`rounded-full border px-3 py-1 no-underline ${fase === s ? "border-sky bg-sky text-white" : "border-navy-3 text-navy-text2"}`}
          >
            {INVITE_STAGE_LABEL[s]} · {stageCount(s)}
          </Link>
        ))}
      </div>
      <p className="mb-2 text-xs text-navy-text2" data-testid="invite-queue-rule">
        {INVITE_QUEUE_RULE}
        {hiddenTest > 0 ? ` ${hiddenTest} ${hiddenTest === 1 ? "richiesta di un account di prova non contata" : "richieste di account di prova non contate"}.` : ""}
        {hiddenTest > 0 && (
          <Link href="/admin/famiglie?demo=1" className="ml-1 underline">Mostrale</Link>
        )}
        {showTest && (
          <Link href="/admin/famiglie" className="ml-1 underline">Nascondi le prove</Link>
        )}
        {notMarked > 0 ? ` ${notMarked} ${notMarked === 1 ? "registrata" : "registrate"} senza invio segnato: restano qui, fuori dalla coda.` : ""}
      </p>
      <div className="mb-2 rounded-lg border border-dashed border-navy-3 px-4 py-2 text-xs text-navy-text2">
        Invito preparato (email aperta o link copiato): non registrato da TRAMA, quindi non si conta. Per gli inviti usa{" "}
        <Link href="/admin/lista-attesa" className="font-semibold text-white underline">Lista d&apos;attesa</Link>.
      </div>
      <div className="mb-7 overflow-x-auto rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Fase</th>
              <th className="px-4 py-2.5 font-medium">Richiesta</th>
              <th className="px-4 py-2.5 font-medium">Invito segnato</th>
              <th className="px-4 py-2.5 font-medium">Registrata</th>
              <th className="px-4 py-2.5 font-medium">Benvenuto</th>
              <th className="px-4 py-2.5 font-medium">Prima azione utile</th>
              <th className="px-4 py-2.5 font-medium">Ritorno</th>
              <th className="px-4 py-2.5 font-medium">Chi deve agire</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const p = r.accountId ? pilotById.get(r.accountId) : undefined;
              const j = buildJourney(
                r,
                p
                  ? { onboardingStatus: p.onboardingStatus, firstActionAt: p.firstMeaningfulActionAt, firstActionLabel: p.firstMeaningfulActionLabel, lastSignInAt: p.lastSignInAt }
                  : null,
                signInMeasurable
              );
              return (
                <tr key={r.waitlistId} data-testid={`invite-row-${r.waitlistId}`} className="border-b border-[#F0F2F5] align-top last:border-0">
                  <td className="px-4 py-2.5 text-ink">
                    {r.email}
                    {r.comune ? <span className="block text-xs text-ink-2">{r.comune}</span> : null}
                    {j.pilotHref ? (
                      <Link href={j.pilotHref} className="block text-xs font-semibold text-sky">Scheda Pilota →</Link>
                    ) : r.accountId ? (
                      <span className="block text-xs text-ink-3">non nella coorte Pilota</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STAGE_CLASS[r.stage]}`}>{INVITE_STAGE_LABEL[r.stage]}</span>
                    {r.inviteNotMarked && <span className="mt-1 block text-[11px] text-ink-2">invio non segnato</span>}
                  </td>
                  <Cell c={j.requested} />
                  <Cell c={j.inviteMarked} />
                  <Cell c={j.registered} />
                  <Cell c={j.walkthrough} />
                  <Cell c={j.firstAction} />
                  <Cell c={j.returned} />
                  <td className="px-4 py-2.5 text-ink-2">
                    {r.stage === "richiesta" ? "TRAMA: scrivere e inviare l'invito" : r.stage === "inviato" ? "Famiglia: creare l'account" : "—"}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-ink-2">
                  Nessuna richiesta in questa fase.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-[15px] font-bold text-white">Codici invito</h2>
      <p className="mb-2 text-xs text-navy-text2">Un codice girato su WhatsApp dice quante famiglie lo hanno usato, non chi l&apos;ha ricevuto.</p>
      <div className="mb-7 overflow-x-auto rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
              <th className="px-4 py-2.5 font-medium">Codice</th>
              <th className="px-4 py-2.5 font-medium">Usato</th>
              <th className="px-4 py-2.5 font-medium">Account creati</th>
              <th className="px-4 py-2.5 font-medium">Scade</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.code} className="border-b border-[#F0F2F5] last:border-0">
                <td className="px-4 py-2.5 text-ink">
                  {c.label ?? c.code} {!c.active && <span className="text-xs text-ink-3">(disattivato)</span>}
                </td>
                <td className="px-4 py-2.5 text-ink-2">
                  {c.redeemed}
                  {c.max !== null ? ` su ${c.max}` : ""}
                </td>
                <td className="px-4 py-2.5 text-ink-2">{c.accounts}</td>
                <td className="px-4 py-2.5 text-ink-2">{day(c.expiresAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        <Link href="/admin/beta" className="font-semibold text-white underline underline-offset-2">Attivazione: Beta Famiglie →</Link>
        <Link href="/admin/beta-invites" className="font-semibold text-white underline underline-offset-2">Gestisci i codici →</Link>
        <Link href="/admin/one/pilot" className="font-semibold text-white underline underline-offset-2">Pilota (per persona) →</Link>
      </div>
    </div>
  );
}

function Cell({ c }: { c: JourneyCell }) {
  return (
    <td className={`px-4 py-2.5 ${c.unknown ? "text-ink-3" : "text-ink-2"}`}>
      {c.value}
      {c.detail ? <span className="block text-[11px] text-ink-3">{c.detail}</span> : null}
    </td>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
      <div className="text-xl font-bold text-ink">{value}</div>
      <div className="text-xs font-semibold text-ink">{label}</div>
      <div className="text-[11px] text-ink-2">{sub}</div>
    </div>
  );
}
