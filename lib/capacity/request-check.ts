// TRAMA — UNA RICHIESTA NON PUÒ CHIEDERE PIÙ POSTI DI QUELLI LIBERI
// (decisione di Fabrizio, 04/11/2026: "bisogna fare il calcolo con il numero
// di posti disponibili"). Ogni bambino occupa un posto in ogni giorno o
// settimana scelti (lib/capacity/units.ts): se un giorno ha meno posti liberi
// dei bambini scelti, la richiesta non parte. Prima partiva e all'accettazione
// finiva in lista d'attesa. Stessa regola nella pagina di richiesta e sul
// server (app/booking/[id]/actions.ts). Pura, testata in
// tests/one/qa-prod-0411.spec.ts.

export interface SpotsSlot {
  key: string;
  label: string;
  spotsLeft: number;
}

/** Giorni o settimane con meno posti liberi dei bambini scelti. */
export function spotsShortfall(slots: SpotsSlot[], kidsCount: number): SpotsSlot[] {
  const kids = Math.max(1, Math.floor(kidsCount || 1));
  return slots.filter((s) => (Number.isFinite(s.spotsLeft) ? s.spotsLeft : 0) < kids);
}

const posti = (n: number) => (n === 1 ? "1 posto libero" : n <= 0 ? "nessun posto libero" : `${n} posti liberi`);

/** Spiegazione con il passo successivo; "" se va tutto bene. */
export function shortfallMessage(short: SpotsSlot[], kidsCount: number): string {
  if (short.length === 0) return "";
  const kids = Math.max(1, Math.floor(kidsCount || 1));
  const bambini = kids === 1 ? "1 bambino" : `${kids} bambini`;
  if (short.length === 1) {
    const s = short[0];
    const fit = Math.max(0, s.spotsLeft);
    const next =
      fit > 0
        ? `potete chiederlo per ${fit === 1 ? "1 bambino" : `${fit} bambini`}, oppure scegliete un altro giorno.`
        : "scegliete un altro giorno.";
    return `${s.label}: ${posti(s.spotsLeft)} per ${bambini}. Ogni bambino occupa un posto: ${next}`;
  }
  const min = Math.max(0, Math.min(...short.map((s) => s.spotsLeft)));
  const list = short.slice(0, 3).map((s) => s.label).join(", ") + (short.length > 3 ? ` e altri ${short.length - 3}` : "");
  const next = min > 0 ? `chiedete per ${min === 1 ? "1 bambino" : `${min} bambini`} o scegliete altri giorni.` : "scegliete altri giorni.";
  return `${list}: meno posti liberi dei ${bambini} scelti. Ogni bambino occupa un posto: ${next}`;
}
