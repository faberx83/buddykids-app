"use client";

// TRAMA — RADAR / COMMUNITY DISCOVERY (13/10/2026), patch 2: esperienza.
//
// "+ Aggiungi una scoperta" in Scopri. Un genitore manda a TRAMA quello che
// ha trovato fuori (foto di un volantino, screenshot, link, testo):
//   1. sceglie COSA mandare;
//   2. attesa con messaggi umani (POST /api/radar/analyze);
//   3. esito:
//      - non pertinente → spiegazione + "Segnala comunque" (solo feedback interno);
//      - dubbio → domanda esplicita "è per bambini o famiglie?" + due righe di dettaglio;
//      - già su TRAMA → "Apri" (nessun doppione);
//      - possibili somiglianze → "È questa" / "No, è un'altra";
//      - nuova → anteprima con "Correggi" e "Salva scoperta";
//   4. salvata → visibile a tutti con "Segnalato dalla community" (decisione D3),
//      con "Salva nei preferiti" e "Apri la scheda".
// Nessun file viene conservato (decisione D2): la foto resta solo in memoria
// del browser finché il pannello è aperto, per un eventuale secondo invio.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  abandonSubmissionAction,
  linkExistingAction,
  logRadarEventAction,
  reportAnywayAction,
  saveCommunityDiscoveryAction,
} from "@/app/actions/radar";
import { toggleCuratedFavoriteAction } from "@/app/actions/curated-favorites";
import { communityFavoriteId, communityCategoryLabel, formatCommunityAge, formatCommunityDates, formatCommunityPrice, COMMUNITY_BADGE_LABEL } from "@/lib/radar/community";
import {
  COMMUNITY_CATEGORIES,
  PRICE_UNITS,
  type CandidateMatch,
  type RadarAnalysis,
  type RadarExtractedData,
  type RadarWarning,
} from "@/lib/radar/types";

type Mode = "photo" | "link" | "text";
type Step = "choose" | "input" | "analyzing" | "result" | "saved";

interface LastInput {
  mode: Mode;
  file: File | null;
  url: string;
  text: string;
  foundNear: string;
}

interface SavedState {
  created: boolean;
  href: string;
  id: string;
  kind: string;
}

const WAIT_MESSAGES: Record<Mode, string[]> = {
  photo: ["Sto guardando il volantino…", "Leggo date, età e contatti…", "Controllo se c'è già su TRAMA…"],
  link: ["Apro il link…", "Leggo le informazioni pubbliche…", "Controllo se c'è già su TRAMA…"],
  text: ["Leggo il testo…", "Cerco date, età e prezzi…", "Controllo se c'è già su TRAMA…"],
};

const WARNING_TEXT: Partial<Record<RadarWarning, string>> = {
  date_year_ambiguous: "L'anno non è indicato: abbiamo lasciato le date come scritte.",
  price_missing: "Il prezzo non è indicato.",
  partial_content: "Abbiamo letto poche informazioni.",
  social_content_unavailable: "Dai social riusciamo a leggere poco: se puoi, manda uno screenshot.",
  url_unreadable: "Non siamo riusciti a leggere la pagina del link.",
  image_unreadable_in_simulation: "Per ora non leggiamo il testo dentro le foto: scrivi tu due righe.",
  low_text: "Il testo è molto breve.",
  field_discarded_invalid: "Abbiamo scartato un dato che non sembrava corretto.",
  personal_data_ignored: "Abbiamo ignorato eventuali dati personali.",
};

const NEEDS_DETAILS: RadarWarning[] = [
  "image_unreadable_in_simulation",
  "partial_content",
  "low_text",
  "social_content_unavailable",
  "url_unreadable",
];

const PRICE_UNIT_LABEL: Record<string, string> = {
  per_settimana: "a settimana",
  per_giorno: "al giorno",
  totale: "totale",
  per_mese: "al mese",
  per_lezione: "a lezione",
};

const KIND_LABEL: Record<CandidateMatch["kind"], string> = {
  activity: "Attività su TRAMA",
  curated: "Scoperta TRAMA",
  community: COMMUNITY_BADGE_LABEL,
};

function inputClass() {
  return "w-full rounded-lg border border-[#D8DEE8] bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-trama-violet";
}

