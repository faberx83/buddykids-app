import Link from "next/link";
import CenterProfileClient from "./CenterProfileClient";
import { getMyCenter } from "@/lib/data/center-admin";
import { getActivitiesForCenter, getPromotionsForActivities } from "@/lib/data/activities";
import { getCenterOnboardingState } from "@/lib/onboarding/data";
import { CenterOnboardingStatus } from "@/lib/onboarding/types";
import { buildFamilyPreviewHref, pickFamilyPreviewSlug } from "@/lib/center/family-preview";

// Forza il render dinamico per-richiesta: questa pagina dipende dalla
// sessione/cookie dell'utente loggato (getMyCenter -> getCenterContext),
// quindi non deve mai essere servita da una cache condivisa tra utenti o
// stantia tra un aggiornamento di profiles.center_id e l'altro. Difensivo,
// aggiunto durante l'indagine sul bug "Salvato (demo)" persistente segnalato
// da Fabrizio nonostante i dati in Supabase fossero corretti.
export const dynamic = "force-dynamic";

const ONBOARDING_STATUS_LABEL: Record<CenterOnboardingStatus, string> = {
  LEAD: "Candidatura non ancora avviata",
  CLAIMED: "Profilo in compilazione",
  SUBMITTED: "In revisione da parte di TRAMA",
  CHANGES_REQUESTED: "TRAMA ha richiesto delle modifiche",
  APPROVED: "Pubblicato",
  SUSPENDED: "Sospeso",
};

