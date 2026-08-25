import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { CurrentConsentState } from "./consent";

// PRE-MICRO-PILOT CLOSURE GATE — task #567 (25/08/2026).
//
// Data layer per il modello v2 di migration_27_privacy_terms_consent.sql,
// LIVE in produzione dal 25/08/2026 (applicata da Fabrizio, verificata via
// POST-CHECK read-only — vedi docs/trama-one/analysis/PRE_MICRO_PILOT_GATE_STATUS.md).
//
// Distinto da lib/legal/consent.ts: quel file resta la logica PURA di
// versioning (nessun I/O) usata da tests/one/consent.spec.ts contro
// costanti segnaposto ("v0-draft-..."). Questo file è l'UNICO punto che
// legge/scrive davvero legal_documents/legal_acceptances/consent_events/
// parental_declarations — la versione "corrente" non è mai una costante nel
// codice: è sempre la riga PUBLISHED più recente in legal_documents, risolta
// qui, mai fidata da un valore inviato dal client (§7 del messaggio
// operativo di Fabrizio).
//
// server-only per costruzione: nessun Client Component deve importare
// questo file.

export type LegalDocumentType = "terms" | "privacy_notice";
export type DerivedLegalDocumentStatus = "draft" | "published" | "superseded";

export interface LegalDocumentRecord {
  id: string;
  documentType: LegalDocumentType;
  version: string;
  sha256: string | null;
  publishedAt: string | null;
  createdAt: string;
}

// Stesso pattern di lib/capacity/service.ts (SupabaseClientLike) — un client
// autenticato (RLS attiva) è sufficiente per tutte le funzioni tranne quelle
// esplicitamente marcate "service client" sotto.
type SupabaseClientLike = Awaited<ReturnType<typeof createClient>>;

interface LegalDocumentRow {
  id: string;
  document_type: string;
  version: string;
  sha256: string | null;
  published_at: string | null;
  created_at: string;
}

