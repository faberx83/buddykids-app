"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AddKidForm from "@/components/AddKidForm";
import AvatarUploadButton from "@/components/AvatarUploadButton";
import { Kid, KidGender } from "@/lib/types";
import { categories as interestOptions } from "@/lib/mock-data";
import { updateKidInterestsAction, updateKidAvatarAction, updateKidAction } from "@/app/actions/kids";
import { setSchoolContextForKidAction } from "@/app/actions/school-calendar";
import { ITALIAN_REGIONS } from "@/lib/school-calendar/regions";
import type { KidSchoolProfileSummary } from "@/lib/data/school-calendar";
import KidSchoolBlock from "@/components/nextgen/KidSchoolBlock";
import type { SchoolHoursItem } from "@/components/nextgen/SchoolHoursBlock";
import { siblingSchools } from "@/lib/nextgen/parent-ux-fix";
import { isSupabaseConfigured } from "@/lib/supabase/env";
// TRAMA — SCHOOL CALENDAR UX REFINEMENT §17-28 "GLOBAL CTA PROGRESS
// FEEDBACK" (14/09/2026). Sicuro da chiamare anche quando questo
// componente è montato sotto LEGACY (app/(main)/profile/page.tsx, dove
// GlobalActionProgressProvider non è ancora montato, §29): start/complete
// diventano no-op senza errore, vedi GlobalActionProgress.tsx.
import { useGlobalActionProgress } from "@/components/GlobalActionProgress";
import { KID_TONES } from "@/components/nextgen/AgendaItemRow";
import { interestIcon, interestLabel, isKidInterestOption, kidInitial } from "@/lib/nextgen/kid-visual";

// Duplicata volutamente da lib/data/kids.ts#ageFromBirthDate (stesso
// principio già usato per KIDS_AVATARS_BUCKET in app/actions/kids.ts):
// lib/data/kids.ts importa lib/supabase/server (next/headers), un
// componente "use client" non può attraversare quel confine — vedi anche
// lib/nextgen/responsibility-options.ts per lo stesso motivo.
function ageFromBirthDate(birthDate: string): number {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate + "T00:00:00Z");
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return Math.max(age, 0);
}

