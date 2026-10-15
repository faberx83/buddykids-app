// TRAMA — "LA TUA FAMIGLIA" (15/10/2026, Fabrizio: "la sezione famiglia in
// profilo va analizzata bene" → "Si a tutto"). Una sola pagina con quattro
// blocchi: figli, genitori, chi vi aiuta, luoghi. Qui solo la logica pura
// (testi e regole), testabile senza React.

/** Nome del gruppo famiglia creato in automatico al primo invito (nessun passaggio "Crea famiglia"). */
export function defaultFamilyName(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `Famiglia ${parts[parts.length - 1]}`;
  return "La nostra famiglia";
}

/** Nome di una persona che aiuta: spazi compattati, 1–40 caratteri. null = non valido. */
export function cleanHelperName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length === 0 || name.length > 40) return null;
  return name;
}

/** Nonno, Nonna e Tata sono già scelte fisse in "Chi accompagna": qui non si duplicano. */
export const BUILT_IN_HELPERS = ["Nonno", "Nonna", "Tata"] as const;

export function isBuiltInHelper(name: string): boolean {
  return BUILT_IN_HELPERS.some((b) => b.toLowerCase() === name.trim().toLowerCase());
}

/** Riga di riepilogo nel Profilo: "Lino e Franchidea" / "Aggiungi i tuoi figli". */
export function familySummaryLine(kidNames: string[]): string {
  if (kidNames.length === 0) return "Aggiungi i tuoi figli";
  if (kidNames.length === 1) return kidNames[0];
  return `${kidNames.slice(0, -1).join(", ")} e ${kidNames[kidNames.length - 1]}`;
}
