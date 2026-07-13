// SPRINT 5.4 (NEXTGEN) — dato STUBBATO ma VISIBILE, per scelta esplicita di
// Fabrizio ("la configuriamo dopo, inserisci un dato stubbato - visibile"):
// distanza/tempo di percorrenza stimati fra un'attività e l'indirizzo di
// famiglia. Non è una vera distanza (richiederebbe geocodificare gli
// indirizzi testuali salvati in lib/data/addresses.ts, oggi senza
// coordinate — nessuna API mappe a pagamento configurata) — è un valore
// deterministico calcolato da un hash dell'id attività, cosi resta STABILE
// fra un caricamento e l'altro della pagina (non "salta" a ogni refresh,
// che sarebbe più confondente di un dato assente). Sempre mostrato con
// l'etichetta "stimato" e mai usato per calcoli reali (budget, filtri, ecc.).

export interface DistanceEstimate {
  km: number;
  minutes: number;
}

export function estimateDistance(activityId: string): DistanceEstimate {
  let hash = 0;
  for (let i = 0; i < activityId.length; i++) hash = (hash * 31 + activityId.charCodeAt(i)) >>> 0;
  // Range plausibile per spostamenti urbani/periferici: 2-22 km, 5-35 min.
  const km = 2 + (hash % 20);
  const minutes = 5 + ((hash >> 3) % 30);
  return { km, minutes };
}
