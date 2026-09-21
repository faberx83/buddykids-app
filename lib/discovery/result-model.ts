// TRAMA — DISCOVERY UNIFICATION (21/09/2026)
//
// View-model di sola PRESENTAZIONE per unificare i risultati Partner e
// Curated in un'unica lista/count in /nextgen/search — vedi il report
// "TRAMA DISCOVERY UNIFICATION + PROPONI INVITO" (ANALYSIS PASS, §3
// "UNIFIED RESULT MODEL") per il ragionamento completo.
//
// REGOLA NON NEGOZIABILE: questo file NON tocca in alcun modo i domini
// persistenti. `Activity`/`SmartMatch` (Partner, lib/nextgen/smart-search.ts)
// e `DiscoveryLeadRecord` (Curated, lib/discovery/real-dataset.ts) restano
// esattamente come sono — le due pipeline di filtro/scoring che li
// producono (filteredActivities→computeSmartMatches in
// SearchDiscoveryClient.tsx, compatibleRealDiscoveryLeads) restano
// SEPARATE e INVARIATE. `DiscoveryResult` esiste solo per scegliere quale
// card renderizzare e in che ordine, una volta che entrambe le pipeline
// hanno già prodotto il proprio risultato filtrato.

import type { SmartMatch } from "@/lib/nextgen/smart-search";
import { isDiscoveryLeadInvitable, type DiscoveryLeadRecord } from "@/lib/discovery/real-dataset";

export type DiscoveryResult =
  | { kind: "partner"; match: SmartMatch }
  | { kind: "curated"; lead: DiscoveryLeadRecord };

/**
 * Interleaving DETERMINISTICO, senza inventare uno score cross-domain.
 *
 * §5 del prompt "ORDERING": "NON creare un falso Match score per Curated
 * ... NON confrontare direttamente rating Partner con confidence Curated
 * ... Se non esiste un criterio cross-domain sufficientemente onesto, usa
 * un interleaving deterministico semplice, per esempio: 2 Partner → 1
 * Curated, preservando l'ordine interno di ciascun dominio."
 *
 * Questa funzione fa esattamente questo, e nient'altro:
 * - Partner mantiene l'ordine già deciso da computeSmartMatches (score
 *   reale: età/interessi/rating/vicinanza/settimana scoperta) — MAI
 *   ririordinato qui.
 * - Curated mantiene l'ordine già deciso da sortDiscoveryLeadsForDisplay
 *   (confidence HIGH prima di MEDIUM, stabile) — MAI ririordinato qui.
 * - Il rapporto 2:1 è un criterio di PRESENTAZIONE (quanto spesso una
 *   Scoperta TRAMA appare tra i risultati Partner), non un giudizio di
 *   qualità/pertinenza tra le due liste: nessun confronto numerico tra un
 *   punteggio Partner e una confidence Curated avviene mai.
 * - Quando una delle due liste si esaurisce, l'altra continua a scorrere
 *   nel proprio ordine (nessun buco, nessuna ripetizione).
 */
export function interleaveDiscoveryResults(
  partnerMatches: SmartMatch[],
  curatedLeads: DiscoveryLeadRecord[],
  partnerPerCurated = 2
): DiscoveryResult[] {
  const results: DiscoveryResult[] = [];
  let partnerIndex = 0;
  let curatedIndex = 0;

  while (partnerIndex < partnerMatches.length || curatedIndex < curatedLeads.length) {
    for (let i = 0; i < partnerPerCurated && partnerIndex < partnerMatches.length; i++) {
      results.push({ kind: "partner", match: partnerMatches[partnerIndex] });
      partnerIndex++;
    }
    if (curatedIndex < curatedLeads.length) {
      results.push({ kind: "curated", lead: curatedLeads[curatedIndex] });
      curatedIndex++;
    }
  }

  return results;
}

/**
 * Count unico (§3 del prompt "COUNT UNICO"): il totale del result set
 * visibile complessivo, Partner + Curated. Nessun count separato "Scoperte
 * TRAMA" da nessuna parte della UI.
 */
