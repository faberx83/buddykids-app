import Link from "next/link";
import { redirect } from "next/navigation";
import StatCard from "@/components/dashboard/StatCard";
import AdminMockDataBanner from "@/components/admin/AdminMockDataBanner";
import PushNotificationsPrompt from "@/components/PushNotificationsPrompt";
import { getActivitiesForCenter, getPromotionsForActivities, getTodaySpecialDaysForActivities } from "@/lib/data/activities";
import { getBookingsForCenter } from "@/lib/data/center-bookings";
import { bookingNeedsAction, acceptedRevenue, pendingRevenue, PARTNER_DECISION_LABEL } from "@/lib/booking-response/effective-decision";
import { getOpenInquiriesCountForCenter } from "@/lib/data/inquiries";
import { getGroupRequestsForCenter } from "@/lib/data/group-requests";
import { getTodayAttendanceSummary, getUnconfirmedParentCheckinsCount } from "@/lib/data/attendance";
import { getMyCenter } from "@/lib/data/center-admin";
import { getCenterOnboardingState } from "@/lib/onboarding/data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { Role } from "@/lib/types";
import { CenterOnboardingStatus } from "@/lib/onboarding/types";

// TRAMA ONE — Sezione 7 (Chiusura P0 Partner). Gap documentato in DEC-58/
// DEC-62 (docs/trama-one/analysis/DECISION_LOG.md): questa dashboard non
// controllava mai lo stato di onboarding del centro per reindirizzare un
// center_admin non ancora APPROVED verso `/center/one/onboarding`.
//
// Il redirect è volutamente condizionato a TRAMA_ONE_ENABLED risolto per
// l'utente corrente (stesso resolver di app/center/layout.tsx) — NON un
// controllo sempre-attivo. Motivo tecnico, non solo di policy: la route di
// destinazione `/center/one/onboarding` è essa stessa dietro lo stesso
// flag (app/center/one/layout.tsx: se il flag risolve false, quella route
// reindirizza SUBITO a `/center`). Un redirect incondizionato qui
// creerebbe un loop di redirect per qualunque center_admin fuori dalla
// Controlled Beta Cohort con onboarding incompleto — una regressione reale,
// non ipotetica. Con il gate al flag, il comportamento per chi è fuori
// coorte resta IDENTICO a prima (nessun redirect, coerente con DEC-57:
// mai on-by-default); per chi è in coorte (oggi: gli account di test
// Fabrizio) il gap descritto in DEC-58 è chiuso davvero.
async function maybeRedirectToOnboarding() {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, center_id")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "center_admin" || !profile.center_id) return;

  // IMPORTANTE: tenant "partner", non "center" — deve corrispondere ESATTAMENTE
  // al valore usato da app/center/one/layout.tsx (la route di destinazione),
  // non a quello di app/center/layout.tsx (che usa "center" solo per il
  // proprio overlay Spotlight). Se questo valore divergesse da quello del
  // gate di destinazione, un domani un override scope=tenant differenziato
  // potrebbe far decidere "redirect" qui e "rimanda indietro" là — lo
  // stesso loop che l'intero controllo esiste per evitare.
  const enabled = await resolveFeatureFlag({
    flagName: "TRAMA_ONE_ENABLED",
    userId: user.id,
    role: profile.role as Role,
    tenant: "partner",
    correlationId: generateCorrelationId(),
  });
  if (!enabled) return;

  const onboarding = await getCenterOnboardingState(profile.center_id);
  if (onboarding.status !== "APPROVED") {
    redirect("/center/one/onboarding");
  }
}

// Stesso pattern già in uso in lib/data/command-center.ts (daysSince via
// Date.now()) — estratta qui come funzione a parte (non un componente/hook)
// perché eslint (react-hooks/purity) segnala Date.now() se chiamato
// direttamente nel corpo del componente di pagina sotto: chiamarlo da una
// funzione separata risolve l'avviso senza perdere nulla in leggibilità.
function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
}

// Stesso motivo/pattern di daysSince sopra (react-hooks/purity) — trend
// settimanale e promozioni in scadenza (redesign Dashboard 07/09/2026).
function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const ONBOARDING_STATUS_LABEL: Record<CenterOnboardingStatus, string> = {
  LEAD: "Candidatura non ancora avviata",
  CLAIMED: "Profilo in compilazione",
  SUBMITTED: "In revisione da parte di TRAMA",
  CHANGES_REQUESTED: "TRAMA ha richiesto delle modifiche",
  APPROVED: "Approvato",
  SUSPENDED: "Sospeso",
};

