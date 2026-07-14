"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GroupDetail, CarpoolLeg } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { discountForGroupSize, GROUP_DISCOUNT_TIERS } from "@/lib/groups";
import { buildCarpoolMatches } from "@/lib/carpool";
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
}: {
  groupId: string;
  groupName: string;
  activityName: string | null;
  centerName: string | null;
  inviterName: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/groups/join/${groupId}`;
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
      className="ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-md bg-white/80 px-3 py-2 text-xs font-bold text-ink"
    >
      <i className={`ti ${copied ? "ti-check" : "ti-user-plus"} text-sm`} />
      {copied ? "Messaggio copiato!" : "Invita famiglie"}
    </button>
  );
}

export default function GroupDetailClient({
  detail,
  activityOptions,
  inviterName,
}: {
  detail: GroupDetail;
  activityOptions: { dbId: string; name: string; center: string }[];
  inviterName: string;
}) {
  const [tab, setTab] = useState<"gruppo" | "accompagnamento">("gruppo");

  return (
    <div className="animate-fade-in pb-6">
      <div
        className="px-5 pb-4 pt-3.5"
        style={{ background: detail.gradient }}
      >
        <Link href="/groups" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-ink-2">
          <i className="ti ti-arrow-left" /> Gruppi
        </Link>
        <div className="flex items-center gap-2.5">
          <span className="text-3xl">{detail.emoji}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-ink">{detail.name}</h1>
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
        <GruppoTab detail={detail} activityOptions={activityOptions} />
      ) : (
        <AccompagnamentoTab detail={detail} />
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
}: {
  detail: GroupDetail;
  activityOptions: { dbId: string; name: string; center: string }[];
}) {
  const router = useRouter();
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

  return (
    <div className="px-5 pt-4">
      {/* Attività target */}
      {!detail.activityId && detail.createdByMe && (
        <div className="mb-4 rounded-lg border border-[#E8EBF0] bg-white p-3.5">
          <div className="mb-2 text-sm font-bold text-ink">Collega un&apos;attività</div>
          <p className="mb-2.5 text-xs text-ink-2">
            Serve per proporre le aggregazioni e per inviare la Richiesta Gruppo al centro giusto.
          </p>
          {!pickingActivity ? (
            <button
              onClick={() => setPickingActivity(true)}
              disabled={!canSubmit}
              className="rounded-md bg-sky px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              Scegli attività
            </button>
          ) : (
            <div className="space-y-2">
              <select
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
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
                className="rounded-md bg-sky px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {savingActivity ? "Salvo…" : "Conferma"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bambini iscritti */}
      <div className="mb-4 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="flex items-center justify-between border-b border-[#F0F2F5] px-3.5 py-2.5">
          <span className="text-sm font-bold text-ink">Bambini iscritti ({kidsCount})</span>
          {!addingKid && detail.myKids.length > 0 && (
            <button
              onClick={() => setAddingKid(true)}
              disabled={!canSubmit}
              className="text-xs font-semibold text-sky disabled:opacity-60"
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
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
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
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
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
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
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
                className="rounded-md bg-sky px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {savingKid ? "Aggiungo…" : "Aggiungi bambino"}
              </button>
              <button
                onClick={() => setAddingKid(false)}
                className="rounded-md border border-[#E8EBF0] px-3.5 py-2 text-xs font-semibold text-ink"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Aggregazioni */}
      <div className="mb-4 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="flex items-center justify-between border-b border-[#F0F2F5] px-3.5 py-2.5">
          <span className="text-sm font-bold text-ink">Aggregazioni proposte</span>
          <button
            onClick={async () => {
              setGenerating(true);
              await generateSubgroupsAction(detail.id);
              setGenerating(false);
              router.refresh();
            }}
            disabled={!canSubmit || generating || kidsCount === 0}
            className="text-xs font-semibold text-sky disabled:opacity-60"
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
      <div className="mb-4 rounded-lg border border-[#E8EBF0] bg-white p-3.5">
        <div className="mb-1 text-sm font-bold text-ink">Richiesta Gruppo al centro</div>
        <p className="mb-2.5 text-xs text-ink-2">
          Sconto proporzionale al numero di bambini iscritti:{" "}
          {groupDiscountTiers.map((t) => `${t.minKids}+ → ${t.percent}%`).join(" · ")}.
        </p>
        <div className="mb-3 flex items-center gap-2 rounded-md bg-sky-light px-3 py-2">
          <i className="ti ti-tag text-sky" />
          <span className="text-sm font-semibold text-ink">
            Con {kidsCount} bambin{kidsCount === 1 ? "o" : "i"}: sconto stimato {previewDiscount}%
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
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
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
              className="rounded-md bg-sky px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {sendingRequest ? "Invio…" : "Invia Richiesta Gruppo"}
            </button>
          </div>
        )}
      </div>
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
function AccompagnamentoTab({ detail }: { detail: GroupDetail }) {
  const router = useRouter();
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
      <div className="mb-4 rounded-lg border border-[#E8EBF0] bg-white p-3.5">
        <div className="mb-2 text-sm font-bold text-ink">🚙 La tua offerta auto</div>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-2">Posti disponibili</label>
            <input
              type="number"
              min={1}
              max={8}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-2">Tratta</label>
            <select
              value={offerLegs}
              onChange={(e) => setOfferLegs(e.target.value as CarpoolLeg)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
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
          className="mb-2.5 w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
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
            className="rounded-md bg-sky px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {savingOffer ? "Salvo…" : myOffer ? "Aggiorna offerta" : "Proponi un passaggio"}
          </button>
          {myOffer && (
            <button
              onClick={async () => {
                await removeCarpoolOfferAction(detail.id);
                router.refresh();
              }}
              className="rounded-md border border-[#E8EBF0] px-3.5 py-2 text-xs font-semibold text-ink"
            >
              Rimuovi
            </button>
          )}
        </div>
      </div>

      {/* Richiesta passaggio */}
      <div className="mb-4 rounded-lg border border-[#E8EBF0] bg-white p-3.5">
        <div className="mb-2 text-sm font-bold text-ink">🙋 Hai bisogno di un passaggio?</div>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-2">Bambini</label>
            <input
              type="number"
              min={1}
              max={4}
              value={needKids}
              onChange={(e) => setNeedKids(Number(e.target.value))}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-2">Tratta</label>
            <select
              value={needLegs}
              onChange={(e) => setNeedLegs(e.target.value as CarpoolLeg)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
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
            className="rounded-md bg-sky px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {savingRequest ? "Salvo…" : myRequest ? "Aggiorna richiesta" : "Richiedi un passaggio"}
          </button>
          {myRequest && (
            <button
              onClick={async () => {
                await removeCarpoolRequestAction(detail.id);
                router.refresh();
              }}
              className="rounded-md border border-[#E8EBF0] px-3.5 py-2 text-xs font-semibold text-ink"
            >
              Rimuovi
            </button>
          )}
        </div>
      </div>

      {/* Abbinamenti proposti */}
      {myRequest && (
        <div className="mb-4 rounded-lg border border-[#E8EBF0] bg-white">
          <div className="border-b border-[#F0F2F5] px-3.5 py-2.5 text-sm font-bold text-ink">
            Abbinamenti proposti per te
          </div>
          <div className="divide-y divide-[#F0F2F5]">
            {myMatches.map((o) => (
              <div key={o.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-light text-sm">
                  🚗
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
        <div className="border-b border-[#F0F2F5] px-3.5 py-2.5 text-sm font-bold text-ink">
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