export default function RadarAddDiscoverySheet({
  open,
  onClose,
  initialUrl = "",
  initialText = "",
}: {
  open: boolean;
  onClose: () => void;
  initialUrl?: string;
  initialText?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [mode, setMode] = useState<Mode>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const [foundNear, setFoundNear] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [waitIndex, setWaitIndex] = useState(0);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<RadarAnalysis | null>(null);
  const [fields, setFields] = useState<RadarExtractedData | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reported, setReported] = useState(false);
  const [saved, setSaved] = useState<SavedState | null>(null);
  const [favDone, setFavDone] = useState(false);
  const lastInput = useRef<LastInput | null>(null);
  const loggedOpen = useRef(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  // Contenuto condiviso da un'altra app (Android, share_target): si parte
  // già dal passo giusto, precompilato.
  useEffect(() => {
    if (!open) return;
    if (!loggedOpen.current) {
      loggedOpen.current = true;
      void logRadarEventAction("radar_opened", initialUrl ? "share_url" : initialText ? "share_text" : "cta");
    }
    if (initialUrl) {
      setMode("link");
      setUrl(initialUrl);
      setStep("input");
    } else if (initialText) {
      setMode("text");
      setText(initialText);
      setStep("input");
    }
  }, [open, initialUrl, initialText]);

  useEffect(() => {
    if (step !== "analyzing") return;
    setWaitIndex(0);
    const t = setInterval(() => setWaitIndex((i) => Math.min(i + 1, 2)), 1800);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!open) return null;

  function resetAll() {
    setStep("choose");
    setFile(null);
    setUrl("");
    setText("");
    setFoundNear("");
    setDetails("");
    setError(null);
    setSubmissionId(null);
    setAnalysis(null);
    setFields(null);
    setEditing(false);
    setReportText("");
    setReported(false);
    setSaved(null);
    setFavDone(false);
    lastInput.current = null;
  }

  function handleClose() {
    // Chiudere senza salvare: l'invio resta "abbandonato", nessun contenuto pubblico.
    if (submissionId && step === "result" && analysis && analysis.nextStep !== "reject") {
      void abandonSubmissionAction(submissionId);
    }
    resetAll();
    onClose();
  }

  function chooseMode(m: Mode) {
    setMode(m);
    setError(null);
    setStep("input");
    if (m === "photo") setTimeout(() => galleryInput.current?.click(), 0);
  }

  async function submit(opts: { confirmedRelevant?: boolean } = {}) {
    const base: LastInput =
      opts.confirmedRelevant && lastInput.current ? lastInput.current : { mode, file, url: url.trim(), text: text.trim(), foundNear: foundNear.trim() };
    if (base.mode === "photo" && !base.file && !base.text) return setError("Scegli una foto o scrivi due righe.");
    if (base.mode === "link" && !base.url) return setError("Incolla un link.");
    if (base.mode === "text" && !base.text) return setError("Scrivi o incolla il testo.");
    lastInput.current = base;

    const form = new FormData();
    if (base.mode === "photo" && base.file) form.append("image", base.file);
    if (base.mode === "link") form.append("url", base.url);
    const noteParts = [base.mode === "photo" || base.mode === "link" ? base.text : "", opts.confirmedRelevant ? details.trim() : ""].filter(Boolean);
    if (base.mode === "text") form.append("text", [base.text, opts.confirmedRelevant ? details.trim() : ""].filter(Boolean).join("\n"));
    else if (noteParts.length) form.append("note", noteParts.join("\n").slice(0, 500));
    if (base.foundNear) form.append("foundNear", base.foundNear);
    if (base.mode === "photo") form.append("sourceType", "flyer_photo");
    if (initialUrl && base.mode === "link") form.append("sourceType", "shared_url");
    if (opts.confirmedRelevant) {
      form.append("confirmedRelevant", "1");
      if (submissionId) form.append("previousSubmissionId", submissionId);
    }

    setError(null);
    setStep("analyzing");
    try {
      const res = await fetch("/api/radar/analyze", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { error?: string; submissionId?: string; analysis?: RadarAnalysis };
      if (!res.ok || !body.analysis || !body.submissionId) {
        setError(body.error ?? "Qualcosa non ha funzionato. Riprova.");
        setStep(opts.confirmedRelevant ? "result" : "input");
        return;
      }
      setSubmissionId(body.submissionId);
      setAnalysis(body.analysis);
      setFields(body.analysis.extracted);
      setEditing(false);
      setStep("result");
    } catch {
      setError("Connessione assente o lenta. Riprova.");
      setStep(opts.confirmedRelevant ? "result" : "input");
    }
  }

  async function handleLink(match: CandidateMatch) {
    if (!submissionId) return;
    setBusy(true);
    const result = await linkExistingAction(submissionId, match.kind, match.id);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    resetAll();
    onClose();
    router.push(result.href);
  }

  async function handleSave() {
    if (!submissionId || !fields) return;
    if (!fields.title || fields.title.trim().length < 2) {
      setEditing(true);
      return setError("Serve almeno il nome dell'attività.");
    }
    setBusy(true);
    setError(null);
    const result = await saveCommunityDiscoveryAction(submissionId, fields);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSaved({ created: result.created, href: result.href, id: result.id, kind: result.kind });
    setStep("saved");
    router.refresh();
  }

  async function handleReport() {
    if (!submissionId) return;
    setBusy(true);
    const result = await reportAnywayAction(submissionId, reportText);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setReported(true);
  }

  async function handleFavorite() {
    if (!saved || saved.kind !== "community") return;
    setFavDone(true);
    const result = await toggleCuratedFavoriteAction(communityFavoriteId(saved.id), true);
    if (result.error) {
      setFavDone(false);
      return setError("Non siamo riusciti a salvarla nei preferiti.");
    }
    void logRadarEventAction("radar_favorite_after_import", saved.id);
  }

  function setField<K extends keyof RadarExtractedData>(key: K, value: RadarExtractedData[K]) {
    setFields((f) => (f ? { ...f, [key]: value } : f));
  }

  const textField = (key: keyof RadarExtractedData, label: string, placeholder = "", multiline = false) => (
    <label className="mb-2.5 block text-[12px] font-semibold text-ink-2">
      {label}
      {multiline ? (
        <textarea
          rows={3}
          value={(fields?.[key] as string | null) ?? ""}
          placeholder={placeholder}
          onChange={(e) => setField(key, (e.target.value || null) as never)}
          className={`${inputClass()} mt-1 font-normal`}
        />
      ) : (
        <input
          value={(fields?.[key] as string | null) ?? ""}
          placeholder={placeholder}
          onChange={(e) => setField(key, (e.target.value || null) as never)}
          className={`${inputClass()} mt-1 font-normal`}
        />
      )}
    </label>
  );

  const numberField = (key: "ageMin" | "ageMax" | "price", label: string) => (
    <label className="block text-[12px] font-semibold text-ink-2">
      {label}
      <input
        inputMode="decimal"
        value={fields?.[key] ?? ""}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".").trim();
          const n = raw === "" ? null : Number(raw);
          setField(key, n === null || Number.isNaN(n) ? null : n);
        }}
        className={`${inputClass()} mt-1 font-normal`}
      />
    </label>
  );

  const warnings = (analysis?.warnings ?? []).map((w) => WARNING_TEXT[w]).filter((w): w is string => Boolean(w));
  const needsDetails = (analysis?.warnings ?? []).some((w) => NEEDS_DETAILS.includes(w));

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label="Aggiungi una scoperta">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[#F0F2F5] px-5 py-3.5">
          <div className="text-[15px] font-bold text-ink">Aggiungi una scoperta</div>
          <button type="button" onClick={handleClose} aria-label="Chiudi" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F6FA] text-ink-2">
            <i className="ti ti-x text-[16px]" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {error && <p className="mb-3 rounded-lg bg-[#FDECEA] px-3 py-2 text-[12.5px] font-semibold text-[#C0392B]">{error}</p>}

          {/* ── 1. Cosa vuoi mandare ─────────────────────────── */}
          {step === "choose" && (
            <>
              <p className="mb-4 text-[13.5px] leading-snug text-ink-2">
                Hai trovato qualcosa per i tuoi figli fuori da TRAMA? Mandalo qui: lo leggiamo noi e, se è nuovo, lo aggiungiamo a Scopri per
                tutte le famiglie.
              </p>
              <div className="flex flex-col gap-2.5">
                <button type="button" onClick={() => chooseMode("photo")} className="flex items-center gap-3 rounded-xl border border-[#E4E0FA] bg-[#FAF9FF] px-4 py-3.5 text-left">
                  <span className="text-2xl" aria-hidden>📷</span>
                  <span>
                    <span className="block text-[14px] font-bold text-ink">Foto o screenshot</span>
                    <span className="block text-[12px] text-ink-2">Un volantino, una locandina, un post</span>
                  </span>
                </button>
                <button type="button" onClick={() => chooseMode("link")} className="flex items-center gap-3 rounded-xl border border-[#E4E0FA] bg-[#FAF9FF] px-4 py-3.5 text-left">
                  <span className="text-2xl" aria-hidden>🔗</span>
                  <span>
                    <span className="block text-[14px] font-bold text-ink">Incolla un link</span>
                    <span className="block text-[12px] text-ink-2">Sito, pagina dell&apos;evento, post social</span>
                  </span>
                </button>
                <button type="button" onClick={() => chooseMode("text")} className="flex items-center gap-3 rounded-xl border border-[#E4E0FA] bg-[#FAF9FF] px-4 py-3.5 text-left">
                  <span className="text-2xl" aria-hidden>✍️</span>
                  <span>
                    <span className="block text-[14px] font-bold text-ink">Scrivi o incolla un testo</span>
                    <span className="block text-[12px] text-ink-2">Un messaggio WhatsApp, una mail della scuola</span>
                  </span>
                </button>
              </div>
            </>
          )}

          {/* ── 2. Contenuto ─────────────────────────────────── */}
          {step === "input" && (
            <>
              {mode === "photo" && (
                <>
                  <input
                    ref={galleryInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <input
                    ref={cameraInput}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="Anteprima della foto scelta" className="mb-3 max-h-56 w-full rounded-xl bg-[#F4F6FA] object-contain" />
                  ) : (
                    <div className="mb-3 rounded-xl border border-dashed border-[#D8DEE8] p-5 text-center text-[13px] text-ink-3">Nessuna foto scelta</div>
                  )}
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => cameraInput.current?.click()} className="rounded-lg border border-[#D8DEE8] px-3 py-2.5 text-[13px] font-semibold text-ink">
                      Fotografa
                    </button>
                    <button type="button" onClick={() => galleryInput.current?.click()} className="rounded-lg border border-[#D8DEE8] px-3 py-2.5 text-[13px] font-semibold text-ink">
                      {file ? "Cambia foto" : "Scegli dalla galleria"}
                    </button>
                  </div>
                  <label className="mb-3 block text-[12px] font-semibold text-ink-2">
                    Due righe su cosa è (consigliato)
                    <textarea
                      rows={3}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Es. Campus di basket per 6-10 anni a Rho, a luglio"
                      className={`${inputClass()} mt-1 font-normal`}
                    />
                  </label>
                </>
              )}
              {mode === "link" && (
                <>
                  <label className="mb-3 block text-[12px] font-semibold text-ink-2">
                    Link
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      inputMode="url"
                      placeholder="https://…"
                      className={`${inputClass()} mt-1 font-normal`}
                    />
                  </label>
                  <label className="mb-3 block text-[12px] font-semibold text-ink-2">
                    Due righe su cosa è (facoltativo)
                    <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass()} mt-1 font-normal`} />
                  </label>
                </>
              )}
              {mode === "text" && (
                <label className="mb-3 block text-[12px] font-semibold text-ink-2">
                  Testo
                  <textarea
                    rows={7}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Incolla qui il messaggio o la descrizione"
                    className={`${inputClass()} mt-1 font-normal`}
                  />
                </label>
              )}
              <label className="mb-4 block text-[12px] font-semibold text-ink-2">
                Dove l&apos;hai trovato? (facoltativo)
                <input
                  value={foundNear}
                  onChange={(e) => setFoundNear(e.target.value)}
                  placeholder="Es. bacheca della scuola, gruppo genitori"
                  className={`${inputClass()} mt-1 font-normal`}
                />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep("choose")} className="flex-1 rounded-lg border border-[#D8DEE8] px-3 py-3 text-sm font-semibold text-ink-2">
                  Indietro
                </button>
                <button type="button" onClick={() => void submit()} className="flex-[2] rounded-lg bg-trama-violet px-3 py-3 text-sm font-bold text-white">
                  Manda a TRAMA
                </button>
              </div>
              <p className="mt-3 text-[11px] leading-snug text-ink-3">
                Le foto non vengono conservate: teniamo solo le informazioni sull&apos;attività. Non inserire dati personali di altre persone.
              </p>
            </>
          )}

          {/* ── Attesa ───────────────────────────────────────── */}
          {step === "analyzing" && (
            <div className="flex flex-col items-center py-10 text-center" aria-live="polite">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-trama-violet/20 border-t-trama-violet" />
              <div className="text-[14px] font-semibold text-ink">{WAIT_MESSAGES[lastInput.current?.mode ?? mode][waitIndex]}</div>
              <div className="mt-1 text-[12px] text-ink-3">Di solito bastano pochi secondi.</div>
            </div>
          )}

          {/* ── 3. Esito ─────────────────────────────────────── */}
          {step === "result" && analysis && (
            <>
              {analysis.nextStep === "reject" && (
                <div>
                  <div className="mb-1 text-[16px] font-bold text-ink">Non sembra un&apos;attività per bambini o famiglie</div>
                  <p className="mb-4 text-[13px] text-ink-2">Per questo non la aggiungiamo a Scopri. Se pensi che ci siamo sbagliati, diccelo: la guardiamo noi.</p>
                  {reported ? (
                    <p className="mb-4 rounded-lg bg-green-light px-3 py-2.5 text-[13px] font-semibold text-[#2d8f52]">Grazie, la controlliamo.</p>
                  ) : (
                    <>
                      <textarea
                        rows={2}
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                        placeholder="Perché è adatta ai bambini? (facoltativo)"
                        className={`${inputClass()} mb-2`}
                      />
                      <button type="button" disabled={busy} onClick={() => void handleReport()} className="mb-3 w-full rounded-lg border border-[#D8DEE8] px-3 py-2.5 text-sm font-semibold text-ink disabled:opacity-60">
                        Segnala comunque
                      </button>
                    </>
                  )}
                  <button type="button" onClick={resetAll} className="w-full rounded-lg bg-trama-violet px-3 py-3 text-sm font-bold text-white">
                    Prova con un altro contenuto
                  </button>
                </div>
              )}

              {analysis.nextStep === "ask_confirmation" && (
                <div>
                  <div className="mb-1 text-[16px] font-bold text-ink">Non siamo sicuri di cosa sia</div>
                  <p className="mb-3 text-[13px] text-ink-2">È un&apos;attività, un corso o un evento per bambini o famiglie?</p>
                  {warnings.length > 0 && (
                    <ul className="mb-3 list-disc pl-5 text-[12px] text-ink-3">
                      {warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                  <label className="mb-3 block text-[12px] font-semibold text-ink-2">
                    {needsDetails ? "Aiutaci con due righe: nome, dove, per che età" : "Vuoi aggiungere qualche dettaglio? (facoltativo)"}
                    <textarea
                      rows={3}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Es. Laboratorio di teatro per 8-12 anni, Biblioteca di Pero, sabato mattina"
                      className={`${inputClass()} mt-1 font-normal`}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleClose} className="flex-1 rounded-lg border border-[#D8DEE8] px-3 py-3 text-sm font-semibold text-ink-2">
                      No, lascia stare
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (needsDetails && details.trim().length < 8) return setError("Scrivi almeno il nome e un altro dettaglio.");
                        void submit({ confirmedRelevant: true });
                      }}
                      className="flex-[2] rounded-lg bg-trama-violet px-3 py-3 text-sm font-bold text-white"
                    >
                      Sì, è per bambini o famiglie
                    </button>
                  </div>
                </div>
              )}

              {(analysis.nextStep === "open_existing" || analysis.nextStep === "choose_match") && (
                <div>
                  <div className="mb-1 text-[16px] font-bold text-ink">
                    {analysis.nextStep === "open_existing" ? "L'abbiamo già su TRAMA" : "Potrebbe essere già su TRAMA"}
                  </div>
                  <p className="mb-3 text-[13px] text-ink-2">
                    {analysis.nextStep === "open_existing" ? "Grazie! Non serve aggiungerla di nuovo." : "È una di queste?"}
                  </p>
                  <div className="mb-3 flex flex-col gap-2">
                    {(analysis.nextStep === "open_existing" ? analysis.candidateMatches.slice(0, 1) : analysis.candidateMatches).map((m) => (
                      <div key={`${m.kind}-${m.id}`} className="rounded-xl border border-[#F0F2F5] p-3">
                        <div className="text-[11px] font-semibold text-ink-3">{KIND_LABEL[m.kind]}</div>
                        <div className="text-[14px] font-bold text-ink">{m.title}</div>
                        {(m.organizerName || m.comune) && (
                          <div className="text-[12px] text-ink-2">{[m.organizerName, m.comune].filter(Boolean).join(" · ")}</div>
                        )}
                        {m.reasons.length > 0 && <div className="mt-1 text-[11px] text-ink-3">{m.reasons.join(", ")}</div>}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleLink(m)}
                          className="mt-2 w-full rounded-lg bg-trama-violet px-3 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
                        >
                          {analysis.nextStep === "open_existing" ? "Apri" : "È questa"}
                        </button>
                      </div>
                    ))}
                  </div>
                  {analysis.nextStep === "choose_match" && (
                    <button
                      type="button"
                      onClick={() => setAnalysis({ ...analysis, nextStep: "review_and_save" })}
                      className="w-full rounded-lg border border-[#D8DEE8] px-3 py-3 text-sm font-semibold text-ink"
                    >
                      No, è un&apos;altra cosa
                    </button>
                  )}
                </div>
              )}

              {analysis.nextStep === "review_and_save" && fields && (
                <div>
                  <div className="mb-1 text-[16px] font-bold text-ink">Ecco cosa abbiamo capito</div>
                  <p className="mb-3 text-[13px] text-ink-2">Controlla e correggi se serve: sarà visibile a tutte le famiglie in Scopri.</p>
                  {warnings.length > 0 && (
                    <ul className="mb-3 list-disc pl-5 text-[12px] text-ink-3">
                      {warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}

                  {!editing ? (
                    <div className="mb-3 rounded-xl border border-[#F0F2F5] p-3.5">
                      <div className="mb-1 text-[11px] font-semibold text-trama-orange">
                        {communityCategoryLabel(fields.category)} · {COMMUNITY_BADGE_LABEL}
                      </div>
                      <div className="text-[15px] font-bold text-ink">{fields.title ?? <span className="text-[#C0392B]">Nome mancante</span>}</div>
                      {fields.organizerName && <div className="text-[12.5px] text-ink-2">{fields.organizerName}</div>}
                      <div className="mt-2 flex flex-col gap-1 text-[12.5px] text-ink-2">
                        {(fields.locationName || fields.comune) && <div>📍 {[fields.locationName, fields.comune].filter(Boolean).join(", ")}</div>}
                        {formatCommunityDates(fields) && <div>📅 {formatCommunityDates(fields)}</div>}
                        {fields.scheduleText && <div>🕘 {fields.scheduleText}</div>}
                        {formatCommunityAge(fields.ageMin, fields.ageMax) && <div>👧 {formatCommunityAge(fields.ageMin, fields.ageMax)}</div>}
                        <div>💶 {formatCommunityPrice(fields.price, fields.priceUnit) ?? "Prezzo non indicato"}</div>
                        {fields.contactPhone && <div>📞 {fields.contactPhone}</div>}
                        {fields.contactEmail && <div>✉️ {fields.contactEmail}</div>}
                        {(fields.websiteUrl || fields.socialUrl) && <div className="break-all">🔗 {fields.websiteUrl ?? fields.socialUrl}</div>}
                      </div>
                      {fields.shortDescription && <p className="mt-2 text-[12.5px] text-ink-2">{fields.shortDescription}</p>}
                    </div>
                  ) : (
                    <div className="mb-3">
                      {textField("title", "Nome dell'attività *")}
                      {textField("organizerName", "Chi la organizza")}
                      <label className="mb-2.5 block text-[12px] font-semibold text-ink-2">
                        Tipo
                        <select
                          value={fields.category ?? ""}
                          onChange={(e) => setField("category", (e.target.value || null) as RadarExtractedData["category"])}
                          className={`${inputClass()} mt-1 font-normal`}
                        >
                          <option value="">Non so</option>
                          {COMMUNITY_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {communityCategoryLabel(c)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {textField("shortDescription", "Descrizione breve", "", true)}
                      {textField("comune", "Comune")}
                      {textField("locationName", "Luogo", "Es. Palestra della scuola Rodari")}
                      {textField("address", "Indirizzo")}
                      <div className="mb-2.5 grid grid-cols-2 gap-2">
                        {numberField("ageMin", "Età da")}
                        {numberField("ageMax", "Età fino a")}
                      </div>
                      <div className="mb-2.5 grid grid-cols-2 gap-2">
                        <label className="block text-[12px] font-semibold text-ink-2">
                          Dal
                          <input type="date" value={fields.startDate ?? ""} onChange={(e) => setField("startDate", e.target.value || null)} className={`${inputClass()} mt-1 font-normal`} />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-2">
                          Al
                          <input type="date" value={fields.endDate ?? ""} onChange={(e) => setField("endDate", e.target.value || null)} className={`${inputClass()} mt-1 font-normal`} />
                        </label>
                      </div>
                      {textField("dateTextRaw", "Date come scritte (se manca l'anno)")}
                      {textField("scheduleText", "Orari")}
                      <div className="mb-2.5 grid grid-cols-2 gap-2">
                        {numberField("price", "Prezzo (€)")}
                        <label className="block text-[12px] font-semibold text-ink-2">
                          Per
                          <select
                            value={fields.priceUnit ?? ""}
                            onChange={(e) => setField("priceUnit", (e.target.value || null) as RadarExtractedData["priceUnit"])}
                            className={`${inputClass()} mt-1 font-normal`}
                          >
                            <option value="">—</option>
                            {PRICE_UNITS.map((u) => (
                              <option key={u} value={u}>
                                {PRICE_UNIT_LABEL[u]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {textField("contactPhone", "Telefono dell'organizzatore")}
                      {textField("contactEmail", "Email dell'organizzatore")}
                      {textField("websiteUrl", "Sito")}
                      {textField("socialUrl", "Pagina social")}
                      {textField("registrationInfo", "Come iscriversi")}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditing((e) => !e)} className="flex-1 rounded-lg border border-[#D8DEE8] px-3 py-3 text-sm font-semibold text-ink">
                      {editing ? "Fatto" : "Correggi"}
                    </button>
                    <button type="button" disabled={busy} onClick={() => void handleSave()} className="flex-[2] rounded-lg bg-trama-violet px-3 py-3 text-sm font-bold text-white disabled:opacity-60">
                      {busy ? "Salvo…" : "Salva scoperta"}
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] leading-snug text-ink-3">
                    Salvandola sarà visibile a tutti con l&apos;etichetta &quot;{COMMUNITY_BADGE_LABEL}&quot;. Il tuo nome non viene mostrato.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── 4. Salvata ───────────────────────────────────── */}
          {step === "saved" && saved && (
            <div className="py-2 text-center">
              <div className="mb-2 text-4xl" aria-hidden>
                {saved.created ? "🎉" : "👍"}
              </div>
              <div className="mb-1 text-[16px] font-bold text-ink">{saved.created ? "Grazie, scoperta aggiunta!" : "Era già su TRAMA"}</div>
              <p className="mb-4 text-[13px] text-ink-2">
                {saved.created
                  ? `Ora la vedono tutte le famiglie in Scopri, con l'etichetta "${COMMUNITY_BADGE_LABEL}".`
                  : "L'abbiamo collegata a quella che c'era già: niente doppioni."}
              </p>
              <div className="flex flex-col gap-2">
                {saved.kind === "community" && (
                  <button
                    type="button"
                    disabled={favDone}
                    onClick={() => void handleFavorite()}
                    className="w-full rounded-lg border border-[#D8DEE8] px-3 py-3 text-sm font-semibold text-ink disabled:opacity-70"
                  >
                    {favDone ? "❤️ Nei preferiti" : "🤍 Salva nei preferiti"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const href = saved.href;
                    resetAll();
                    onClose();
                    router.push(href);
                  }}
                  className="w-full rounded-lg bg-trama-violet px-3 py-3 text-sm font-bold text-white"
                >
                  Apri la scheda
                </button>
                <button type="button" onClick={resetAll} className="w-full px-3 py-2 text-[13px] font-semibold text-trama-violet">
                  Aggiungi un&apos;altra scoperta
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
