import Link from "next/link";
import { getPilotUsers, isPilotLastSignInAvailable } from "@/lib/data/pilot-users";
import { getTestAccountIds } from "@/lib/data/admin-ops";
import { withoutTestAccounts } from "@/lib/admin-ops/test-accounts";
import PilotAdminClient from "./PilotAdminClient";

// Dipende dal ruolo dell'utente loggato (RLS is_platform_admin() su
// profiles/beta_cohort_memberships/tutorial_progress/bookings/kids) — stessa
// motivazione già stabilita per le altre pagine /admin/one/* (vedi
// app/admin/one/page.tsx).
export const dynamic = "force-dynamic";

// TRAMA — Wave 1 "Pilot Observability" (audit: TRAMA_PILOT_ARCHITECTURE_
// REVIEW.md sez.8 — "Admin: chi è entrato nel pilot e se ha iniziato
// davvero a usare TRAMA"). Sotto /admin/one/* per restare accanto al
// Command Center esistente (stesso layout, stesso gate TRAMA_ONE_ENABLED +
// platform_admin già applicato da app/admin/one/layout.tsx e
// app/admin/layout.tsx — nessun guard nuovo scritto qui, solo riuso).
// Nessuna nuova tabella: getPilotUsers() deriva tutto da dati già esistenti
// (vedi lib/data/pilot-users.ts per il dettaglio fonte-per-fonte).
// 17/11/2026: gli "Account di prova" (Beta Famiglie) sono fuori dall'elenco e
// dai conteggi; si vedono con ?demo=1. La scheda singola resta raggiungibile.
export default async function PilotAdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const showTest = sp.demo === "1";
  const [allUsers, lastSignInAvailable, testAccounts] = await Promise.all([
    getPilotUsers(),
    Promise.resolve(isPilotLastSignInAvailable()),
    getTestAccountIds(),
  ]);
  const users = withoutTestAccounts(allUsers, (u) => u.id, testAccounts, showTest);
  const hiddenTest = allUsers.length - users.length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Pilota — Nuovi utenti</h1>
        <p className="mt-1 text-sm text-navy-text2">
          Chi si è registrato tramite invito Beta e se ha davvero iniziato a usare TRAMA — {users.length} utent
          {users.length === 1 ? "e" : "i"} nella Controlled Beta Cohort.
        </p>
        {(hiddenTest > 0 || showTest) && (
          <p className="mt-1 text-xs text-navy-text2" data-testid="pilot-test-accounts">
            {showTest ? (
              <>
                Compresi gli account di prova.{" "}
                <Link href="/admin/one/pilot" className="underline">Nascondili</Link>
              </>
            ) : (
              <>
                {hiddenTest} {hiddenTest === 1 ? "account di prova non contato" : "account di prova non contati"}.{" "}
                <Link href="/admin/one/pilot?demo=1" className="underline">Mostrali</Link>
              </>
            )}
          </p>
        )}
      </div>
      <PilotAdminClient users={users} lastSignInAvailable={lastSignInAvailable} />
    </div>
  );
}