// PRE-LAUNCH REMEDIATION WAVE 1 — R-02 (decisione Fabrizio, 24/08/2026):
// questa dashboard leggeva SEMPRE bookingsMock/activities/centers (mock),
// anche a Supabase configurato — a differenza del resto del portale Partner
// (Richieste, Richieste Gruppo, Inbox prenotazioni, Attività) già reale.
// Riscritta come dashboard "task-first" minimale ma REALE: riusa
// esclusivamente funzioni di lettura già esistenti (reuse-first, CLAUDE.md
// §2) — nessuna nuova tabella/migrazione. Grafico occupazione e
// suggerimenti cross-selling (entrambi costruiti solo su dati mock, nessun
// equivalente reale esistente oggi) sono stati rimossi invece di essere
// "reincartati": un gap dichiarato è preferibile a un numero finto.
export default async function CenterDashboardPage() {
  await maybeRedirectToOnboarding();

  const { center, dbId } = await getMyCenter();
  const isMockCenter = dbId === null;

  const [myActivities, bookings, openInquiriesCount, groupRequests, onboarding] = await Promise.all([
    getActivitiesForCenter(dbId, center.id),
    getBookingsForCenter(),
    getOpenInquiriesCountForCenter(),
    getGroupRequestsForCenter(),
    getCenterOnboardingState(dbId),
  ]);
  const activePromotions = (await getPromotionsForActivities(myActivities)).filter((p) => p.active);

  // Blocco "Oggi al centro" (proposta Fabrizio 07/09/2026) — tre query in
  // parallelo: le prime due sono NUOVE ma leggere (vedi commenti nei
  // rispettivi data layer), la terza riusa una funzione già esistente
  // (stesso conteggio già mostrato come badge nel menu "Registro presenze").
  const [attendanceSummary, todaySpecialDays, unconfirmedCheckins] = await Promise.all([
    getTodayAttendanceSummary(),
    getTodaySpecialDaysForActivities(myActivities),
    getUnconfirmedParentCheckinsCount(),
  ]);

  const activeBookings = bookings.filter((b) => b.status !== "cancelled");
  // Segnalazione Fabrizio 03/09/2026 ("aggiornare dashboard gestore con dati
  // reali"): questa pagina legge già Supabase per intero (fix R-02 del
  // 24/08, precedente a questa sessione) — il problema reale erano questi
  // due numeri, derivati da bookings.status (pagamento, quasi sempre già
  // "confirmed" col pagamento demo) invece che da partnerDecision (risposta
  // OPERATIVA del centro). Stessi helper condivisi già usati dall'Inbox
  // (/center/prenotazioni), vedi lib/booking-response/effective-decision.ts.
  const pendingBookings = activeBookings.filter(bookingNeedsAction);
  const confirmedRevenue = activeBookings.reduce((sum, b) => sum + acceptedRevenue(b), 0);
  const pendingGroupRequests = groupRequests.filter((r) => r.status === "pending");
  // Già ordinate per created_at desc dalla query in getBookingsForCenter().
  const recentBookings = activeBookings.slice(0, 5);
  const onboardingIncomplete = onboarding.status !== "APPROVED";

  // KPI aggiuntive (segnalazione Fabrizio 03/09/2026: "in dashboard GESTORE
  // inserirei qualche KPI in più, che sia utile a vedere le azioni da
  // svolgere o le informazioni utili") — tutte derivate dagli stessi dati
  // già caricati sopra (nessuna nuova query), stesso principio di riuso già
  // applicato a pendingBookings/confirmedRevenue.
  //
  // 1) Fatturato "in sospeso": quanto valgono in euro le richieste su cui il
  //    centro deve ancora decidere — risponde a "quanto vale, in soldi,
  //    quello che ho da fare?", non solo "quante richieste".
  const revenueAwaitingDecision = activeBookings.reduce((sum, b) => sum + pendingRevenue(b), 0);
  // 2) Da quanti giorni aspetta la richiesta più vecchia ancora da
  //    evadere — un conteggio da solo non dice se è urgente o arrivata
  //    stamattina.
  const oldestPendingDays =
    pendingBookings.length > 0
      ? daysSince(pendingBookings.reduce((a, b) => (a.createdAt < b.createdAt ? a : b)).createdAt)
      : 0;
  // 3) Proposte inviate al genitore, in attesa della SUA risposta — non è
  //    un'azione da svolgere per il centro (la palla è dal lato del
  //    genitore), ma spiega perché quelle prenotazioni non si muovono.
  const awaitingParentReply = activeBookings.filter((b) => b.partnerDecision === "proposed");

  // Trend settimanale su fatturato confermato e prenotazioni in attesa
  // (proposta Fabrizio 07/09/2026) — SOLO su queste due KPI, non su tutte:
  // sono le uniche due dove un raffronto ha senso a colpo d'occhio (cumulate
  // nel tempo), e sono derivate dagli STESSI bookings già caricati sopra
  // (nessuna query in più, solo un filtro su createdAt già presente).
  const sevenDaysAgoIso = isoDaysFromNow(-7);
  const revenueConfirmedThisWeek = activeBookings
    .filter((b) => b.createdAt >= sevenDaysAgoIso)
    .reduce((sum, b) => sum + acceptedRevenue(b), 0);
  const pendingCreatedThisWeek = pendingBookings.filter((b) => b.createdAt >= sevenDaysAgoIso).length;

  // Promozioni in scadenza entro 7 giorni — stesso array activePromotions
  // già caricato sopra, nessuna query in più (solo un filtro su validTo).
  const in7DaysIso = isoDaysFromNow(7).slice(0, 10);
  const todayIsoForPromo = todayIsoDate();
  const expiringPromotions = activePromotions.filter(
    (p) => p.validTo && p.validTo >= todayIsoForPromo && p.validTo <= in7DaysIso
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-ink">{center.name}</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            {onboardingIncomplete
              ? ONBOARDING_STATUS_LABEL[onboarding.status]
              : "Ecco la situazione di oggi"}
          </p>
        </div>
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-xl"
          style={{ background: center.gradient }}
        >
          {center.emoji}
        </div>
      </div>

      {isMockCenter && (
        <AdminMockDataBanner description="Nessun centro reale collegato a questo account — i numeri qui sotto sono di esempio, non prenotazioni/attività/richieste reali." />
      )}

      {/* Invito proattivo push (01/09/2026) — stesso componente condiviso
          del genitore, si autonasconde da solo se non applicabile. */}
      <PushNotificationsPrompt />

      {onboardingIncomplete && !isMockCenter && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-yellow-light p-3.5">
          <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-[#FCEFC0]">
            <i className="ti ti-clock-hour-4 text-base text-[#9a6b00]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-ink">
              Profilo centro: {ONBOARDING_STATUS_LABEL[onboarding.status]}
            </div>
            <div className="mt-0.5 text-[11.5px] text-[#9a6b00]">
              Finché il profilo non è Approvato, la tua attività non è visibile alle famiglie.
            </div>
          </div>
        </div>
      )}

      {/* Blocco "Oggi al centro" (proposta Fabrizio 07/09/2026) — prima cosa
          vista dopo i banner di stato account, prima ancora di "cose da
          guardare oggi": risponde a "cosa succede oggi", non "cosa devo
          decidere". Niente placeholder vuoti: se oggi non c'è nessuno
          atteso e nessuna giornata speciale, il blocco non appare. */}
      {(attendanceSummary.expectedToday > 0 || todaySpecialDays.length > 0) && (
        <div className="mb-4 rounded-[14px] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13.5px] font-bold text-ink">Oggi al centro</span>
            <Link href="/center/attendance" className="text-xs font-medium text-sky">
              Registro presenze
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {attendanceSummary.expectedToday > 0 && (
              <Link
                href="/center/attendance"
                className="flex items-center gap-1.5 rounded-lg bg-bg px-3 py-2 text-[12.5px] text-ink-2"
              >
                <i className="ti ti-clipboard-check text-sky" />
                <span className="font-bold text-ink">
                  {attendanceSummary.recordedToday}/{attendanceSummary.expectedToday}
                </span>{" "}
                presenze registrate
              </Link>
            )}
            {unconfirmedCheckins > 0 && (
              <Link
                href="/center/attendance"
                className="flex items-center gap-1.5 rounded-lg bg-orange-light px-3 py-2 text-[12.5px] font-semibold text-trama-orange"
              >
                <i className="ti ti-bell-ringing" />
                {unconfirmedCheckins} da confermare
              </Link>
            )}
            {todaySpecialDays.map((d) => (
              <Link
                key={`${d.activityId}-${d.label}`}
                href={`/center/activities/${d.activityId}`}
                className="flex items-center gap-1.5 rounded-lg bg-[#FFF3D6] px-3 py-2 text-[12.5px] font-semibold text-[#9A6B00]"
              >
                <span>{d.emoji ?? "✨"}</span>
                {d.label} · {d.activityName}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Banner "cose da guardare oggi" — solo le condizioni davvero attive
          e reali, niente placeholder vuoti. */}
      {(pendingBookings.length > 0 || openInquiriesCount > 0 || pendingGroupRequests.length > 0) && (
        <div className="mb-4 flex flex-col gap-2">
          {pendingBookings.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-orange-light p-3.5">
              <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-orange-mid">
                <i className="ti ti-ticket text-base text-trama-orange" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-ink">
                  {pendingBookings.length} prenotazion{pendingBookings.length === 1 ? "e" : "i"} in attesa
                  di risposta
                </div>
                <div className="mt-0.5 text-[11.5px] text-[#8a5a33]">
                  Le famiglie sono in attesa di conferma
                  {/* Segnalazione Fabrizio 03/09/2026: un conteggio da solo
                      non dice quanto è urgente — la più vecchia da quanti
                      giorni aspetta. */}
                  {oldestPendingDays > 0 &&
                    ` · la più vecchia da ${oldestPendingDays} giorn${oldestPendingDays === 1 ? "o" : "i"}`}
                </div>
              </div>
              {/* FIX (01/09/2026, segnalazione di Fabrizio: "se clicco su
                  Rispondi va in 404"): la route reale è /center/prenotazioni
                  — /center/bookings non è mai esistita come pagina. */}
              <Link
                href="/center/prenotazioni"
                className="flex-shrink-0 whitespace-nowrap rounded-lg bg-trama-orange px-3.5 py-2 text-[11.5px] font-bold text-white"
              >
                Rispondi
              </Link>
            </div>
          )}
          {openInquiriesCount > 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-sky-light p-3.5">
              <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-[#D6EEFB]">
                <i className="ti ti-message-circle-2 text-base text-sky" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-ink">
                  {openInquiriesCount} richiest{openInquiriesCount === 1 ? "a" : "e"} genitore aperta
                  {openInquiriesCount === 1 ? "" : "e"}
                </div>
              </div>
              <Link
                href="/center/richieste"
                className="flex-shrink-0 whitespace-nowrap rounded-lg bg-sky px-3.5 py-2 text-[11.5px] font-bold text-white"
              >
                Rispondi
              </Link>
            </div>
          )}
          {pendingGroupRequests.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-partner-light p-3.5">
              <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-partner-mid">
                <i className="ti ti-users-group text-base text-partner" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-ink">
                  {pendingGroupRequests.length} richiest{pendingGroupRequests.length === 1 ? "a" : "e"}{" "}
                  gruppo in attesa
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-partner">
                  Sconto gruppo · {pendingGroupRequests[0].activityName}
                </div>
              </div>
              <Link
                href="/center/group-requests"
                className="flex-shrink-0 whitespace-nowrap rounded-lg bg-partner px-3.5 py-2 text-[11.5px] font-bold text-white"
              >
                Rivedi
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Collegamenti rapidi (proposta Fabrizio 07/09/2026) — le sezioni
          utili quasi ogni giorno che oggi restano "nascoste" nel menu
          laterale. Link reali verso pagine già esistenti, nessuna nuova
          route. Badge "in scadenza" su Promozioni solo quando pertinente
          (niente placeholder vuoti, stesso principio dei banner sopra). */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href="/center/report-presenze"
          className="flex flex-col items-start gap-2 rounded-[14px] bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors hover:bg-bg"
        >
          <i className="ti ti-chart-bar text-lg text-sky" />
          <span className="text-[12.5px] font-bold text-ink">Report presenze</span>
        </Link>
        <Link
          href="/center/promotions"
          className="flex flex-col items-start gap-2 rounded-[14px] bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors hover:bg-bg"
        >
          <i className="ti ti-discount-2 text-lg text-[#9A6B00]" />
          <span className="text-[12.5px] font-bold text-ink">Promozioni</span>
          {expiringPromotions.length > 0 && (
            <span className="text-[11px] font-semibold text-trama-orange">
              {expiringPromotions.length} in scadenza
            </span>
          )}
        </Link>
        <Link
          href="/center/servizi-consigliati"
          className="flex flex-col items-start gap-2 rounded-[14px] bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors hover:bg-bg"
        >
          <i className="ti ti-map-2 text-lg text-aqua" />
          <span className="text-[12.5px] font-bold text-ink">Servizi consigliati</span>
        </Link>
        <Link
          href="/center/invites"
          className="flex flex-col items-start gap-2 rounded-[14px] bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors hover:bg-bg"
        >
          <i className="ti ti-user-plus text-lg text-partner" />
          <span className="text-[12.5px] font-bold text-ink">Inviti</span>
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Attività pubblicate"
          value={String(myActivities.length)}
          icon="ti-list-details"
          iconBg="#E8F6FD"
          iconColor="#4DAFEF"
          elevated
        />
        <StatCard
          label="Prenotazioni in attesa"
          value={String(pendingBookings.length)}
          icon="ti-ticket"
          iconBg="#FFF0EA"
          iconColor="#FF8C5A"
          elevated
          trend={pendingCreatedThisWeek > 0 ? `+${pendingCreatedThisWeek} questa settimana` : undefined}
        />
        <StatCard
          label="Richieste aperte"
          value={String(openInquiriesCount)}
          icon="ti-message-circle-2"
          iconBg="#E8F6FD"
          iconColor="#4DAFEF"
          elevated
        />
        <StatCard
          label="Fatturato confermato"
          value={`€${confirmedRevenue}`}
          icon="ti-coin-euro"
          iconBg="#F0EEFF"
          iconColor="#8B7CF8"
          elevated
          trend={revenueConfirmedThisWeek > 0 ? `+€${revenueConfirmedThisWeek} questa settimana` : undefined}
        />
        {/* KPI aggiuntive (segnalazione Fabrizio 03/09/2026) — vedi commento
            sopra su revenueAwaitingDecision/awaitingParentReply per il
            perché di queste due, invece di es. un grafico occupazione che
            richiederebbe una query nuova su tutte le settimane/giorni delle
            attività (non solo quelle già prenotate), fuori scope oggi. */}
        <StatCard
          label="Fatturato in sospeso"
          value={`€${revenueAwaitingDecision}`}
          icon="ti-hourglass"
          iconBg="#FFF0EA"
          iconColor="#FF8C5A"
          elevated
        />
        <StatCard
          label="In attesa del genitore"
          value={String(awaitingParentReply.length)}
          icon="ti-message-2"
          iconBg="#E8F6FD"
          iconColor="#4DAFEF"
          elevated
        />
      </div>

      <div className="rounded-[14px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between border-b border-[#F0F2F5] px-4 py-3.5">
          <span className="text-[13.5px] font-bold text-ink">Prenotazioni recenti</span>
          {/* FIX (01/09/2026): stesso 404 del bottone "Rispondi" sopra —
              /center/bookings non è mai esistita, la route reale è
              /center/prenotazioni. */}
          <Link href="/center/prenotazioni" className="text-xs font-medium text-sky">
            Vedi tutte
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-3">
              <th className="px-4 py-2 font-medium">Bambin{recentBookings.length === 1 ? "o" : "i"}</th>
              <th className="px-4 py-2 font-medium">Attività</th>
              <th className="px-4 py-2 font-medium">Totale</th>
              <th className="px-4 py-2 font-medium">Stato</th>
            </tr>
          </thead>
          <tbody>
            {recentBookings.map((b) => (
              <tr key={b.id} className="border-t border-[#F5F6FA]">
                <td className="px-4 py-2.5 font-medium text-ink">{b.kidNames.join(", ")}</td>
                <td className="px-4 py-2.5 text-ink-2">{b.activityName}</td>
                <td className="px-4 py-2.5 font-semibold text-ink">€{b.totalAmount}</td>
                <td className="px-4 py-2.5">
                  {/* Segnalazione Fabrizio 03/09/2026: qui prima si mostrava
                      bookings.status, quasi sempre "Confermata" col
                      pagamento demo indipendentemente da cosa il centro
                      avesse deciso — non era falso, ma rispondeva alla
                      domanda sbagliata ("il genitore ha pagato?" invece di
                      "il centro ha risposto?"). partnerDecision è la stessa
                      risposta operativa già mostrata nell'Inbox. */}
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${PARTNER_DECISION_LABEL[b.partnerDecision].cls}`}
                  >
                    {PARTNER_DECISION_LABEL[b.partnerDecision].label}
                  </span>
                </td>
              </tr>
            ))}
            {recentBookings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-ink-2">
                  Nessuna prenotazione ancora.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Il vecchio banner "N promo attive" qui sotto è stato rimosso
          (redesign Dashboard 07/09/2026): stessa informazione, con in più
          la scadenza, ora nella card "Promozioni" dei Collegamenti rapidi
          in cima alla pagina — evitava una duplicazione dello stesso link. */}
    </div>
  );
}
