// TRAMA — SCHOOL CALENDAR UX REFINEMENT (§15 "ACADEMIC YEAR", 14/09/2026).
//
// Logica pura (nessun I/O) per NON mostrare al genitore un dropdown tecnico
// "anno scolastico": TRAMA deriva da sola l'anno rilevante in base alla
// data odierna. Regola deterministica e SEMPRE sicura (non dipende da alcun
// dato esterno, solo dal calendario, quindi non ricade mai nel caso "NON
// inventare, segnala" del §15 — quello riguarda dati che TRAMA non può
// conoscere con certezza, non una convenzione di calendario): l'anno
// scolastico italiano inizia a settembre — da settembre a dicembre l'anno
// "corrente/rilevante" è quello appena iniziato, da gennaio ad agosto è
// quello iniziato l'anno civile precedente (l'anno scolastico in corso non
// finisce a Capodanno).

export interface AcademicYearLabel {
  // Formato lungo ("2026/2027") — stesso formato suggerito all'Admin per
  // school_calendars.school_year (vedi placeholder in
  // SchoolCalendarAdminClient.tsx: "Anno scolastico (es. 2026/2027)"). Usato
  // per il MATCHING con i calendari reali, mai mostrato al genitore.
  stored: string;
  // Formato breve ("2026/27") — §15: "Mostra l'anno solo come metadata".
  short: string;
}

export function deriveCurrentAcademicYear(todayIso: string): AcademicYearLabel {
  const year = Number(todayIso.slice(0, 4));
  const month = Number(todayIso.slice(5, 7));
  const startYear = month >= 9 ? year : year - 1;
  const endYear = startYear + 1;
  return { stored: `${startYear}/${endYear}`, short: `${startYear}/${String(endYear).slice(-2)}` };
}