function mapDocumentRow(row: LegalDocumentRow): LegalDocumentRecord {
  return {
    id: row.id,
    documentType: row.document_type as LegalDocumentType,
    version: row.version,
    sha256: row.sha256,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

/**
 * Deriva DRAFT/PUBLISHED/SUPERSEDED contro l'intero elenco di righe dello
 * stesso document_type. Lo schema live NON ha una colonna status esplicita
 * (verificato nel POST-CHECK migration_27): PUBLISHED = la riga con
 * published_at valorizzato più recente per quel tipo; SUPERSEDED = una riga
 * con published_at valorizzato ma non la più recente; DRAFT = published_at
 * NULL. "superseded" non è un valore letterale nel DB — è una
 * classificazione puramente applicativa, ricalcolata ogni volta.
 */
export function deriveDocumentStatus(
  doc: LegalDocumentRecord,
  allOfSameType: LegalDocumentRecord[]
): DerivedLegalDocumentStatus {
  if (!doc.publishedAt) return "draft";

  let mostRecent: LegalDocumentRecord | null = null;
  for (const candidate of allOfSameType) {
    if (!candidate.publishedAt) continue;
    if (!mostRecent || Date.parse(candidate.publishedAt) > Date.parse(mostRecent.publishedAt!)) {
      mostRecent = candidate;
    }
  }
  return mostRecent?.id === doc.id ? "published" : "superseded";
}

/**
 * Tutte le righe di un document_type (per costruire lo storico/derivare lo
 * stato di ognuna — usato dalla vista Admin, task #574). Ordinate per
 * created_at decrescente. Nessuna riga oltre a quelle esistenti: mai
 * inventata/sintetizzata.
 */
export async function listDocumentsByType(
  client: SupabaseClientLike,
  documentType: LegalDocumentType
): Promise<LegalDocumentRecord[]> {
  const { data, error } = await client
    .from("legal_documents")
    .select("id, document_type, version, sha256, published_at, created_at")
    .eq("document_type", documentType)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as LegalDocumentRow[]).map(mapDocumentRow);
}

/**
 * Risolve il documento PUBLISHED corrente per un tipo — l'unica fonte di
 * verità per "qual è la versione attuale". Mai una versione passata dal
 * client. Restituisce null se nessuna riga è PUBLISHED (bozza/vuoto) — il
 * chiamante deve gestire questo caso mostrando uno stato controllato
 * ("Documento in preparazione"/gate fail-closed), MAI fingendo che esista.
 */
export async function resolvePublishedDocument(
  client: SupabaseClientLike,
  documentType: LegalDocumentType
): Promise<LegalDocumentRecord | null> {
  const { data, error } = await client
    .from("legal_documents")
    .select("id, document_type, version, sha256, published_at, created_at")
    .eq("document_type", documentType)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return mapDocumentRow(data[0] as LegalDocumentRow);
}

// ─────────────────────────────────────────────────────────────────────────
// Route pubbliche (task #569) — gap noto: la policy SELECT su
// legal_documents è "to authenticated" (verificato nel POST-CHECK
// migration_27), quindi un utente anonimo non può leggerla oggi. Nessuna
// nuova migrazione per questo (vincolo esplicito di Fabrizio: "non
// proporre di riapplicare/sostituire migration_27" e "nessuna migrazione
// nuova salvo errore reale" — questo non è un errore, è un limite noto,
// oggi innocuo perché 0 documenti PUBLISHED esistono). Workaround
// applicativo, minimo e circoscritto: usa createServiceClient() SOLO per
// leggere il documento PUBBLICO/non sensibile (tipo, versione, data
// pubblicazione, hash — MAI dati utente) per le pagine /privacy e /terms.
// Stesso pattern già in uso in lib/feature-flags/resolve.ts per
// feature_flag_overrides. Se Supabase non è configurato o la chiave di
// servizio manca, ritorna null (fail-closed, mai un errore mostrato).
// ─────────────────────────────────────────────────────────────────────────
export async function resolvePublishedDocumentForPublicRoute(
  documentType: LegalDocumentType
): Promise<LegalDocumentRecord | null> {
  const client = createServiceClient();
  if (!client) return null;

  const { data, error } = await client
    .from("legal_documents")
    .select("id, document_type, version, sha256, published_at, created_at")
    .eq("document_type", documentType)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return mapDocumentRow(data[0] as LegalDocumentRow);
}

// ─────────────────────────────────────────────────────────────────────────
// Accettazione Termini/Privacy Notice (legal_acceptances) — SOLO
// "accettato", mai withdraw/decline (coerente con la v2, vedi CHANGELOG nel
// file di migrazione). Idempotente: un doppio invio/doppio submit collide
// sull'UNIQUE(user_id, legal_document_id) — trattato come successo, non
// come errore (l'utente ha già accettato esattamente questa versione).
// ─────────────────────────────────────────────────────────────────────────

const POSTGRES_UNIQUE_VIOLATION = "23505";

export interface RecordAcceptanceResult {
  ok: boolean;
  alreadyAccepted?: boolean;
  error?: string;
}

/**
 * Accetta la versione CORRENTE (risolta qui, mai dal client) di un tipo di
 * documento per l'utente indicato, tramite un client già autenticato
 * (sessione esistente — caso normale: Settings/Profilo, o signup quando la
 * conferma email non è richiesta). Fail-closed: se nessun documento è
 * PUBLISHED, ritorna errore esplicito invece di inventare un'accettazione.
 */
export async function acceptCurrentLegalDocument(
  client: SupabaseClientLike,
  userId: string,
  documentType: LegalDocumentType,
  source: string
): Promise<RecordAcceptanceResult> {
  const current = await resolvePublishedDocument(client, documentType);
  if (!current) {
    return { ok: false, error: "Nessun documento pubblicato per questo tipo" };
  }

  const { error } = await client.from("legal_acceptances").insert({
    user_id: userId,
    legal_document_id: current.id,
    source,
  });

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      // Doppio submit/duplicate — già accettata esattamente questa
      // versione: successo idempotente, non un errore da mostrare.
      return { ok: true, alreadyAccepted: true };
    }
    return { ok: false, error: error.message };
  }

  await syncProfileLegalCache(client, userId, documentType, current);
  return { ok: true };
}

/**
 * Variante "bootstrap" per il momento esatto dopo supabase.auth.signUp():
 * se la conferma email è richiesta (vedi commento in
 * app/auth/login/LoginForm.tsx — "Controlla la tua email per confermare
 * l'account prima di accedere"), NON esiste ancora una sessione autenticata
 * subito dopo signUp(), quindi un insert client-side su legal_acceptances
 * fallirebbe la RLS (auth.uid() = user_id non soddisfatta). Usa
 * createServiceClient() (bypassa RLS) SOLO per questo bootstrap, con una
 * validazione applicativa di sostituzione: l'userId deve essere quello
 * restituito direttamente da Supabase Auth (il chiamante lo passa qui, non
 * lo legge da input utente arbitrario) E deve esistere una riga profiles
 * corrispondente (creata sincronicamente dal trigger handle_new_user() —
 * verificato in precedenti sprint) prima di scrivere. Mai chiamata con un
 * userId proveniente da un form/query string non fidato.
 */
