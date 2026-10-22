"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TramaThread from "@/components/nextgen/TramaThread";
import { monogramFor, threadColorFor } from "@/components/nextgen/ActivityVisual";
import { GroupDetail, CarpoolLeg } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { discountForGroupSize, GROUP_DISCOUNT_TIERS } from "@/lib/groups";
import { buildCarpoolMatches } from "@/lib/carpool";
import { familyOriginFromLocation } from "@/lib/public-links";
import {
  setGroupActivityAction,
  addKidToGroupAction,
  removeKidFromGroupAction,
  generateSubgroupsAction,
  sendGroupRequestAction,
  upsertCarpoolOfferAction,
  removeCarpoolOfferAction,
  upsertCarpoolRequestAction,
  removeCarpoolRequestAction,
  toggleGroupVisibilityAction,
  inviteToGroupAction,
  leaveGroupAction,
  deleteGroupAction,
} from "@/app/actions/groups";

const LEG_LABELS: Record<CarpoolLeg, string> = {
  dropoff: "Andata",
  pickup: "Ritorno",
  both: "Andata e ritorno",
};

// La preferenza nel gruppo resta legata al profilo del bambino (unica fonte
// di verità, usata anche per il match% in Home) — qui la peschiamo solo per
// pre-selezionarla nel form, invece di far ripartire il genitore da zero.
function bestTagIdForKid(
  kid: { interests?: string[] } | undefined,
  tags: { id: string; label: string }[]
): string {
  if (!kid?.interests?.length) return "";
  const match = tags.find((t) =>
    kid.interests!.some((i) => i.toLowerCase().includes(t.label.toLowerCase()))
  );
  return match?.id || "";
}

// TRAMA — GRUPPI V2 (14/10/2026, "allinea anche scheda e dettaglio
// dell'area GRUPPI al nuovo stile"). nextgen="v2" (GROUPS_V2_ENABLED):
// card bianche 20px con ombra leggera, titoli Poppins più grandi, bottoni a
// pillola alti 44px, intestazione e schede come Planner/Prenotazioni V2.
// nextgen=true e Legacy (false) restano identici a prima.
type GroupLook = boolean | "v2";
function groupLook(nextgen: GroupLook) {
  const v2 = nextgen === "v2";
  return {
    v2,
    card: v2 ? "mb-4 rounded-2xl border border-trama-line bg-white p-4" : "mb-4 rounded-lg border border-[#E8EBF0] bg-white p-3.5",
    cardFlush: v2 ? "mb-4 overflow-hidden rounded-2xl border border-trama-line bg-white" : "mb-4 rounded-lg border border-[#E8EBF0] bg-white",
    btnShape: v2 ? "min-h-[44px] rounded-[12px]" : "rounded-md",
    btnSecondary: v2
      ? "min-h-[44px] rounded-[12px] border border-[#D9DDE5] bg-white px-4 text-[13px] font-semibold text-trama-primary"
      : "rounded-md border border-[#E8EBF0] px-3.5 py-2 text-xs font-semibold text-ink",
    titleCls: v2
      ? "font-poppins text-[17px] font-semibold text-ink"
      : nextgen
        ? "font-poppins text-[13px] font-bold text-ink"
        : "text-sm font-bold text-ink",
  };
}

function DemoNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="mx-5 mb-3 rounded-lg border border-orange-mid bg-orange-light p-3 text-xs text-ink">
      <strong>Modalità demo:</strong> questa pagina mostra come funzionerà la sezione Gruppi, ma le
      azioni (aggiungere bambini, inviare la Richiesta Gruppo, l&apos;accompagnamento) richiedono
      Supabase collegato.
    </div>
  );
}

// Messaggio pronto per WhatsApp/SMS/email invece del solo link nudo — più
// facile da capire per chi lo riceve (chi sei, cos'è, perché aggiungersi).
function buildInviteText(
  inviterName: string,
  groupName: string,
  activityName: string | null,
  centerName: string | null
): string {
  const context = activityName
    ? `per "${activityName}"${centerName ? ` (${centerName})` : ""}`
    : "per organizzarci insieme per l'estate";
  const who = inviterName ? `Ciao! Sono ${inviterName}.` : "Ciao!";
  return `${who} Ho creato il gruppo "${groupName}" su TRAMA ${context} — aggiungiti così organizziamo insieme le settimane, lo sconto gruppo e magari anche l'accompagnamento in auto 🙌`;
}