export default function ProfileKidsSection({
  initialKids,
  autoOpenAddKid,
  accent = "sky",
  // TRAMA — SCHOOL CALENDAR UX REFINEMENT (§10-11, 14/09/2026): entrambi già
  // risolti server-side dal chiamante (pagina Profilo, LEGACY e NEXTGEN) —
  // stesso principio difensivo del resto della capability, questo
  // componente non fa alcuna verifica flag propria. schoolProfiles arriva
  // vuoto {} quando la capability è disattivata o Supabase non è
  // configurato — mai un errore, solo "nessun figlio ha ancora la scuola
  // impostata".
  schoolCalendarEnabled = false,
  schoolProfiles = {},
  residenceCity = null,
  v2 = false,
  autoOpenSchoolKidId = null,
  uxFix = false,
  schoolItems = null,
  placeSearchEnabled = false,
  todayIso = "",
}: {
  initialKids: Kid[];
  autoOpenAddKid?: boolean;
  // SPRINT 6 (NEXTGEN) — stesso opt-in di ProfileHeaderClient.tsx: viola
  // trama-violet per il Profilo NEXTGEN, default "sky" invariato per LEGACY.
  accent?: "sky" | "violet";
  schoolCalendarEnabled?: boolean;
  schoolProfiles?: Record<string, KidSchoolProfileSummary>;
  residenceCity?: string | null;
  /** PROFILO V2 (14/10/2026): titolo e card nello stile V2. Default: invariato. */
  v2?: boolean;
  /** Correzioni dal test UX (21/10/2026), UX-PARENT-004/006: da "Imposta per
   *  Giulia" (Home, Planner) si arriva con la scheda di quel figlio aperta
   *  sulla scuola (?scuola=<id>). null = come prima. */
  autoOpenSchoolKidId?: string | null;
  /** Correzioni dal test UX (21/10/2026, PARENT_UX_FIX_ENABLED), UX-PARENT-013/015:
   *  ogni "Salva" dice cosa salva e conferma sul posto; il form del nuovo
   *  figlio mostra tutti gli errori insieme. false = come prima. */
  uxFix?: boolean;
  /** Ritest 22/10/2026 — una sola "Scuola" per figlio (KidSchoolBlock): orari
   *  della scuola della settimana tipo. null = settimana tipo spenta (solo
   *  Regione e Comune). */
  schoolItems?: SchoolHoursItem[] | null;
  placeSearchEnabled?: boolean;
  todayIso?: string;
}) {
  const router = useRouter();
  const { start: startProgress, complete: completeProgress } = useGlobalActionProgress();
  // POLISH V2 (14/10/2026): in V2 le azioni sono navy, il viola resta accento.
  const accentText = v2 ? "text-trama-accent-ink" : accent === "violet" ? "text-trama-violet" : "text-sky";
  const accentActive = v2
    ? "border-trama-primary bg-trama-primary text-white"
    : accent === "violet"
      ? "border-trama-violet bg-trama-violet text-white"
      : "border-sky bg-sky text-white";
  const accentBg = v2 ? "bg-trama-primary" : accent === "violet" ? "bg-trama-violet" : "bg-sky";
  // Ritest 22/10/2026: la sezione scuola nello stile V2 (solo con il flag delle correzioni UX).
  const schoolV2 = v2 && uxFix;
  const schoolItemFor = (kidId: string) => (schoolItems ?? []).find((i) => i.kidIds.includes(kidId)) ?? null;
  // 15/10/2026 — figli nello stile V2: campi alti, pulsanti a raggio 12.
  const inputCls = v2
    ? "min-h-[48px] rounded-[12px] border border-trama-line bg-white px-3.5 text-[16px] outline-none focus:border-trama-primary"
    : "rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-sky";
  const saveBtn = v2
    ? "min-h-[44px] rounded-[12px] px-4 text-[14px] font-semibold"
    : "rounded-md px-4 py-2 text-xs font-bold";
  const [kids, setKids] = useState<Kid[]>(initialKids);
  const [showAddKid, setShowAddKid] = useState(Boolean(autoOpenAddKid));
  const autoOpenKid = autoOpenSchoolKidId ? initialKids.find((k) => k.id === autoOpenSchoolKidId) ?? null : null;
  const [editingKidId, setEditingKidId] = useState<string | null>(autoOpenKid?.id ?? null);
  const [savingInterests, setSavingInterests] = useState(false);
  // Correzioni dal test UX (21/10/2026): conferma sul posto ("Salvato") per ogni blocco.
  const [savedBlock, setSavedBlock] = useState<{ kidId: string; block: "dati" | "interessi" | "scuola" } | null>(null);
  // §11 "EDIT CHILD PROFILE" — editing della sezione "Scuola e calendario",
  // indipendente dal pannello nome/data/genere/interessi sopra (stato
  // separato, cosi' aprire/chiudere l'uno non tocca l'altro).
  const [editingSchoolKidId, setEditingSchoolKidId] = useState<string | null>(
    autoOpenKid && schoolCalendarEnabled ? autoOpenKid.id : null
  );
  const [schoolRegionDraft, setSchoolRegionDraft] = useState(autoOpenKid ? (schoolProfiles[autoOpenKid.id]?.region ?? "") : "");
  const [schoolComuneDraft, setSchoolComuneDraft] = useState(autoOpenKid ? (schoolProfiles[autoOpenKid.id]?.comune ?? "") : "");
  useEffect(() => {
    if (!autoOpenKid) return;
    document.getElementById(`kid-school-${autoOpenKid.id}`)?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una volta, all'apertura
  }, []);
  const [savingSchool, setSavingSchool] = useState(false);
  const [schoolError, setSchoolError] = useState<string | null>(null);

  function startEditingSchool(kidId: string, current?: KidSchoolProfileSummary) {
    if (editingSchoolKidId === kidId) {
      setEditingSchoolKidId(null);
      return;
    }
    setEditingSchoolKidId(kidId);
    setSchoolRegionDraft(current?.region ?? "");
    setSchoolComuneDraft(current?.comune ?? "");
    setSchoolError(null);
  }

  async function saveSchool(kidId: string) {
    if (!schoolRegionDraft) {
      setSchoolError("Seleziona una regione");
      return;
    }
    setSavingSchool(true);
    setSchoolError(null);
    // TRAMA — GLOBAL ACTION PROGRESS · LIVE FIX (15/09/2026, §7 "SERVER
    // ACTIONS": "verifica che complete() avvenga in finally, non solo sul
    // path di successo"). Era completeProgress() in linea retta dopo
    // l'await: se setSchoolContextForKidAction lancia (rete/errore
    // inatteso, non il return { error } gestito sotto), completeProgress()
    // non veniva mai chiamato — pendingCount restava incrementato per
    // sempre, barra bloccata visibile senza alcun timeout di sicurezza (a
    // differenza della navigazione, questo percorso non ne ha uno). Fix:
    // start() prima della Promise, complete() in un finally che copre
    // anche il path d'eccezione.
    startProgress();
    let result: Awaited<ReturnType<typeof setSchoolContextForKidAction>>;
    try {
      result = await setSchoolContextForKidAction(kidId, schoolRegionDraft, schoolComuneDraft);
    } finally {
      completeProgress();
      setSavingSchool(false);
    }
    if (result.error) {
      setSchoolError(result.error);
      return;
    }
    setEditingSchoolKidId(null);
    if (uxFix) setSavedBlock({ kidId, block: "scuola" });
    // §14: la modifica di Regione ri-valuta l'associazione con il
    // calendario disponibile — schoolProfiles arriva da un Server
    // Component (pagina Profilo), quindi un refresh (non un redirect)
    // rilegge kid_school_profiles/school_calendars aggiornati, stesso
    // pattern già usato dal Planner per "Non mi serve"/toggleDismissed.
    router.refresh();
  }
  // FEATURE (01/09/2026, richiesta di Fabrizio: "deve essere possibile
  // modificare caratteristiche figlio, tra cui età perché magari c'è un
  // errore") — bozza locale nome/data di nascita/genere per il bambino in
  // modifica, inizializzata quando si apre il pannello (vedi startEditing).
  const [editName, setEditName] = useState(autoOpenKid?.name ?? "");
  const [editBirthDate, setEditBirthDate] = useState(autoOpenKid?.birthDate ?? "");
  const [editGender, setEditGender] = useState<KidGender | "">(autoOpenKid?.gender ?? "");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  function startEditing(kid: Kid) {
    if (editingKidId === kid.id) {
      setEditingKidId(null);
      return;
    }
    setEditingKidId(kid.id);
    setEditName(kid.name);
    setEditBirthDate(kid.birthDate ?? "");
    setEditGender(kid.gender ?? "");
    setDetailsError(null);
  }

  async function saveDetails(kidId: string) {
    setDetailsError(null);
    if (!editName.trim()) {
      setDetailsError("Inserisci un nome");
      return;
    }
    if (!editBirthDate) {
      setDetailsError("Inserisci la data di nascita");
      return;
    }
    setSavingDetails(true);
    const result = isSupabaseConfigured
      ? await updateKidAction(kidId, editName, editBirthDate, editGender || undefined)
      : {};
    setSavingDetails(false);
    if (result.error) {
      setDetailsError(result.error);
      return;
    }
    if (uxFix) setSavedBlock({ kidId, block: "dati" });
    setKids((prev) =>
      prev.map((k) =>
        k.id === kidId
          ? {
              ...k,
              name: editName.trim(),
              birthDate: editBirthDate,
              age: ageFromBirthDate(editBirthDate),
              gender: editGender || undefined,
            }
          : k
      )
    );
  }

  async function handleAvatarUploaded(kidId: string, url: string) {
    setKids((prev) => prev.map((k) => (k.id === kidId ? { ...k, avatarUrl: url } : k)));
    if (isSupabaseConfigured) {
      await updateKidAvatarAction(kidId, url);
    }
  }

  function toggleInterestFor(kidId: string, value: string) {
    setKids((prev) =>
      prev.map((k) =>
        k.id === kidId
          ? {
              ...k,
              interests: (k.interests ?? []).includes(value)
                ? (k.interests ?? []).filter((i) => i !== value)
                : [...(k.interests ?? []), value],
            }
          : k
      )
    );
  }

  async function saveInterests(kidId: string) {
    const kid = kids.find((k) => k.id === kidId);
    if (!kid) return;
    setSavingInterests(true);
    if (isSupabaseConfigured) {
      await updateKidInterestsAction(kidId, kid.interests ?? []);
    }
    setSavingInterests(false);
    // Correzioni dal test UX (21/10/2026): con uxFix la scheda resta aperta
    // (sotto c'è la scuola) e il salvataggio si conferma sul posto.
    if (uxFix) setSavedBlock({ kidId, block: "interessi" });
    else setEditingKidId(null);
  }

  return (
    <div className={v2 ? "" : "px-5 pt-4"}>
      <div className={v2 ? "mb-2.5 flex items-center justify-between" : "mb-3 flex items-center justify-between"}>
        <span className={v2 ? "font-poppins text-[18px] font-semibold text-ink" : "text-[15px] font-bold text-ink"}>
          {v2 ? "I tuoi figli" : "I miei bambini"}
        </span>
        {!showAddKid && (
          <span
            onClick={() => setShowAddKid(true)}
            className={v2 ? "flex min-h-[40px] cursor-pointer items-center text-[14px] font-semibold text-trama-accent-ink" : `cursor-pointer text-[13px] font-medium ${accentText}`}
          >
            + Aggiungi
          </span>
        )}
      </div>

      {kids.length === 0 && !showAddKid && (
        <p className="mb-2.5 text-xs text-ink-2">
          Non hai ancora aggiunto nessun bambino.
        </p>
      )}

      {kids.map((k) => (
        <div
          key={k.id}
          className={
            v2
              ? "mb-2.5 rounded-2xl border border-trama-line bg-white p-4"
              : "mb-2.5 rounded-lg border border-[#F0F2F5] bg-white p-3.5 transition-all hover:shadow-md"
          }
        >
          <div className="flex items-center gap-3">
            <div onClick={(e) => e.stopPropagation()}>
              <AvatarUploadButton
                folder="kids"
                currentUrl={k.avatarUrl}
                onUploaded={(url) => handleAvatarUploaded(k.id, url)}
                size={50}
                badgeClassName={v2 ? "bg-trama-primary" : undefined}
                fallback={
                  v2 ? (
                    // Niente faccina: iniziale sulla tinta del figlio (come in Home e Planner).
                    <div
                      className={`flex h-full w-full items-center justify-center font-poppins text-[20px] font-semibold ${
                        KID_TONES[kids.indexOf(k) % KID_TONES.length].bg
                      } ${KID_TONES[kids.indexOf(k) % KID_TONES.length].text}`}
                    >
                      {kidInitial(k.name)}
                    </div>
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-2xl"
                      style={{ background: k.color }}
                    >
                      {k.emoji}
                    </div>
                  )
                }
              />
            </div>
            <div onClick={() => startEditing(k)} className="flex flex-1 cursor-pointer items-center gap-3">
            <div className="flex-1">
              <div className={v2 ? "text-[16px] font-semibold text-ink" : "text-sm font-bold text-ink"}>{k.name}</div>
              <div className={v2 ? "mb-1 text-[13px] text-ink-2" : "mb-1 text-xs text-ink-2"}>
                {k.age} anni{k.grade ? ` · ${k.grade}` : ""}
              </div>
              {k.interests && k.interests.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {k.interests.map((int) => (
                    <span
                      key={int}
                      className={v2 ? "flex items-center gap-1 rounded-full bg-[#F1F3F6] px-2.5 py-[3px] text-[12px] font-semibold text-[#374151]" : "rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium text-ink-2"}
                    >
                      {v2 ? (
                        <>
                          <i className={`ti ${interestIcon(int)} text-[14px]`} aria-hidden="true" />
                          {interestLabel(int)}
                        </>
                      ) : (
                        int
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <span className={`text-[11px] font-medium ${accentText}`}>+ Aggiungi interessi</span>
              )}
            </div>
            <i className={`ti ${editingKidId === k.id ? "ti-chevron-up" : "ti-chevron-down"} text-lg text-ink-3`} />
            </div>
          </div>

          {editingKidId === k.id && (
            <div className="mt-3 border-t border-[#F0F2F5] pt-3">
              {/* FEATURE (01/09/2026, richiesta di Fabrizio: "deve essere
                  possibile modificare caratteristiche figlio, tra cui età
                  perché magari c'è un errore") — stessi campi di
                  AddKidForm.tsx, ora modificabili anche dopo la creazione. */}
              <div className="mb-2.5 grid grid-cols-2 gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome"
                  className={`col-span-2 ${inputCls}`}
                />
                <label className="text-[11px] text-ink-2">
                  Data di nascita
                  <input
                    type="date"
                    value={editBirthDate}
                    onChange={(e) => setEditBirthDate(e.target.value)}
                    className={`mt-1 w-full ${inputCls}`}
                  />
                </label>
                <label className="text-[11px] text-ink-2">
                  Genere (opzionale)
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as KidGender | "")}
                    className={`mt-1 w-full ${inputCls}`}
                  >
                    <option value="">Preferisco non dire</option>
                    <option value="F">Femmina</option>
                    <option value="M">Maschio</option>
                    <option value="altro">Altro</option>
                  </select>
                </label>
              </div>
              {detailsError && <p className="mb-2 text-xs font-medium text-orange">{detailsError}</p>}
              <button
                type="button"
                onClick={() => saveDetails(k.id)}
                disabled={savingDetails}
                className={`mb-3 ${saveBtn} ${accentBg} text-white disabled:opacity-60`}
              >
                {savingDetails ? "Salvo…" : uxFix ? "Salva nome e data" : "Salva dati"}
              </button>
              {uxFix && savedBlock?.kidId === k.id && savedBlock.block === "dati" && <SavedTick text="Nome e data salvati" />}

              <div className="mb-1.5 text-[11px] text-ink-2">
                Interessi — usati per suggerire le attività più adatte in Home
              </div>
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {interestOptions.filter((c) => !v2 || isKidInterestOption(c.id)).map((c) => {
                  const value = `${c.emoji} ${c.label}`;
                  const active = (k.interests ?? []).includes(value);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleInterestFor(k.id, value)}
                      className={
                        v2
                          ? `flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold ${
                              active ? "border-trama-primary bg-trama-primary text-white" : "border-[#E3E6EC] bg-white text-ink"
                            }`
                          : `rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              active ? accentActive : "border-[#E8EBF0] bg-white text-ink-2"
                            }`
                      }
                    >
                      {v2 ? (
                        <>
                          <i className={`ti ${interestIcon(c.label)} text-[16px]`} aria-hidden="true" />
                          {c.label}
                        </>
                      ) : (
                        <>
                          {c.emoji} {c.label}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => saveInterests(k.id)}
                disabled={savingInterests}
                className={`${saveBtn} ${accentBg} text-white disabled:opacity-60`}
              >
                {savingInterests ? "Salvo…" : uxFix ? "Salva interessi" : "Salva"}
              </button>
              {uxFix && savedBlock?.kidId === k.id && savedBlock.block === "interessi" && <SavedTick text="Interessi salvati" />}

              {/* TRAMA — SCHOOL CALENDAR UX REFINEMENT (§11 "EDIT CHILD
                  PROFILE", 14/09/2026): sezione persistente "Scuola e
                  calendario" — mostra Regione · Comune se già configurata
                  (source of truth: kid_school_profiles, mai duplicata su
                  kids) + disponibilità REALE del calendario per l'anno
                  scolastico corrente (mai inventata, §11). */}
              {schoolCalendarEnabled && schoolV2 && (
                <KidSchoolBlock
                  kid={{ id: k.id, name: k.name }}
                  profile={schoolProfiles[k.id]}
                  schoolItem={schoolItemFor(k.id)}
                  siblings={siblingSchools(
                    k.id,
                    kids.map((x) => ({ id: x.id, name: x.name })),
                    schoolProfiles,
                    Object.fromEntries(kids.map((x) => [x.id, schoolItemFor(x.id)?.title ?? null]))
                  )}
                  siblingItems={Object.fromEntries(kids.map((x) => [x.id, schoolItemFor(x.id)]))}
                  routineEnabled={schoolItems !== null}
                  placeSearchEnabled={placeSearchEnabled}
                  residenceCity={residenceCity}
                  todayIso={todayIso}
                  initialEditing={autoOpenKid?.id === k.id}
                  inputCls={inputCls}
                />
              )}
              {schoolCalendarEnabled && !schoolV2 && (
                <div id={`kid-school-${k.id}`} className="mt-3 border-t border-[#F0F2F5] pt-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <i className="ti ti-school text-[13px] text-trama-violet" />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Scuola e calendario</span>
                  </div>
                  {editingSchoolKidId === k.id ? (
                    <div className="flex flex-col gap-2">
                      <select
                        value={schoolRegionDraft}
                        onChange={(e) => setSchoolRegionDraft(e.target.value)}
                        className="h-10 rounded-md border border-[#E8EBF0] bg-white px-2.5 text-[13px] text-ink"
                      >
                        <option value="">Regione…</option>
                        {ITALIAN_REGIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-1.5">
                        <input
                          value={schoolComuneDraft}
                          onChange={(e) => setSchoolComuneDraft(e.target.value)}
                          placeholder="Comune della scuola"
                          className="h-10 min-w-0 flex-1 rounded-md border border-[#E8EBF0] bg-white px-2.5 text-[13px] text-ink"
                        />
                        {residenceCity && (
                          <button
                            type="button"
                            onClick={() => setSchoolComuneDraft(residenceCity)}
                            className="whitespace-nowrap rounded-md border border-[#E8EBF0] px-2 text-[11px] font-semibold text-trama-violet"
                          >
                            Usa il mio Comune
                          </button>
                        )}
                      </div>
                      {schoolError && <p className="text-[11px] text-[#C0392B]">{schoolError}</p>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveSchool(k.id)}
                          disabled={savingSchool}
                          className="rounded-md bg-trama-violet px-3.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
                        >
                          {savingSchool ? "Salvo…" : uxFix ? "Salva scuola" : "Salva"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSchoolKidId(null)}
                          disabled={savingSchool}
                          className="rounded-md border border-[#E8EBF0] px-3 text-[11px] font-semibold text-ink-2"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : schoolProfiles[k.id] ? (
                    <>
                    {uxFix && savedBlock?.kidId === k.id && savedBlock.block === "scuola" && <SavedTick text="Scuola salvata" />}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-ink">
                          {schoolProfiles[k.id].region}
                          {schoolProfiles[k.id].comune ? ` · ${schoolProfiles[k.id].comune}` : ""}
                        </p>
                        <p className="text-[11px] text-ink-3">
                          {schoolProfiles[k.id].calendarAvailable
                            ? `Calendario ${schoolProfiles[k.id].academicYearShort} disponibile`
                            : "Calendario non ancora disponibile"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEditingSchool(k.id, schoolProfiles[k.id])}
                        className="flex-shrink-0 text-[11.5px] font-semibold text-trama-violet"
                      >
                        Modifica
                      </button>
                    </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11.5px] text-ink-3">Calendario scolastico non impostato</p>
                      <button
                        type="button"
                        onClick={() => startEditingSchool(k.id)}
                        className="flex-shrink-0 text-[11.5px] font-semibold text-trama-violet"
                      >
                        Imposta
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {showAddKid && (
        <AddKidForm
          onAdded={(kid) => {
            setKids((prev) => [...prev, kid]);
            setShowAddKid(false);
            // La sezione "Scuola e calendario" (schoolProfiles) arriva da
            // un Server Component: se il genitore ha appena compilato
            // Regione/Comune per il nuovo bambino, un refresh la mostra
            // subito qui sotto invece di lasciare "non impostato" finché
            // non si ricarica la pagina a mano.
            if (schoolCalendarEnabled) router.refresh();
          }}
          onCancel={() => setShowAddKid(false)}
          schoolCalendarEnabled={schoolCalendarEnabled}
          residenceCity={residenceCity}
          v2={v2}
          uxFix={uxFix}
        />
      )}
    </div>
  );
}

// Correzioni dal test UX (21/10/2026), UX-PARENT-013: conferma sul posto.
function SavedTick({ text }: { text: string }) {
  return (
    <p role="status" className="mb-3 -mt-1.5 flex items-center gap-1 text-[12.5px] font-semibold text-[#146B4F]">
      <i className="ti ti-check text-[14px]" aria-hidden="true" />
      {text}
    </p>
  );
}
