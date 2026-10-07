// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), NOVITÀ TRAMA / FEATURE
// ANNOUNCEMENTS.
//
// Catalogo EDITORIALE, code-based — stesso principio già stabilito per
// lib/releases/catalog.ts ("source of truth CODE-BASED... NON: git commit →
// notification automatica. SÌ: release con announceToUsers=true →
// announcement disponibile"). DEPLOY ≠ USER ANNOUNCEMENT (§8 del task): un
// commit che tocca codice non genera mai un annuncio da solo — solo una
// voce qui, con announceToUsers=true, lo fa.
//
// Relazione con lib/releases/catalog.ts: `releaseId` referenzia per
// convenzione (non FK, stesso pattern di RELEASE_CATALOG.featureKeys →
// FEATURE_CATALOG) l'id di una ReleaseCatalogEntry — l'annuncio descrive il
// BENEFICIO per l'utente di quella release, mai il dettaglio tecnico
// (§14 esempio: "Più attività da scoprire", non "REAL_DISCOVERY_DATASET_ENABLED
// portato a true"). `requiredFeatureFlag`, quando presente, lega
// l'annuncio allo STESSO flag che governa la capability reale: un utente a
// cui quel flag non risolve true (perché la release è ancora
// internal-preview e lui non è nella coorte) non vede MAI l'annuncio — così
// "Rispetta internal-preview/pilot" (§14) è una proprietà STRUTTURALE, non
// una checklist editoriale da ricordarsi ad ogni nuova voce.

import type { KnownFeatureFlagName } from "@/lib/feature-flags/registry";

export type AnnouncementAudience = "parent";

/**
 * TRAMA — FAMILY-FIRST BETA PASS (07/10/2026), decisione di Fabrizio:
 * l'area Novità comunica anche evoluzioni REALMENTE pianificate.
 *  - "available"   (default): funzione rilasciata e utilizzabile; la CTA porta
 *                   alla funzione (regola §13 invariata).
 *  - "coming_soon": "In arrivo". Nessuna CTA verso la funzione (non esiste
 *                   ancora): il deepLink punta alla voce stessa dentro la
 *                   pagina Novità. Niente date, niente requiredFeatureFlag
 *                   (non c'è una capability da sbloccare). Raccoglie 👍/👎.
 * Il badge resta "hai una novità da leggere": una voce In arrivo genera
 * unread quando viene pubblicata e si spegne quando l'utente la legge, non
 * resta accesa fino al rilascio. Al rilascio vero: availability "available",
 * deepLink alla funzione e version + 1 (torna "nuova" per tutti).
 */
export type AnnouncementAvailability = "available" | "coming_soon";

export interface AnnouncementCatalogEntry {
  /** Identificatore stabile, kebab-case — usato come chiave in announcement_receipts.announcement_id. */
  id: string;
  /** Riferimento editoriale (non FK) a lib/releases/catalog.ts#RELEASE_CATALOG. */
  releaseId: string;
  /**
   * §10/§15 "ANNOUNCEMENT VERSION": incrementare SOLO per un'evoluzione
   * realmente significativa della STESSA feature — fa ricomparire il
   * callout contestuale (Level 2) per chi aveva già dismesso la versione
   * precedente. Mai incrementato per un bugfix/refactor (§8 esempi NO).
   */
  version: number;
  /** MVP: solo "parent" (§12 "TARGETING") — union estendibile in futuro (center/internal_pilot/cohort/global) senza rompere i call site esistenti. */
  audience: AnnouncementAudience[];
  /**
   * Se presente, l'annuncio è visibile SOLO a un utente per cui questo
   * flag risolve true (stesso resolveFeatureFlagVisibility già usato dalle
   * pagine che gate-ano la capability reale) — mai un annuncio "anticipato"
   * su una feature che l'utente non può ancora usare.
   */
  requiredFeatureFlag?: KnownFeatureFlagName;
  /** Switch editoriale: SOLO le voci con true partecipano a bell/callout/novità — §9 "RELEASE CATALOG AS SOURCE OF TRUTH". */
  announceToUsers: boolean;
  /** Titolo BENEFICIO, mai tecnico — §14. */
  userTitle: string;
  /** Corpo BENEFICIO, una frase — §14. */
  userBody: string;
  /** CTA primaria: porta SEMPRE alla feature, mai a un changelog generico (§13). */
  deepLink: string;
  /** Route su cui può comparire il callout contestuale Level 2 (§10/§15) — assente per annunci solo-bell. */
  contextualSurface?: string;
  /** ISO date — per l'ordinamento "Novità TRAMA" (Level 3, §10) e per relevantAt nel Notification Center. */
  releasedAt: string;
  /** Assente = "available". Vedi AnnouncementAvailability. */
  availability?: AnnouncementAvailability;
}