export async function acceptCurrentLegalDocumentAtSignupBootstrap(
  userId: string,
  documentType: LegalDocumentType,
  source: string
): Promise<RecordAcceptanceResult> {
  const client = createServiceClient();
  if (!client) return { ok: false, error: "Supabase non configurato" };

  // Difesa applicativa: rifiuta se non esiste ancora una riga profiles per
  // questo userId (il trigger handle_new_user() la crea in modo sincrono
  // alla signUp() — se manca, l'userId non è genuino o la creazione del
  // profilo non è ancora completata).
  const { data: profileRow, error: profileError } = await client
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profileRow) {
    return { ok: false, error: "Profilo non trovato per questo utente" };
  }

  const current = await resolvePublishedDocument(client, documentType);
  if (!current) {
    return { ok: false, error: "Nessun documento pubblicato per questo tipo" };
  }

  const { error } = await client.from("legal_acceptances").insert({
    user_id: userId,
    legal_document_id: current.id,
    source,
  });

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      return { ok: true, alreadyAccepted: true };
    }
    return { ok: false, error: error.message };
  }

  await syncProfileLegalCache(client, userId, documentType, current);
  return { ok: true };
}

/**
 * Aggiorna le colonne cache su profiles (tos_version/tos_accepted_at o
 * privacy_notice_version/privacy_notice_accepted_at) dopo un'accettazione
 * riuscita — lettura O(1) senza join, come da commento nella migrazione.
 * Un fallimento qui NON invalida l'accettazione già scritta in
 * legal_acceptances (fonte di verità): è solo una comodità di lettura, il
 * chiamante non deve considerarlo bloccante.
 */
async function syncProfileLegalCache(
  client: SupabaseClientLike,
  userId: string,
  documentType: LegalDocumentType,
  doc: LegalDocumentRecord
): Promise<void> {
  const nowIso = new Date().toISOString();
  const update =
    documentType === "terms"
      ? { tos_version: doc.version, tos_accepted_at: nowIso }
      : { privacy_notice_version: doc.version, privacy_notice_accepted_at: nowIso };

  await client.from("profiles").update(update).eq("id", userId);
}

// ─────────────────────────────────────────────────────────────────────────
// Consenso marketing (consent_events) — l'unico dei 3 genuinamente
// revocabile. Estende (non sostituisce) updateMarketingConsentAction() già
// esistente in app/actions/profile.ts: quella funzione resta l'entry point
// per Impostazioni; questa è usata anche lì (vedi wiring in
// app/actions/profile.ts) per loggare lo storico + la colonna
// marketing_consent_updated_at (companion già preparata da migration_27 v2,
// mai popolata finora — vedi nota in lib/feature-registry/catalog.ts).
// ─────────────────────────────────────────────────────────────────────────

export type MarketingConsentAction = "accepted" | "withdrawn";

export async function recordMarketingConsentEvent(
  client: SupabaseClientLike,
  userId: string,
  action: MarketingConsentAction,
  source: string
): Promise<{ error?: string }> {
  const nowIso = new Date().toISOString();

  const { error: eventError } = await client.from("consent_events").insert({
    user_id: userId,
    consent_type: "marketing",
    action,
    source,
  });
  if (eventError) return { error: eventError.message };

  const { error: profileError } = await client
    .from("profiles")
    .update({
      marketing_consent: action === "accepted",
      marketing_consent_updated_at: nowIso,
    })
    .eq("id", userId);
  if (profileError) return { error: profileError.message };

  return {};
}

/**
 * Variante bootstrap (stesso motivo di acceptCurrentLegalDocumentAtSignupBootstrap:
 * nessuna sessione autenticata esiste subito dopo supabase.auth.signUp() se la
 * conferma email è richiesta) — usata SOLO dal wiring di signup per il
 * checkbox marketing opzionale. Scritta SOLO quando l'utente ha
 * esplicitamente spuntato il checkbox (action="accepted"): un checkbox
 * lasciato deselezionato (default) non genera alcun evento "withdrawn" —
 * non c'è nulla da "ritirare" se non è mai stato concesso, e la colonna
 * profiles.marketing_consent ha già default false di suo.
 */
export async function recordMarketingConsentEventAtSignupBootstrap(
  userId: string,
  action: MarketingConsentAction,
  source: string
): Promise<{ error?: string }> {
  const client = createServiceClient();
  if (!client) return { error: "Supabase non configurato" };
  return recordMarketingConsentEvent(client as unknown as SupabaseClientLike, userId, action, source);
}

// ─────────────────────────────────────────────────────────────────────────
// Dichiarazione di responsabilità genitoriale (parental_declarations) —
// task #570. La RLS INSERT (kids.parent_id = parent_user_id, verificata nel
// POST-CHECK) è già la difesa strutturale contro "dichiarare per il figlio
// di un altro" — questa funzione non duplica quella logica, si limita a
// gestire l'idempotenza del doppio submit sull'UNIQUE(parent_user_id,
// kid_id, declaration_version).
// ─────────────────────────────────────────────────────────────────────────

