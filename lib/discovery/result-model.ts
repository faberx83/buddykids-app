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
  // TRAMA — DISCOVERY MAP FINALIZATION (22/09/2026), §4-5 "MULTI-SEDE".
  // Presente SOLO quando questo marker proviene da una voce di
  // `lead.locations[]` invece che da `lead.lat/lead.lng` direttamente —
  // usato per distinguere in popup/legenda quale sede specifica rappresenta
  // il marker, quando un singolo lead genera più marker. `null`/assente per
  // ogni marker "a sede singola" (tutti gli altri record del dataset).
  locationLabel?: string;
}

export type DiscoveryMapItem = DiscoveryMapPartnerItem | DiscoveryMapCuratedItem;

/**
 * Costruisce l'universo unico di marker Mappa a partire dagli STESSI due
 * result set già filtrati usati dalla Lista (mai una terza pipeline). I
 * `partnerMapItems` sono quelli già calcolati da SearchDiscoveryClient
 * (stessa logica pre-esistente: `matches` con lat/lng note, invariata) — qui
 * vengono solo ri-taggati "partner" per uniformità di tipo con i marker
 * Curated. I lead Curated senza lat/lng noti e senza `locations[]` con
 * almeno una voce geocodificata vengono semplicemente esclusi, mai
 * approssimati.
 *
 * MULTI-SEDE (22/09/2026): quando un lead ha `locations[]` (oggi: solo
 * milano-centri-estivi-scuole-primarie-comunali), genera UN marker per ogni
 * voce con lat/lng non null — mai un marker per `lead.lat/lead.lng` diretto
 * in quel caso (evita un marker "riassuntivo" fuorviante in aggiunta alle
 * sedi reali). Un lead SENZA `locations[]` continua a generare al massimo un
 * marker da `lead.lat/lead.lng`, come prima. La Lista (renderDiscoveryResult
 * in SearchDiscoveryClient.tsx) non legge mai questo array — continua a
 * mostrare una sola card per lead, qualunque sia il numero di marker
 * generati qui: la moltiplicazione è SOLO di presentazione-Mappa.
 */
export function buildDiscoveryMapItems(
  partnerMapItems: { id: string; name: string; emoji: string; lat: number; lng: number }[],
  curatedLeads: DiscoveryLeadRecord[]
): DiscoveryMapItem[] {
  const partnerItems: DiscoveryMapItem[] = partnerMapItems.map((it) => ({ kind: "partner", ...it }));
  const curatedItems: DiscoveryMapItem[] = curatedLeads.flatMap((lead): DiscoveryMapCuratedItem[] => {
    const kind = isDiscoveryLeadInvitable(lead) ? "curated_invitable" : "curated_source";
    if (lead.locations && lead.locations.length > 0) {
      return lead.locations
        .filter((loc): loc is (typeof lead.locations)[number] & { lat: number; lng: number } => loc.lat !== null && loc.lng !== null)
        .map((loc, index) => ({
          kind,
          id: `${lead.id}__${index}`,
          lead,
          lat: loc.lat,
          lng: loc.lng,
          locationLabel: loc.label,
        }));
    }
    if (lead.lat === null || lead.lng === null) return [];
    return [{ kind, id: lead.id, lead, lat: lead.lat, lng: lead.lng }];
  });
  return [...partnerItems, ...curatedItems];
}

/**
 * §5 del prompt "MULTI-SEDE": numero di ATTIVITÀ curate distinte con almeno
 * un marker (mai il numero di marker — un'attività multi-sede con 2 sedi
 * mappate conta 1, non 2). Usato per distinguere `mappedActivitiesCount` da
 * `mapMarkersCount` in SearchDiscoveryClient.tsx.
 */
export function countMappedCuratedActivities(curatedLeads: DiscoveryLeadRecord[]): number {
  return curatedLeads.filter((lead) => {
    if (lead.locations && lead.locations.length > 0) {
      return lead.locations.some((loc) => loc.lat !== null && loc.lng !== null);
    }
    return lead.lat !== null && lead.lng !== null;
  }).length;
}