export function announcementAvailability(a: Pick<AnnouncementCatalogEntry, "availability">): AnnouncementAvailability {
  return a.availability ?? "available";
}

export function isComingSoon(a: Pick<AnnouncementCatalogEntry, "availability">): boolean {
  return announcementAvailability(a) === "coming_soon";
}

/** Ancora della voce dentro /nextgen/novita (usata come deepLink delle voci In arrivo). */
export function novitaAnchorHref(id: string): string {
  return `/nextgen/novita#${id}`;
}

export const ANNOUNCEMENT_CATALOG: AnnouncementCatalogEntry[] = [
  // §14 "INITIAL ANNOUNCEMENTS" — SCOPERTE TRAMA.
  {
    id: "real-discovery-pilot",
    releaseId: "real-discovery-pilot",
    version: 1,
    audience: ["parent"],
    requiredFeatureFlag: "REAL_DISCOVERY_DATASET_ENABLED",
    announceToUsers: true,
    userTitle: "Più attività da scoprire",
    userBody: "Ora in Scopri trovi anche attività individuate da TRAMA sul territorio.",
    deepLink: "/nextgen/search",
    contextualSurface: "/nextgen/search",
    releasedAt: "2026-09-16",
  },
  // §14 — SCHOOL CALENDAR.
  {
    id: "school-calendar-intelligence",
    releaseId: "planner-intelligence",
    version: 1,
    audience: ["parent"],
    requiredFeatureFlag: "SCHOOL_CALENDAR_INTELLIGENCE_ENABLED",
    announceToUsers: true,
    userTitle: "Il Planner conosce anche i giorni senza scuola",
    userBody: "TRAMA ora tiene conto anche delle chiusure scolastiche configurate per il tuo territorio.",
    deepLink: "/nextgen/planner",
    releasedAt: "2026-09-14",
  },
  // §14 — CURATED FAVORITES (questo stesso ciclo di lavoro). Stesso flag
  // richiesto di "real-discovery-pilot": Curated Favorites non ha senso per
  // un utente che non vede ancora le Scoperte TRAMA in Scopri.
  {
    id: "curated-favorites",
    releaseId: "real-discovery-pilot",
    version: 1,
    audience: ["parent"],
    requiredFeatureFlag: "REAL_DISCOVERY_DATASET_ENABLED",
    announceToUsers: true,
    userTitle: "Salva anche le Scoperte TRAMA",
    userBody: "Ora puoi aggiungere ai Preferiti anche le attività che TRAMA ha trovato sul territorio.",
    deepLink: "/nextgen/preferiti",
    releasedAt: "2026-09-23",
  },
  // TRAMA — FAMILY-FIRST BETA PASS (07/10/2026). Voci "In arrivo" decise da
  // Fabrizio (D2). Prodotto: claude/DECISIONI_ACCOMPAGNAMENTO_RITIRO_20260930.md.
  // Testi volutamente prudenti: niente date, niente promesse rigide; per le
  // deleghe nessun dettaglio sul meccanismo finché non c'è il parere legale.
  {
    id: "accompagnamento-ritiro",
    releaseId: "accompagnamento-ritiro",
    version: 1,
    audience: ["parent"],
    announceToUsers: true,
    availability: "coming_soon",
    userTitle: "Chi accompagna e chi ritira, attività per attività",
    userBody:
      "Stiamo lavorando per farti indicare chi porta e chi riprende per ogni singola attività, coinvolgendo anche nonni, tata o un altro genitore.",
    deepLink: novitaAnchorHref("accompagnamento-ritiro"),
    releasedAt: "2026-10-07",
  },
  {
    id: "deleghe-smart",
    releaseId: "deleghe-smart",
    version: 1,
    audience: ["parent"],
    announceToUsers: true,
    availability: "coming_soon",
    userTitle: "Deleghe smart per il ritiro",
    userBody:
      "Stiamo studiando un modo semplice e sicuro per autorizzare chi ritira i tuoi figli al centro, senza moduli di carta. Ci interessa sapere se ti sarebbe utile.",
    deepLink: novitaAnchorHref("deleghe-smart"),
    releasedAt: "2026-10-07",
  },
];

export function getAnnouncementCatalog(): AnnouncementCatalogEntry[] {
  return ANNOUNCEMENT_CATALOG;
}

export function getAnnouncementById(id: string): AnnouncementCatalogEntry | undefined {
  return ANNOUNCEMENT_CATALOG.find((a) => a.id === id);
}