function InviteButton({
  groupId,
  groupName,
  activityName,
  centerName,
  inviterName,
  v2 = false,
  inApp = false,
}: {
  groupId: string;
  groupName: string;
  activityName: string | null;
  centerName: string | null;
  inviterName: string;
  v2?: boolean;
  /** 22/10/2026 (correzioni UX): link "dentro l'app" /nextgen/groups/join/… invece di /groups/join/… (app vecchia). */
  inApp?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${familyOriginFromLocation(window.location)}${inApp ? "/nextgen/groups/join/" : "/groups/join/"}${groupId}`;
    const text = buildInviteText(inviterName, groupName, activityName, centerName);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Unisciti al gruppo TRAMA", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // utente ha annullato la condivisione — nessun errore da mostrare
    }
  }

  return (
    <button
      onClick={share}
      className={
        v2
          ? "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[12px] bg-trama-primary px-4 text-[14.5px] font-bold text-white active:bg-trama-primary-press"
          : "ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-md bg-white/80 px-3 py-2 text-xs font-bold text-ink"
      }
    >
      <i className={`ti ${copied ? "ti-check" : "ti-user-plus"} ${v2 ? "text-[18px]" : "text-sm"}`} />
      {copied ? "Messaggio copiato!" : "Invita famiglie"}
    </button>
  );
}

// TRAMA ONE — Gruppi "Scopri"/"Inviti" (24/08/2026, migration_25): due
// controlli aggiunti alla scheda gruppo, in coerenza con lo stesso gap
// segnalato da Fabrizio. Il toggle di visibilità è SOLO del creatore (stessa
// policy RLS "il creatore collega l'attività target", copre già l'update di
// is_public); l'invito per email è aperto a QUALUNQUE membro del gruppo,
// stesso perimetro dell'InviteButton "Invita famiglie" già esistente qui
// sopra (che resta invariato — questo è un canale AGGIUNTIVO, mirato a
// un'email specifica invece che "chiunque abbia il link").
function VisibilityAndInviteBlock({
  groupId,
  isPublic,
  createdByMe,
  nextgen,
}: {
  groupId: string;
  isPublic: boolean;
  createdByMe: boolean;
  nextgen: GroupLook;
}) {
  const router = useRouter();
  const accentBg = nextgen === "v2" ? "bg-trama-primary" : nextgen ? "bg-trama-violet" : "bg-sky";
  const accentFocus = nextgen ? "focus:border-trama-violet" : "focus:border-sky";
  const { titleCls, card: cardCls, btnShape } = groupLook(nextgen);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitingEmail, setInvitingEmail] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok?: string; error?: string } | null>(null);

  async function handleToggle() {
    setTogglingPublic(true);
    const result = await toggleGroupVisibilityAction(groupId, !isPublic);
    setTogglingPublic(false);
    if (!result.error) router.refresh();
  }

  async function handleInvite() {
    setInviteResult(null);
    setInvitingEmail(true);
    const result = await inviteToGroupAction(groupId, inviteEmail);
    setInvitingEmail(false);
    if (result.error) {
      setInviteResult({ error: result.error });
      return;
    }
    setInviteEmail("");
    setInviteResult({
      ok: result.emailSent
        ? "Invito inviato via email!"
        : "Invito creato — comparirà nella tab \"Inviti\" quando la persona accede con quella email.",
    });
  }

  return (
    <div className={cardCls}>
      {createdByMe && (
        // FIX (FINAL MICRO-PILOT LIVE ACCEPTANCE, 01/09/2026 — segnalazione
        // di Fabrizio: "il pulsante è sfalsato..e non ho capito come
        // funziona..dove lo vedo?"): items-center allineava il toggle al
        // centro dell'INTERO blocco (titolo + descrizione a 2 righe),
        // risultando visivamente sfalsato rispetto al titolo — ora
        // items-start + un piccolo offset lo allinea alla prima riga.
        // Copy chiarita: il gruppo compare nella tab "Scopri" di Gruppi
        // (non è un filtro da applicare, è dove ALTRI genitori lo trovano).
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className={titleCls}>Visibile in &quot;Scopri&quot;</div>
            <p className="mt-0.5 text-xs text-ink-2">
              Se attivo, il gruppo compare nella tab &quot;Scopri&quot; di Gruppi, dove altri
              genitori possono trovarlo e chiedere di unirsi.
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={togglingPublic}
            role="switch"
            aria-checked={isPublic}
            className={`relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-60 ${
              isPublic ? accentBg : "bg-[#D9DEE6]"
            }`}
          >
            {/* FIX (segnalazione Fabrizio 03/09/2026: "il pulsantino SCOPRI
                è ancora sfasato"): stesso identico bug già diagnosticato e
                corretto in PromemoriaClient.tsx — al pallino mancava
                un'ancora "left" esplicita, quindi il posizionamento assoluto
                dipendeva dalla "static position" calcolata dal browser
                invece che da una coordinata fissa (in pratica risultava
                spesso spostato/fuori dal track, specialmente in WebView
                Android). "left-0.5" fissa il punto di partenza; translate-x-5
                (20px) invece di translate-x-[22px] perché ora parte già da
                2px, non da 0 — stessa posizione finale, stessa matematica
                già verificata in PromemoriaClient. */}
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                isPublic ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      )}

      <div className={createdByMe ? "border-t border-[#F0F2F5] pt-3" : ""}>
        <div className={`mb-2 ${titleCls}`}>Invita per email</div>
        <div className="flex gap-2">
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@esempio.it"
            type="email"
            className={`min-w-0 flex-1 rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none ${accentFocus}`}
          />
          <button
            onClick={handleInvite}
            disabled={invitingEmail || !inviteEmail.trim()}
            className={`flex-shrink-0 ${btnShape} ${accentBg} px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60`}
          >
            {invitingEmail ? "Invio…" : "Invita"}
          </button>
        </div>
        {inviteResult?.error && <p className="mt-1.5 text-xs font-medium text-orange">{inviteResult.error}</p>}
        {inviteResult?.ok && <p className="mt-1.5 text-xs font-medium text-green">{inviteResult.ok}</p>}
      </div>
    </div>
  );
}

// TRAMA ONE (24/08/2026) — backHref opzionale (default "/groups") per essere
// riusato anche dal guscio NEXTGEN-native app/nextgen/groups/[id] (task
// #528, "rimandi legacy dentro NEXTGEN"): senza questa prop il link
// tornava sempre dentro il layout LEGACY, anche per chi era arrivato da
// NEXTGEN.
export default function GroupDetailClient({
  detail,
  activityOptions,
  inviterName,
  backHref = "/groups",
  nextgen = false,
  uxFix = false,
}: {
  detail: GroupDetail;
  activityOptions: { dbId: string; name: string; center: string }[];
  inviterName: string;
  backHref?: string;
  /** Segnalazione di Fabrizio (01/09/2026): "grafica legacy" rimasta dentro
   * Gruppi — questo componente è nativamente Legacy (accento sky, niente
   * Poppins) e viene RIUSATO com'era anche sotto /nextgen/groups/[id]. Con
   * nextgen=true, titoli e CTA principali passano ad accento
   * trama-violet/Poppins, stesso trattamento già dato a CoverageStrip
   * (PrenotazioniClient.tsx). Legacy (default false) resta invariato. */
  nextgen?: GroupLook;
  /** Correzioni dal test UX (21/10/2026, PARENT_UX_FIX_ENABLED, solo V2), UX-PARENT-009:
   *  gruppo appena creato con tre passi; aggregazioni e richiesta solo dopo attività e figli. */
  uxFix?: boolean;
}) {
  const [tab, setTab] = useState<"gruppo" | "accompagnamento">("gruppo");

  if (nextgen === "v2") {
    return (
      <div className="-mb-40 flex min-h-[calc(100%+10rem)] flex-col bg-trama-page pb-24">
        <div className="px-5 pt-3.5">
          <header className="flex items-center gap-1">
            <Link
              href={backHref}
              aria-label="Torna ai gruppi"
              className="-ml-2.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[22px] text-ink active:bg-black/[0.04]"
            >
              <i className="ti ti-arrow-left" aria-hidden="true" />
            </Link>
            <span className="text-[14px] text-ink-2">Gruppi</span>
          </header>
          <div className="mt-2 flex items-start gap-3">
            <span
              className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-trama-line bg-[#F4F1EA] font-poppins text-[20px] font-semibold text-trama-navy/80"
              aria-hidden="true"
            >
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: threadColorFor(detail.name) }} />
              {monogramFor(detail.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-poppins text-[24px] font-semibold leading-tight text-ink">{detail.name}</h1>
              <TramaThread className="my-1.5" />
              <p className="text-[13.5px] text-ink-2">
                {detail.activityName
                  ? `${detail.activityName}${detail.centerName ? ` · ${detail.centerName}` : ""}`
                  : "Nessuna attività collegata ancora"}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <InviteButton
              groupId={detail.id}
              groupName={detail.name}
              activityName={detail.activityName}
              centerName={detail.centerName}
              inviterName={inviterName}
              v2
              inApp={uxFix}
            />
            {uxFix && (
              <p className="mt-2 text-[12.5px] leading-snug text-ink-2">
                Nel gruppo non c&apos;è una chat: gli accordi restano tra voi genitori. Chi entra vede i bambini iscritti e le offerte di passaggio.
              </p>
            )}
          </div>
        </div>

        <div className="mt-3">
          <DemoNotice />
        </div>

        <div role="tablist" aria-label="Sezioni del gruppo" className="mx-5 mb-1 mt-2 grid grid-cols-2 gap-1 rounded-full bg-[#EEF0F4] p-1">
          {(["gruppo", "accompagnamento"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-[40px] rounded-full text-[14px] ${
                tab === t ? "bg-white font-bold text-trama-navy shadow-[0_1px_3px_rgba(23,42,77,0.12)]" : "font-semibold text-[#4B5563]"
              }`}
            >
              {t === "gruppo" ? (
                "Bambini e richiesta"
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <i className="ti ti-car text-[16px]" aria-hidden="true" />
                  Accompagnamento
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "gruppo" ? (
          <GruppoTab detail={detail} activityOptions={activityOptions} nextgen={nextgen} uxFix={uxFix} />
        ) : (
          <AccompagnamentoTab detail={detail} nextgen={nextgen} />
        )}
        {uxFix && <LeaveOrDeleteGroup detail={detail} backHref={backHref} />}
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-6">
      <div
        className="px-5 pb-4 pt-3.5"
        style={{ background: detail.gradient }}
      >
        <Link href={backHref} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-ink-2">
          <i className="ti ti-arrow-left" /> Gruppi
        </Link>
        <div className="flex items-center gap-2.5">
          <span className="text-3xl">{detail.emoji}</span>
          <div className="min-w-0 flex-1">
            <h1 className={nextgen ? "font-poppins text-lg font-bold text-ink" : "text-lg font-bold text-ink"}>
              {detail.name}
            </h1>
            <p className="text-xs text-ink-2">
              {detail.activityName
                ? `${detail.activityName}${detail.centerName ? ` · ${detail.centerName}` : ""}`
                : "Nessuna attività collegata ancora"}
            </p>
          </div>
          <InviteButton
            groupId={detail.id}
            groupName={detail.name}
            activityName={detail.activityName}
            centerName={detail.centerName}
            inviterName={inviterName}
          />
        </div>
      </div>

      <DemoNotice />

      <div className="mx-5 mt-3 flex rounded-lg bg-[#F4F6FA] p-[3px]">
        {(["gruppo", "accompagnamento"] as const).map((t) => (
          <div
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 cursor-pointer rounded-md py-2 text-center text-xs font-medium transition-all ${
              tab === t
                ? "bg-white font-bold text-ink shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                : "text-ink-2"
            }`}
          >
            {t === "gruppo" ? "Bambini & Richiesta" : "🚗 Accompagnamento"}
          </div>
        ))}
      </div>

      {tab === "gruppo" ? (
        <GruppoTab detail={detail} activityOptions={activityOptions} nextgen={nextgen} />
      ) : (
        <AccompagnamentoTab detail={detail} nextgen={nextgen} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab "Bambini & Richiesta"
// ─────────────────────────────────────────────
function GruppoTab({
  detail,
  activityOptions,
  nextgen,
  uxFix = false,
}: {
  detail: GroupDetail;
  activityOptions: { dbId: string; name: string; center: string }[];
  nextgen: GroupLook;
  uxFix?: boolean;
}) {
  const router = useRouter();
  const accentBg = nextgen === "v2" ? "bg-trama-primary" : nextgen ? "bg-trama-violet" : "bg-sky";
  const accentText = nextgen === "v2" ? "text-trama-accent-ink" : nextgen ? "text-trama-violet" : "text-sky";
  const accentFocus = nextgen ? "focus:border-trama-violet" : "focus:border-sky";
  const accentLight = nextgen === "v2" ? "bg-trama-primary-soft" : nextgen ? "bg-trama-lilac/20" : "bg-sky-light";
  const { titleCls, card: cardCls, cardFlush: cardFlushCls, btnShape, btnSecondary } = groupLook(nextgen);
  const [pickingActivity, setPickingActivity] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(activityOptions[0]?.dbId || "");
  const [savingActivity, setSavingActivity] = useState(false);

  const [addingKid, setAddingKid] = useState(false);
  const [selectedKid, setSelectedKid] = useState(detail.myKids[0]?.id || "");
  const [selectedTag, setSelectedTag] = useState(
    bestTagIdForKid(detail.myKids[0], detail.availableTags)
  );
  const [kidNotes, setKidNotes] = useState("");
  const [savingKid, setSavingKid] = useState(false);
  const [kidError, setKidError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);

  const [requestMessage, setRequestMessage] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const canSubmit = isSupabaseConfigured;
  const kidsCount = detail.kids.length;
  const groupDiscountTiers = detail.groupDiscountTiers ?? GROUP_DISCOUNT_TIERS;
  const previewDiscount = discountForGroupSize(kidsCount, groupDiscountTiers);
  // Se il bambino selezionato in precedenza è appena stato iscritto (quindi
  // non è più tra "i tuoi bambini disponibili" dopo il refresh), ricadiamo
  // sul primo disponibile invece di tenere un valore ormai non valido.
  const effectiveSelectedKid = detail.myKids.some((k) => k.id === selectedKid)
    ? selectedKid
    : detail.myKids[0]?.id || "";

  // Correzioni dal test UX (21/10/2026), UX-PARENT-009: finché mancano
  // attività o bambini, aggregazioni e richiesta al centro aspettano.
  const groupReady = Boolean(detail.activityId) && kidsCount > 0;
  const showAdvanced = !uxFix || groupReady;

  return (
    <div className="px-5 pt-4">
      {uxFix && !groupReady && (
        <div data-testid="group-first-steps" className={cardCls}>
          <div className={`mb-2 ${titleCls}`}>Per iniziare</div>
          <ol className="flex flex-col gap-2">
            {[
              { done: Boolean(detail.activityId), text: "Scegli l'attività da fare insieme" },
              { done: detail.kids.some((k) => k.isOwn), text: "Aggiungi i tuoi figli" },
              { done: kidsCount > detail.kids.filter((k) => k.isOwn).length, text: "Invita le altre famiglie con il pulsante qui sopra" },
            ].map((step, i) => (
              <li key={step.text} className="flex items-center gap-2.5 text-[14px] text-ink">
                <span
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                    step.done ? "bg-[#E6F6F0] text-[#146B4F]" : "bg-[#F1F3F6] text-trama-navy"
                  }`}
                >
                  {step.done ? <i className="ti ti-check text-[13px]" aria-hidden="true" /> : i + 1}
                </span>
                <span className={step.done ? "text-ink-2 line-through" : ""}>{step.text}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2.5 text-[12.5px] text-ink-2">Quando ci sono attività e bambini, qui puoi chiedere al centro un posto per il gruppo.</p>
        </div>
      )}
      {/* Attività target */}
      {!detail.activityId && detail.createdByMe && (
        <div className={cardCls}>
          <div className={`mb-2 ${titleCls}`}>Collega un&apos;attività</div>
          <p className="mb-2.5 text-xs text-ink-2">
            Serve per proporre le aggregazioni e per inviare la Richiesta Gruppo al centro giusto.
          </p>
          {!pickingActivity ? (
            <button
              onClick={() => setPickingActivity(true)}
              disabled={!canSubmit}
              className={`${btnShape} ${accentBg} px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60`}
            >
              Scegli attività
            </button>
          ) : (
            <div className="space-y-2">
              <select
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                className={`w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none ${accentFocus}`}
              >
                {activityOptions.map((a) => (
                  <option key={a.dbId} value={a.dbId}>
                    {a.name} — {a.center}
                  </option>
                ))}
              </select>
              <button
                onClick={async () => {
                  if (!selectedActivity) return;
                  setSavingActivity(true);
                  await setGroupActivityAction(detail.id, selectedActivity);
                  setSavingActivity(false);
                  router.refresh();
                }}
                disabled={savingActivity}
                className={`${btnShape} ${accentBg} px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60`}
              >
                {savingActivity ? "Salvo…" : "Conferma"}
              </button>
            </div>
          )}
        </div>
      )}

      <VisibilityAndInviteBlock
        groupId={detail.id}
        isPublic={detail.isPublic}
        createdByMe={detail.createdByMe}
        nextgen={nextgen}
      />

      {/* Bambini iscritti */}
      <div className={cardFlushCls}>
        <div className="flex items-center justify-between border-b border-[#F0F2F5] px-3.5 py-2.5">
          <span className={titleCls}>Bambini iscritti ({kidsCount})</span>
          {!addingKid && detail.myKids.length > 0 && (
            <button
              onClick={() => setAddingKid(true)}
              disabled={!canSubmit}
              className={`text-xs font-semibold ${accentText} disabled:opacity-60`}
            >
              + Aggiungi
            </button>
          )}
        </div>

        <div className="divide-y divide-[#F0F2F5]">
          {detail.kids.map((k) => (
            <div key={k.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
              <span className="text-lg">{k.kidEmoji}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{k.kidName}</div>
                <div className="text-xs text-ink-2">
                  {k.preferredTagLabel ? `Preferenza: ${k.preferredTagLabel}` : "Nessuna preferenza indicata"}
                  {k.notes ? ` · ${k.notes}` : ""}
                </div>
              </div>
              {k.isOwn && (
                <button
                  onClick={async () => {
                    await removeKidFromGroupAction(detail.id, k.id);
                    router.refresh();
                  }}
                  className="text-ink-3 hover:text-orange"
                  aria-label="Rimuovi"
                >
                  <i className="ti ti-x text-sm" />
                </button>
              )}
            </div>
          ))}
          {detail.kids.length === 0 && (
            <p className="px-3.5 py-4 text-center text-sm text-ink-2">
              Ancora nessun bambino iscritto — aggiungi il tuo per iniziare.
            </p>
          )}
        </div>

        {addingKid && (
          <div className="space-y-2 border-t border-[#F0F2F5] p-3.5">
            <select
              value={effectiveSelectedKid}
              onChange={(e) => {
                const kidId = e.target.value;
                setSelectedKid(kidId);
                const kid = detail.myKids.find((k) => k.id === kidId);
                setSelectedTag(bestTagIdForKid(kid, detail.availableTags));
              }}
              className={`w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none ${accentFocus}`}
            >
              {detail.myKids.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.emoji} {k.name}
                </option>
              ))}
            </select>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className={`w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none ${accentFocus}`}
            >
              <option value="">Nessuna preferenza particolare</option>
              {detail.availableTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.emoji} {t.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-ink-3">
              Pre-selezionata dagli interessi indicati nel profilo del bambino — puoi cambiarla
              solo per questo gruppo.
            </p>
            <input
              value={kidNotes}
              onChange={(e) => setKidNotes(e.target.value)}
              placeholder="Note (facoltativo)"
              className={`w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none ${accentFocus}`}
            />
            {kidError && <p className="text-xs font-medium text-orange">{kidError}</p>}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!effectiveSelectedKid) {
                    setKidError("Scegli un bambino");
                    return;
                  }
                  setSavingKid(true);
                  setKidError(null);
                  const result = await addKidToGroupAction(
                    detail.id,
                    effectiveSelectedKid,
                    selectedTag || null,
                    kidNotes
                  );
                  setSavingKid(false);
                  if (result.error) {
                    setKidError(result.error);
                    return;
                  }
                  setAddingKid(false);
                  setKidNotes("");
                  router.refresh();
                }}
                disabled={savingKid}
                className={`${btnShape} ${accentBg} px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60`}
              >
                {savingKid ? "Aggiungo…" : "Aggiungi bambino"}
              </button>
              <button
                onClick={() => setAddingKid(false)}
                className={btnSecondary}
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>

      {showAdvanced && (
      <>
      {/* Aggregazioni */}
      <div className={cardFlushCls}>
        <div className="flex items-center justify-between border-b border-[#F0F2F5] px-3.5 py-2.5">
          <span className={titleCls}>Aggregazioni proposte</span>
          <button
            onClick={async () => {
              setGenerating(true);
              await generateSubgroupsAction(detail.id);
              setGenerating(false);
              router.refresh();
            }}
            disabled={!canSubmit || generating || kidsCount === 0}
            className={`text-xs font-semibold ${accentText} disabled:opacity-60`}
          >
            {generating ? "Genero…" : "Genera aggregazioni"}
          </button>
        </div>
        <p className="px-3.5 pt-2.5 text-xs text-ink-2">
          Raggruppa i bambini iscritti per preferenza (es. chi vuole Calcio, chi vuole Danza) —
          utile per proporre al centro sotto-gruppi omogenei.
        </p>
        <div className="divide-y divide-[#F0F2F5]">
          {detail.subgroups.map((sg) => (
            <div key={sg.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{sg.label}</div>
                <div className="text-xs text-ink-2">{sg.kidIds.length} bambini</div>
              </div>
              {sg.tagId && (
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    sg.feasible ? "bg-green-light text-[#2d8f52]" : "bg-orange-light text-trama-orange"
                  }`}
                >
                  {sg.feasible ? "Compatibile col campo" : "Non disponibile in questo campo"}
                </span>
              )}
            </div>
          ))}
          {detail.subgroups.length === 0 && (
            <p className="px-3.5 py-4 text-center text-sm text-ink-2">
              Nessuna aggregazione ancora — genera dopo aver aggiunto qualche bambino con
              preferenza.
            </p>
          )}
        </div>
      </div>

      {/* Richiesta Gruppo */}
      <div className={cardCls}>
        <div className={`mb-1 ${titleCls}`}>Richiesta Gruppo al centro</div>
        <p className="mb-2.5 text-xs text-ink-2">
          {uxFix ? "Sconto possibile in base ai bambini iscritti, se il centro lo accetta: " : "Sconto proporzionale al numero di bambini iscritti: "}
          {groupDiscountTiers.map((t) => `${t.minKids}+ → ${t.percent}%`).join(" · ")}.
        </p>
        <div className={`mb-3 flex items-center gap-2 rounded-md ${accentLight} px-3 py-2`}>
          <i className={`ti ti-tag ${accentText}`} />
          <span className="text-sm font-semibold text-ink">
            {uxFix
              ? `Con ${kidsCount} bambin${kidsCount === 1 ? "o" : "i"}: sconto possibile ${previewDiscount}%, da confermare dal centro`
              : `Con ${kidsCount} bambin${kidsCount === 1 ? "o" : "i"}: sconto stimato ${previewDiscount}%`}
          </span>
        </div>

        {detail.request ? (
          <div className="rounded-md border border-[#E8EBF0] bg-bg p-3 text-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold text-ink">Ultima richiesta inviata</span>
              <StatusPill status={detail.request.status} />
            </div>
            <p className="text-xs text-ink-2">
              {detail.request.kidsCount} bambini · sconto richiesto {detail.request.discountPercent}%
            </p>
            {detail.request.message && (
              <p className="mt-1 text-xs italic text-ink-2">&quot;{detail.request.message}&quot;</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              rows={2}
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Un messaggio per il centro (facoltativo)"
              className={`w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none ${accentFocus}`}
            />
            {requestError && <p className="text-xs font-medium text-orange">{requestError}</p>}
            <button
              onClick={async () => {
                setSendingRequest(true);
                setRequestError(null);
                const result = await sendGroupRequestAction(detail.id, requestMessage);
                setSendingRequest(false);
                if (result.error) {
                  setRequestError(result.error);
                  return;
                }
                router.refresh();
              }}
              disabled={!canSubmit || sendingRequest || kidsCount === 0}
              className={`${btnShape} ${accentBg} px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60`}
            >
              {sendingRequest ? "Invio…" : "Invia Richiesta Gruppo"}
            </button>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: "pending" | "accepted" | "rejected" }) {
  const map = {
    pending: { label: "In attesa", cls: "bg-orange-light text-trama-orange" },
    accepted: { label: "Accettata", cls: "bg-green-light text-[#2d8f52]" },
    rejected: { label: "Rifiutata", cls: "bg-[#FBEAEA] text-[#C0392B]" },
  } as const;
  const s = map[status];
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
  );
}

// ─────────────────────────────────────────────
// Tab "Accompagnamento"
// ─────────────────────────────────────────────
function AccompagnamentoTab({ detail, nextgen }: { detail: GroupDetail; nextgen: GroupLook }) {
  const router = useRouter();
  const accentBg = nextgen === "v2" ? "bg-trama-primary" : nextgen ? "bg-trama-violet" : "bg-sky";
  const accentFocus = nextgen ? "focus:border-trama-violet" : "focus:border-sky";
  const accentLight = nextgen === "v2" ? "bg-trama-primary-soft" : nextgen ? "bg-trama-lilac/20" : "bg-sky-light";
  const { titleCls, card: cardCls, cardFlush: cardFlushCls, btnShape, btnSecondary } = groupLook(nextgen);
  const myOffer = detail.carpoolOffers.find((o) => o.isOwn);
  const myRequest = detail.carpoolRequests.find((r) => r.isOwn);

  const [seats, setSeats] = useState(myOffer?.seatsAvailable ?? 3);
  const [hasChildSeat, setHasChildSeat] = useState(myOffer?.hasChildSeat ?? false);
  const [offerLegs, setOfferLegs] = useState<CarpoolLeg>(myOffer?.legs ?? "both");
  const [offerNotes, setOfferNotes] = useState(myOffer?.notes ?? "");
  const [savingOffer, setSavingOffer] = useState(false);

  const [needKids, setNeedKids] = useState(myRequest?.kidsCount ?? 1);
  const [needChildSeat, setNeedChildSeat] = useState(myRequest?.needsChildSeat ?? false);
  const [needLegs, setNeedLegs] = useState<CarpoolLeg>(myRequest?.legs ?? "both");
  const [savingRequest, setSavingRequest] = useState(false);

  const canSubmit = isSupabaseConfigured;
  const matches = myRequest ? buildCarpoolMatches([myRequest], detail.carpoolOffers) : [];
  const myMatches = matches[0]?.offers ?? [];

  return (
    <div className="px-5 pt-4">
      <p className="mb-4 text-xs text-ink-2">
        Se più bambini del gruppo vanno allo stesso campo, organizzatevi per accompagnarli a
        turno. Indica se offri un passaggio o se ne hai bisogno — gli abbinamenti proposti qui
        sotto sono un suggerimento, l&apos;accordo resta tra genitori.
      </p>

      {/* Offerta auto */}
      <div className={cardCls}>
        <div className={`mb-2 ${titleCls}`}>{nextgen === "v2" ? "La tua offerta di passaggio" : "🚙 La tua offerta auto"}</div>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-2">Posti disponibili</label>
            <input
              type="number"
              min={1}
              max={8}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className={`w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none ${accentFocus}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-2">Tratta</label>
            <select
              value={offerLegs}
              onChange={(e) => setOfferLegs(e.target.value as CarpoolLeg)}
              className={`w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none ${accentFocus}`}
            >
              {(Object.keys(LEG_LABELS) as CarpoolLeg[]).map((l) => (
                <option key={l} value={l}>
                  {LEG_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="mb-2 flex items-center gap-2 text-xs text-ink-2">
          <input
            type="checkbox"
            checked={hasChildSeat}
            onChange={(e) => setHasChildSeat(e.target.checked)}
          />
          Ho seggiolini per bambini in auto
        </label>
        <input
          value={offerNotes}
          onChange={(e) => setOfferNotes(e.target.value)}
          placeholder="Note (facoltativo)"
          className={`mb-2.5 w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none ${accentFocus}`}
        />
        <div className="flex gap-2">
          <button
            onClick={async () => {
              setSavingOffer(true);
              await upsertCarpoolOfferAction(detail.id, seats, hasChildSeat, offerLegs, offerNotes);
              setSavingOffer(false);
              router.refresh();
            }}
            disabled={!canSubmit || savingOffer}
            className={`${btnShape} ${accentBg} px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60`}
          >
            {savingOffer ? "Salvo…" : myOffer ? "Aggiorna offerta" : "Proponi un passaggio"}
          </button>
          {myOffer && (
            <button
              onClick={async () => {
                await removeCarpoolOfferAction(detail.id);
                router.refresh();
              }}
              className={btnSecondary}
            >
              Rimuovi
            </button>
          )}
        </div>
      </div>

      {/* Richiesta passaggio */}
      <div className={cardCls}>
        <div className={`mb-2 ${titleCls}`}>{nextgen === "v2" ? "Hai bisogno di un passaggio?" : "🙋 Hai bisogno di un passaggio?"}</div>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-2">Bambini</label>
            <input
              type="number"
              min={1}
              max={4}
              value={needKids}
              onChange={(e) => setNeedKids(Number(e.target.value))}
              className={`w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none ${accentFocus}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-2">Tratta</label>
            <select
              value={needLegs}
              onChange={(e) => setNeedLegs(e.target.value as CarpoolLeg)}
              className={`w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none ${accentFocus}`}
            >
              {(Object.keys(LEG_LABELS) as CarpoolLeg[]).map((l) => (
                <option key={l} value={l}>
                  {LEG_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="mb-2.5 flex items-center gap-2 text-xs text-ink-2">
          <input
            type="checkbox"
            checked={needChildSeat}
            onChange={(e) => setNeedChildSeat(e.target.checked)}
          />
          Serve un seggiolino
        </label>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              setSavingRequest(true);
              await upsertCarpoolRequestAction(detail.id, needKids, needChildSeat, needLegs);
              setSavingRequest(false);
              router.refresh();
            }}
            disabled={!canSubmit || savingRequest}
            className={`${btnShape} ${accentBg} px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60`}
          >
            {savingRequest ? "Salvo…" : myRequest ? "Aggiorna richiesta" : "Richiedi un passaggio"}
          </button>
          {myRequest && (
            <button
              onClick={async () => {
                await removeCarpoolRequestAction(detail.id);
                router.refresh();
              }}
              className={btnSecondary}
            >
              Rimuovi
            </button>
          )}
        </div>
      </div>

      {/* Abbinamenti proposti */}
      {myRequest && (
        <div className={cardFlushCls}>
          <div className={`border-b border-[#F0F2F5] px-3.5 py-2.5 ${titleCls}`}>
            Abbinamenti proposti per te
          </div>
          <div className="divide-y divide-[#F0F2F5]">
            {myMatches.map((o) => (
              <div key={o.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${accentLight} text-sm`}>
                  {nextgen === "v2" ? <i className="ti ti-car text-[16px] text-trama-primary" aria-hidden="true" /> : "🚗"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink">{o.parentLabel}</div>
                  <div className="text-xs text-ink-2">
                    {o.seatsAvailable} posti · {LEG_LABELS[o.legs]}
                    {o.hasChildSeat ? " · seggiolino disponibile" : ""}
                  </div>
                </div>
              </div>
            ))}
            {myMatches.length === 0 && (
              <p className="px-3.5 py-4 text-center text-sm text-ink-2">
                Nessun abbinamento compatibile ancora — riprova quando altri genitori avranno
                proposto un passaggio.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tutte le offerte disponibili nel gruppo */}
      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className={`border-b border-[#F0F2F5] px-3.5 py-2.5 ${titleCls}`}>
          Tutte le offerte nel gruppo
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {detail.carpoolOffers.map((o) => (
            <div key={o.id} className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm">
              <span className="font-semibold text-ink">{o.parentLabel}</span>
              <span className="text-ink-2">
                {o.seatsAvailable} posti · {LEG_LABELS[o.legs]}
                {o.hasChildSeat ? " · seggiolino" : ""}
              </span>
            </div>
          ))}
          {detail.carpoolOffers.length === 0 && (
            <p className="px-3.5 py-4 text-center text-sm text-ink-2">
              Nessuna offerta ancora — sii il primo a proporre un passaggio.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Uscire / eliminare (ritest del 22/10/2026, PARENT_UX_FIX_ENABLED + migration 48)
// ─────────────────────────────────────────────
function LeaveOrDeleteGroup({ detail, backHref }: { detail: GroupDetail; backHref: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCreator = detail.createdByMe;
  const label = isCreator ? "Elimina il gruppo" : "Esci dal gruppo";
  const question = isCreator
    ? "Eliminare il gruppo? Sparisce anche per le altre famiglie, con bambini iscritti e passaggi."
    : "Uscire dal gruppo? I tuoi bambini e i tuoi passaggi vengono tolti. Potrai rientrare solo con un nuovo invito.";

  async function confirm() {
    setBusy(true);
    setError(null);
    const result = isCreator ? await deleteGroupAction(detail.id) : await leaveGroupAction(detail.id);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    // Ritest 22/10: replace, non push — con Indietro non si torna alla pagina di un gruppo che non c'è più.
    router.replace(backHref);
    router.refresh();
  }

  return (
    <section aria-label={label} data-testid="group-leave-delete" className="mx-5 mb-6 mt-2 border-t border-trama-line pt-4">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!isSupabaseConfigured}
          className="flex min-h-[44px] items-center gap-2 text-[14px] font-semibold text-[#B3261E] disabled:opacity-60"
        >
          <i className={`ti ${isCreator ? "ti-trash" : "ti-logout"} text-[17px]`} aria-hidden="true" />
          {label}
        </button>
      ) : (
        <div role="alertdialog" aria-labelledby="group-leave-q" className="rounded-2xl border border-[#F3C9C5] bg-[#FDF3F2] p-4">
          <p id="group-leave-q" className="text-[14px] leading-snug text-ink">
            {question}
          </p>
          {error && (
            <p role="alert" className="mt-2 text-[13px] font-medium text-[#B3261E]">
              {error}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              disabled={busy}
              className="min-h-[44px] flex-1 rounded-[12px] border border-[#D9DDE5] bg-white px-4 text-[14px] font-semibold text-ink"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="min-h-[44px] flex-1 rounded-[12px] bg-[#B3261E] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Un momento…" : isCreator ? "Elimina" : "Esci"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
