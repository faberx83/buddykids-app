"use client";

import { useEffect, useState } from "react";
import { addKidAction } from "@/app/actions/kids";
import { isParentalDeclarationGateEnabledAction } from "@/app/actions/legal";
import { setSchoolContextForKidAction } from "@/app/actions/school-calendar";
import { ITALIAN_REGIONS } from "@/lib/school-calendar/regions";
// TRAMA — SCHOOL CALENDAR UX REFINEMENT §17-28 "GLOBAL CTA PROGRESS
// FEEDBACK" (14/09/2026). No-op fuori da un GlobalActionProgressProvider
// (§29), sicuro anche per l'uso LEGACY di questo form.
import { useGlobalActionProgress } from "@/components/GlobalActionProgress";
import { Kid, KidGender } from "@/lib/types";
import { categories as interestOptions } from "@/lib/mock-data";
import { interestIcon, isKidInterestOption } from "@/lib/nextgen/kid-visual";
import ParentalDeclarationText from "@/components/legal/ParentalDeclarationText";
import { newKidErrorSummary, validateNewKid, type NewKidField } from "@/lib/nextgen/parent-ux-fix";

export default function AddKidForm({
  onAdded,
  onCancel,
  // TRAMA — SCHOOL CALENDAR UX REFINEMENT (§10 "CREATE CHILD — UX",
  // 14/09/2026): sezione "Scuola (opzionale)" visibile SOLO quando
  // SCHOOL_CALENDAR_INTELLIGENCE_ENABLED risolve true per l'utente
  // corrente — già risolto server-side dal chiamante (pagina Profilo,
  // LEGACY e NEXTGEN), stesso principio difensivo del resto della
  // capability (§30: "utente normale: profilo bambino invariato").
  schoolCalendarEnabled = false,
  residenceCity = null,
  v2 = false,
  uxFix = false,
}: {
  onAdded: (kid: Kid) => void;
  onCancel: () => void;
  schoolCalendarEnabled?: boolean;
  residenceCity?: string | null;
  /** 15/10/2026 — stile V2 (Profilo V2 / La tua famiglia): campi alti, interessi con icona, niente emoji. */
  v2?: boolean;
  /** Correzioni dal test UX (21/10/2026, PARENT_UX_FIX_ENABLED), UX-PARENT-015: errori tutti insieme, accanto al campo. */
  uxFix?: boolean;
}) {
  const inputCls = v2
    ? "min-h-[48px] rounded-[12px] border border-trama-line bg-white px-3.5 text-[16px] outline-none focus:border-trama-primary"
    : "rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-sky";
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<KidGender | "">("");
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Correzioni dal test UX (21/10/2026): errori per campo (solo con uxFix).
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<NewKidField, string>>>({});
  // §10: entrambi opzionali rispetto alla creazione — se Regione resta
  // vuota, nessun kid_school_profile viene creato, il salvataggio del
  // bambino prosegue comunque normalmente (mai un blocco).
  const [schoolRegion, setSchoolRegion] = useState("");
  const [schoolComune, setSchoolComune] = useState("");
  const { start: startProgress, complete: completeProgress } = useGlobalActionProgress();

  // PRE-MICRO-PILOT CLOSURE GATE (task #570, 25/08/2026) — visibile SOLO se
  // LEGAL_TERMS_GATE risolve true per l'utente corrente (mai in produzione
  // oggi: default false, nessun override "global" mai scritto). Risolto
  // server-side (questo componente non legge mai feature_flag_overrides
  // direttamente) — vedi app/actions/legal.ts#isParentalDeclarationGateEnabledAction.
  const [declarationRequired, setDeclarationRequired] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  useEffect(() => {
    isParentalDeclarationGateEnabledAction().then(setDeclarationRequired);
  }, []);

  function toggleInterest(value: string) {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value]
    );
  }

  async function handleSave() {
    setError(null);
    if (uxFix) {
      const errors = validateNewKid({
        name,
        birthDate,
        declarationRequired,
        declarationAccepted,
        todayIso: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date()),
      });
      setFieldErrors(Object.fromEntries(errors.map((e) => [e.field, e.message])));
      if (errors.length > 0) {
        setError(newKidErrorSummary(errors));
        document.getElementById(`addkid-${errors[0].field}`)?.focus();
        return;
      }
    }
    if (declarationRequired && !declarationAccepted) {
      setError("Devi confermare la dichiarazione di responsabilità genitoriale");
      return;
    }
    setSaving(true);
    startProgress();
    try {
      const result = await addKidAction(name, birthDate, gender || undefined, interests, declarationAccepted);
      if (result.error || !result.kid) {
        setError(result.error || "Errore nel salvataggio");
        return;
      }
      // §10/§14: la scuola è opzionale e SEPARATA dalla creazione del
      // bambino — se Regione non è stata compilata, nessuna seconda
      // chiamata. Se fallisce (raro: rete/RLS), il bambino resta comunque
      // creato correttamente (§10: "Save child continua normalmente") —
      // non blocchiamo né mostriamo un errore che farebbe sembrare
      // fallita un'operazione in realtà riuscita.
      if (schoolCalendarEnabled && schoolRegion) {
        await setSchoolContextForKidAction(result.kid.id, schoolRegion, schoolComune);
      }
      onAdded(result.kid);
    } finally {
      completeProgress();
      setSaving(false);
    }
  }

  return (
    <div className={v2 ? "rounded-2xl border border-trama-line bg-white p-4" : "rounded-md border-[1.5px] border-[#E3F0FB] bg-sky-light/40 p-3"}>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <input
          id="addkid-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
          aria-invalid={Boolean(fieldErrors.name) || undefined}
          className={`col-span-2 ${inputCls} ${fieldErrors.name ? "border-[#B3261E]" : ""}`}
        />
        {fieldErrors.name && <p className="col-span-2 -mt-1 text-[12.5px] font-medium text-[#B3261E]">{fieldErrors.name}</p>}
        <label className="text-[11px] text-ink-2">
          Data di nascita
          <input
            id="addkid-birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            aria-invalid={Boolean(fieldErrors.birthDate) || undefined}
            className={`mt-1 w-full ${inputCls} ${fieldErrors.birthDate ? "border-[#B3261E]" : ""}`}
          />
          {fieldErrors.birthDate && <span className="mt-1 block text-[12.5px] font-medium text-[#B3261E]">{fieldErrors.birthDate}</span>}
        </label>
        <label className="text-[11px] text-ink-2">
          Genere (opzionale)
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as KidGender | "")}
            className={`mt-1 w-full ${inputCls}`}
          >
            <option value="">Preferisco non dire</option>
            <option value="F">Femmina</option>
            <option value="M">Maschio</option>
            <option value="altro">Altro</option>
          </select>
        </label>
      </div>
      {/* Correzioni dal test UX (21/10/2026): la Home chiede "nome ed età", qui serve la data esatta: diciamo perché. */}
      {uxFix && (
        <p className="-mt-1 mb-2.5 text-[12px] leading-snug text-ink-2">
          Ci serve la data di nascita per sapere l&apos;età giusta ogni anno e proporre attività adatte.
        </p>
      )}

      <div className="mb-2.5">
        <div className="mb-1.5 text-[11px] text-ink-2">
          Interessi (opzionale) — usati per suggerire le attività più adatte in Home
        </div>
        <div className="flex flex-wrap gap-1.5">
          {interestOptions.filter((c) => !v2 || isKidInterestOption(c.id)).map((c) => {
            const value = `${c.emoji} ${c.label}`;
            const active = interests.includes(value);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleInterest(value)}
                className={
                  v2
                    ? `flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold ${
                        active ? "border-trama-primary bg-trama-primary text-white" : "border-[#E3E6EC] bg-white text-ink"
                      }`
                    : `rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        active ? "border-sky bg-sky text-white" : "border-[#E8EBF0] bg-white text-ink-2"
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
      </div>

      {/* PRE-MICRO-PILOT CLOSURE GATE (task #570) — mai visibile in
          produzione oggi (declarationRequired sempre false finché
          Fabrizio non attiva LEGAL_TERMS_GATE per un account di
          test/coorte). Testo segnaposto (CURRENT_PARENTAL_DECLARATION_VERSION
          in lib/legal/consent.ts): non ancora validato legalmente, non da
          mostrare a utenti reali. */}
      {declarationRequired && (
        <label className="mb-2.5 flex items-start gap-2 text-[11px] leading-snug text-ink-2">
          <input
            id="addkid-declaration"
            type="checkbox"
            checked={declarationAccepted}
            onChange={(e) => setDeclarationAccepted(e.target.checked)}
            className="mt-0.5"
            aria-invalid={Boolean(fieldErrors.declaration) || undefined}
            required
          />
          <ParentalDeclarationText kidName={name} />
        </label>
      )}
      {declarationRequired && fieldErrors.declaration && (
        <p className="-mt-1.5 mb-2.5 text-[12.5px] font-medium text-[#B3261E]">{fieldErrors.declaration}</p>
      )}

      {/* TRAMA — SCHOOL CALENDAR UX REFINEMENT (§10, 14/09/2026): sezione
          "Scuola (opzionale)" verso la fine del form esistente — NESSUN
          nuovo step wizard, NESSUN click aggiuntivo obbligatorio
          nell'onboarding (§10: "NON aumentare obbligatoriamente il numero
          di click"). Visibile solo per chi vede la capability
          (schoolCalendarEnabled). */}
      {schoolCalendarEnabled && (
        <div className="mb-2.5 mt-1 border-t border-[#E8EBF0] pt-2.5">
          {uxFix && v2 ? (
            <>
              {/* Ritest 22/10/2026: stessa forma e stesse parole della scheda figlio V2. */}
              <div className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-ink">
                <i className="ti ti-school text-[18px] text-trama-navy" aria-hidden="true" />
                Calendario della scuola <span className="text-[13px] font-normal text-ink-2">(facoltativo)</span>
              </div>
              <p className="mb-2.5 text-[13px] leading-snug text-ink-2">
                Per ponti e vacanze bastano Regione e Comune della scuola. Nome e orari li puoi aggiungere dopo, nella scheda del figlio.
              </p>
            </>
          ) : (
            <>
              <div className="mb-1.5 flex items-center gap-1.5">
                <i className="ti ti-school text-[15px] text-trama-violet" />
                <span className="font-poppins text-[13px] font-semibold text-ink">Scuola</span>
                <span className="text-[11px] text-ink-3">(opzionale)</span>
              </div>
              <p className="mb-2 text-[11px] text-ink-2">Ci serve solo per individuare vacanze e giorni senza scuola.</p>
            </>
          )}
          <div className="mb-1.5 grid grid-cols-2 gap-2">
            <select
              value={schoolRegion}
              onChange={(e) => setSchoolRegion(e.target.value)}
              className={v2 ? "min-h-[48px] rounded-[12px] border border-trama-line bg-white px-3 text-[16px] outline-none focus:border-trama-primary" : "h-11 rounded-md border border-[#E8EBF0] bg-white px-3 text-sm outline-none focus:border-sky"}
            >
              <option value="">Regione…</option>
              {ITALIAN_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              value={schoolComune}
              onChange={(e) => setSchoolComune(e.target.value)}
              placeholder="Comune della scuola"
              className={v2 ? "min-h-[48px] rounded-[12px] border border-trama-line bg-white px-3 text-[16px] outline-none focus:border-trama-primary" : "h-11 rounded-md border border-[#E8EBF0] bg-white px-3 text-sm outline-none focus:border-sky"}
            />
          </div>
          {residenceCity && (
            <button
              type="button"
              onClick={() => setSchoolComune(residenceCity)}
              className={uxFix && v2 ? "flex min-h-[40px] items-center text-[13.5px] font-semibold text-trama-accent-ink" : "text-[11px] font-semibold text-trama-violet"}
            >
              {uxFix && v2 ? `Usa il mio Comune (${residenceCity})` : "Usa il mio Comune"}
            </button>
          )}
        </div>
      )}

      {error && (
        <p role={uxFix ? "alert" : undefined} className={uxFix ? "mb-2 text-[13px] font-medium text-[#B3261E]" : "mb-2 text-xs font-medium text-orange"}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={
            v2
              ? "min-h-[48px] rounded-[12px] bg-trama-primary px-5 text-[15px] font-semibold text-white active:bg-trama-primary-press disabled:opacity-60"
              : "rounded-md bg-sky px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          }
        >
          {saving ? "Salvo…" : "Salva bambino"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={
            v2
              ? "min-h-[48px] rounded-[12px] border border-trama-line bg-white px-5 text-[15px] font-semibold text-ink"
              : "rounded-md border border-[#E8EBF0] px-4 py-2 text-xs font-semibold text-ink"
          }
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