export default async function CenterProfilePage() {
  const { center, dbId } = await getMyCenter();

  // FINAL PRE-FREEZE WAVE (sez. 10-15, 08/09/2026) — "Il mio centro" resta
  // un form di configurazione (invariato, CenterProfileClient sotto non è
  // toccato): questo header+riepilogo è un layer di ORIENTAMENTO sopra il
  // form, non una seconda Dashboard. Riusa dati/funzioni già esistenti
  // (stesse getActivitiesForCenter/getPromotionsForActivities della
  // Dashboard, stesso getCenterOnboardingState già usato per il redirect
  // onboarding) — nessuna nuova query dedicata salvo quelle strettamente
  // necessarie al riepilogo stesso.
  const [myActivities, onboarding] = await Promise.all([
    getActivitiesForCenter(dbId, center.id),
    getCenterOnboardingState(dbId),
  ]);
  const activePromotionsCount = (await getPromotionsForActivities(myActivities)).filter((p) => p.active).length;

  // "ANTEPRIMA FAMIGLIA" (sez. 11) — NON esiste una route pubblica dedicata
  // al centro in sé (audit: nessuna /centro/[slug], il centro è visibile
  // solo INDIRETTAMENTE dentro la pagina di ogni sua attività pubblicata,
  // /activity/[id]). Per non "costruire una fake preview" (vincolo esplicito
  // dello spec), la CTA punta alla PRIMA attività pubblicata reale — la
  // superficie pubblica vera che una famiglia vedrebbe oggi. Se il centro
  // non ha ancora nessuna attività pubblicata, non esiste alcuna vera
  // superficie pubblica da mostrare: niente CTA, niente preview finta (vedi
  // FINAL_AUDIT/CURRENT_STATE_ADDENDUM per questo gap documentato).
  //
  // TRAMA PARTNER — LIVE MOBILE BUGFIX (01/10/2026), segnalazione live di
  // Fabrizio: tap sulla CTA → "non succede nulla". Root cause: il link
  // apriva /activity/[slug] in una nuova scheda (target _blank). Dalla PWA installata
  // (display: standalone) una nuova scheda non è garantita (iOS/Android la
  // gestiscono in modo diverso, a volte senza effetto visibile) e, anche
  // quando si apre, è un contesto SENZA cronologia: la freccia "Indietro"
  // della scheda attività (router.back()) non porta da nessuna parte e il
  // contesto Partner si perde. Ora: stessa scheda, ?anteprima=partner (vedi
  // lib/center/family-preview.ts) con barra di ritorno a "Il mio centro".
  const previewActivitySlug = pickFamilyPreviewSlug(myActivities);

  // Checklist binaria REALE (sez. 12-13) — NON riusa il checklist item
  // "profile_complete" di lib/onboarding/checklist-registry.ts: quella riga
  // è una spunta MANUALE del wizard di onboarding Controlled Beta
  // (app/center/one/onboarding/OnboardingClient.tsx), non ricalcolata dal
  // form reale — potrebbe restare "completo" anche dopo che il gestore
  // svuota un campo qui. Calcolata invece LIVE sugli stessi campi che lo
  // spec elenca come ammessi (nome/descrizione/indirizzo/contatti/logo +
  // almeno un'attività pubblicata), lette direttamente da `center`/
  // `myActivities` già caricati sopra — mai una percentuale, solo un
  // binario onesto.
  const profileFieldsComplete = Boolean(
    center.name?.trim() &&
      center.description?.trim() &&
      center.address?.trim() &&
      center.contactEmail?.trim() &&
      center.contactPhone?.trim() &&
      center.logoUrl
  );
  const profileComplete = profileFieldsComplete && myActivities.length > 0;

  return (
    <div className="max-w-2xl">
      {/* TRAMA PARTNER — LIVE MOBILE BUGFIX (01/10/2026). Root cause della
          sovrapposizione su mobile: riga flex unica [logo][testo flex-1
          min-w-0][CTA flex-shrink-0 whitespace-nowrap]. Sotto ~480px la CTA
          (~235px, non comprimibile) + logo + gap superavano lo spazio
          disponibile: la colonna testo veniva schiacciata a ~0px, il nome
          del centro "colava" fuori dalla sua colonna sopra la CTA e la CTA
          sporgeva oltre il bordo della card. Ora su mobile si impila
          ([logo][nome+città+stato] sopra, CTA a tutta larghezza sotto); da
          sm (≥640px) torna la riga orizzontale di prima, con la CTA a destra
          — layout desktop invariato. Nessuna riduzione del font. */}
      <div
        data-testid="center-profile-header"
        className="mb-4 flex flex-col gap-3 rounded-[14px] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl"
            style={{ background: center.gradient }}
          >
            {center.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo caricato dall'utente, nessuna ottimizzazione next/image necessaria per un avatar 56px
              <img src={center.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              center.emoji
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div data-testid="center-profile-name" className="break-words text-lg font-bold leading-snug text-ink">
              {center.name}
            </div>
            <div className="break-words text-[12.5px] text-ink-2">
              {center.city ? `${center.city} · ` : ""}
              {ONBOARDING_STATUS_LABEL[onboarding.status]}
            </div>
          </div>
        </div>
        {previewActivitySlug ? (
          <Link
            href={buildFamilyPreviewHref(previewActivitySlug)}
            data-testid="family-preview-cta"
            className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#E8EBF0] px-3.5 py-2 text-center text-[12.5px] font-bold text-ink transition-colors hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky sm:w-auto sm:flex-shrink-0 sm:whitespace-nowrap md:min-h-0"
          >
            Vedi come ti vedono le famiglie
          </Link>
        ) : (
          // Stato B esplicito: nessuna attività → nessuna superficie
          // pubblica reale da mostrare. Niente pulsante "morto": un testo
          // non interattivo che dice perché e cosa fare.
          <p
            data-testid="family-preview-unavailable"
            className="rounded-lg bg-bg px-3.5 py-2 text-[12px] text-ink-2 sm:max-w-[220px]"
          >
            Anteprima famiglia disponibile dopo aver creato la prima attività.
          </p>
        )}
      </div>

      {/* Riepilogo configurazione (sez. 12) — leggero, non una dashboard:
          solo conteggi reali con link reali verso le pagine che li
          gestiscono davvero, per rispondere a "da cosa è composta la mia
          presenza su TRAMA?" senza replicarne il contenuto qui. */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href="/center/activities"
          className="flex flex-col items-start gap-1 rounded-[14px] bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors hover:bg-bg"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Attività</span>
          <span className="text-[15px] font-bold text-ink">
            {myActivities.length} pubblicat{myActivities.length === 1 ? "a" : "e"}
          </span>
          <span className="text-[11.5px] text-sky">Gestisci attività</span>
        </Link>
        <Link
          href="/center/promotions"
          className="flex flex-col items-start gap-1 rounded-[14px] bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors hover:bg-bg"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Promozioni</span>
          <span className="text-[15px] font-bold text-ink">
            {activePromotionsCount} attiv{activePromotionsCount === 1 ? "a" : "e"}
          </span>
          <span className="text-[11.5px] text-sky">Gestisci promozioni</span>
        </Link>
        <Link
          href="/center/servizi-consigliati"
          className="flex flex-col items-start gap-1 rounded-[14px] bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors hover:bg-bg"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Servizi</span>
          <span className="text-[15px] font-bold text-ink">Consigliati</span>
          <span className="text-[11.5px] text-sky">Vedi servizi</span>
        </Link>
        <div className="flex flex-col items-start gap-1 rounded-[14px] bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Profilo</span>
          <span className={`text-[15px] font-bold ${profileComplete ? "text-trama-green" : "text-trama-orange"}`}>
            {profileComplete ? "Completo" : "Da completare"}
          </span>
          <span className="text-[11.5px] text-ink-3">Modifica qui sotto</span>
        </div>
      </div>

      <CenterProfileClient center={center} dbId={dbId} />
    </div>
  );
}