export function countDiscoveryResults(partnerMatches: SmartMatch[], curatedLeads: DiscoveryLeadRecord[]): number {
  return partnerMatches.length + curatedLeads.length;
}

// ============ MAP UNIFICATION (TRAMA — DISCOVERY MAP + POLISH, 21/09/2026) ============
//
// §2-3-9 del prompt "TARGET — ONE DISCOVERY, ONE MAP" / "TRE STATI MAPPA" /
// "MAP RESULT MODEL". Stesso principio di `DiscoveryResult` sopra: un
// view-model di sola presentazione, PURO (nessun I/O), che riusa i due
// result set già filtrati (matches Partner, compatibleRealDiscoveryLeads
// Curated) invece di introdurre una terza pipeline indipendente — la Mappa
// e la Lista leggono sempre lo STESSO universo di risultati già filtrato,
// mai una ricerca ricostruita da zero (§10 "FILTER CONSISTENCY").
//
// Tre stati, mai più di tre, mai una quarta categoria implicita:
// - "partner": Partner TRAMA/mock-test già mappabili prima di questo pass —
//   comportamento INVARIATO (stessa fonte lat/lng di activities.latitude/
//   longitude, mai toccata da questo file).
// - "curated_invitable": Scoperta TRAMA con organizzatore identificato
//   (isDiscoveryLeadInvitable) E una coordinata statica verificata nel
//   dataset (lead.lat/lead.lng non null) — "Da invitare" in UI.
// - "curated_source": Scoperta TRAMA reale ma senza organizzatore
//   identificato, con una coordinata statica verificata — "Fonte pubblica"
//   in UI.
//
// REGOLA NON NEGOZIABILE identica al resto del pilot: un lead SENZA
// lat/lng verificate (oggi: tutti e 13, vedi CURATED GEO AUDIT nel report)
// non genera MAI un marker — non entra in questo array, punto. Nessun
// centroide, nessuna stima, nessuna eccezione "tanto è quasi giusto".
export interface DiscoveryMapPartnerItem {
  kind: "partner";
  id: string;
  name: string;
  emoji: string;
  lat: number;
  lng: number;
}

export interface DiscoveryMapCuratedItem {
  kind: "curated_invitable" | "curated_source";
  id: string;
  lead: DiscoveryLeadRecord;
  lat: number;
  lng: number;
}

export type DiscoveryMapItem = DiscoveryMapPartnerItem | DiscoveryMapCuratedItem;

/**
 * Costruisce l'universo unico di marker Mappa a partire dagli STESSI due
 * result set già filtrati usati dalla Lista (mai una terza pipeline). I
 * `partnerMapItems` sono quelli già calcolati da SearchDiscoveryClient
 * (stessa logica pre-esistente: `matches` con lat/lng note, invariata) — qui
 * vengono solo ri-taggati "partner" per uniformità di tipo con i marker
 * Curated. I lead Curated senza lat/lng noti (oggi: sempre, vedi sopra)
 * vengono semplicemente esclusi, mai approssimati.
 */
export function buildDiscoveryMapItems(
  partnerMapItems: { id: string; name: string; emoji: string; lat: number; lng: number }[],
  curatedLeads: DiscoveryLeadRecord[]
): DiscoveryMapItem[] {
  const partnerItems: DiscoveryMapItem[] = partnerMapItems.map((it) => ({ kind: "partner", ...it }));
  const curatedItems: DiscoveryMapItem[] = curatedLeads
    .filter((lead): lead is DiscoveryLeadRecord & { lat: number; lng: number } => lead.lat !== null && lead.lng !== null)
    .map((lead) => ({
      kind: isDiscoveryLeadInvitable(lead) ? "curated_invitable" : "curated_source",
      id: lead.id,
      lead,
      lat: lead.lat,
      lng: lead.lng,
    }));
  return [...partnerItems, ...curatedItems];
}
