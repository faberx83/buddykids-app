import { ResponsibleValue } from "./responsibility-options";

// TRAMA BETA v1.1.1 (FINAL VISUAL CONFORMANCE PASS, punto 8) — helper puro
// estratto dalla logica di colore prima inline in PlannerCalendarView.tsx
// (chip di assegnazione "Chi fa cosa"), per renderla verificabile con un
// test unitario (VIS111-07/08) senza bisogno di un browser/e2e reale.
// Nessun cambio di comportamento: stessa identica condizione
// (`responsible === "io"`) già presente nel componente, solo estratta e
// nominata. Il colore indica lo STATO dell'assegnazione, non l'identità
// della persona — "mine" è l'unico stato che dipende da CHI guarda lo
// schermo (il genitore loggato), non da quale valore tecnico è stato
// scelto tra partner/nonno/nonna/tata/altro (tutti "other").
export type ResponsibilityTone = "mine" | "other" | "unassigned";

export function responsibilityToneFor(responsible: ResponsibleValue | null | undefined): ResponsibilityTone {
  if (!responsible) return "unassigned";
  return responsible === "io" ? "mine" : "other";
}