export async function recordParentalDeclaration(
  client: SupabaseClientLike,
  parentUserId: string,
  kidId: string,
  declarationVersion: string
): Promise<RecordAcceptanceResult> {
  const { error } = await client.from("parental_declarations").insert({
    parent_user_id: parentUserId,
    kid_id: kidId,
    declaration_version: declarationVersion,
  });

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      return { ok: true, alreadyAccepted: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * true se il genitore ha già dichiarato per questo bambino, a QUALUNQUE
 * versione della dichiarazione (usato per decidere se il prompt/flag deve
 * ripresentarsi — oggi non usato per bloccare nulla, dato che
 * LEGAL_TERMS_GATE è OFF: predisposizione per l'attivazione futura, task
 * #570/#571).
 */
export async function hasParentalDeclarationForKid(
  client: SupabaseClientLike,
  parentUserId: string,
  kidId: string
): Promise<boolean> {
  const { data, error } = await client
    .from("parental_declarations")
    .select("id")
    .eq("parent_user_id", parentUserId)
    .eq("kid_id", kidId)
    .limit(1);

  return !error && !!data && data.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Utenti esistenti — task #571 (25/08/2026). DESIGN, non attivazione: questa
// funzione non è chiamata da nessun punto di blocco oggi (nessun middleware,
// nessun layout la invoca) — esiste per rendere possibile, in futuro, una
// verifica "questo utente già esistente deve (ri)accettare i Termini?"
// SENZA richiedere una nuova migrazione: legge solo le colonne cache già
// presenti su profiles (tos_version/tos_accepted_at/privacy_notice_version/
// privacy_notice_accepted_at/marketing_consent/marketing_consent_updated_at,
// tutte NULLABLE da migration_27 v2).
//
// Comportamento per un utente REGISTRATO PRIMA di questo lavoro (il caso di
// ogni utente reale oggi): tutte le colonne cache sono NULL (mai scritte,
// nessun backfill eseguito e nessuno pianificato oggi) — questa funzione
// restituisce quindi correttamente "non ha accettato la versione corrente"
// (vedi hasAcceptedCurrentTermsAndPrivacyNotice in ./consent, che tratta
// null come "non accettato", mai come eccezione). Questo NON blocca nulla
// di per sé: è solo un dato che un futuro gate potrebbe interrogare, il
// giorno in cui Fabrizio deciderà di attivare LEGAL_TERMS_GATE anche per
// utenti già esistenti (non oggi — vedi §10 del messaggio operativo:
// "design per attivazione futura, nessun blocco oggi").
export async function getCurrentConsentStateForUser(
  client: SupabaseClientLike,
  userId: string
): Promise<CurrentConsentState | null> {
  const { data, error } = await client
    .from("profiles")
    .select(
      "tos_version, tos_accepted_at, privacy_notice_version, privacy_notice_accepted_at, marketing_consent, marketing_consent_updated_at"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    termsVersion: data.tos_version,
    termsAcceptedAt: data.tos_accepted_at,
    privacyNoticeVersion: data.privacy_notice_version,
    privacyNoticeAcceptedAt: data.privacy_notice_accepted_at,
    marketingConsent: Boolean(data.marketing_consent),
    marketingConsentUpdatedAt: data.marketing_consent_updated_at,
  };
}

/**
 * Verifica AUTORITATIVA (non la cache di comodo sopra) se un utente ha
 * accettato la versione PUBLISHED corrente di un documento — risolve
 * sempre dinamicamente contro legal_documents/legal_acceptances, MAI contro
 * le costanti segnaposto CURRENT_*_VERSION di ./consent.ts (che restano
 * SOLO per i test puri — vedi commento lì). Questa è la funzione che un
 * futuro gate per utenti esistenti dovrebbe chiamare per decidere se
 * richiedere una nuova accettazione, il giorno in cui verrà pubblicata una
 * versione più recente di quella già accettata da un utente. Non chiamata
 * da nessun punto di blocco oggi (design, non attivazione — task #571).
 */
export async function hasAcceptedCurrentDocument(
  client: SupabaseClientLike,
  userId: string,
  documentType: LegalDocumentType
): Promise<boolean> {
  const current = await resolvePublishedDocument(client, documentType);
  if (!current) return false;

  const { data, error } = await client
    .from("legal_acceptances")
    .select("id")
    .eq("user_id", userId)
    .eq("legal_document_id", current.id)
    .limit(1);

  return !error && !!data && data.length > 0;
}
