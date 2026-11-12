// TRAMA — ADMIN OPERATIVO (12/11/2026). Richiesta di Fabrizio: "Verifica che
// i dati demo non entrino nei KPI operativi". Iniziativa: Admin operativo
// per la beta (claude/INIZIATIVA_admin_operativo.md).
//
// Una regola sola per dire se un centro o un'attività sono di prova, usata
// dalle code di "Oggi", da Prenotazioni e dai dettagli Admin. Fonti:
//   - centers.is_test_fixture (migration 47): il segno ufficiale;
//   - il nome: "Centro Demo", "[TEST] …", "· centro di prova" (script del
//     26/10), "UX DEMO …", "(prova)". Alcuni centri usati per i collaudi
//     (es. "Centro Demo") NON hanno is_test_fixture, perché devono restare
//     visibili alle famiglie per le prove guidate: per le code operative
//     valgono comunque come prova.
// Pura, senza I/O (test: tests/one/admin-operativo.spec.ts).

const DEMO_NAME = /(\[test\]|\bdemo\b|\btest\b|centro di prova|\(prova\)|prova candidatura|collaudo)/i;

export function looksLikeDemoName(name: string | null | undefined): boolean {
  return Boolean(name && DEMO_NAME.test(name));
}

export function isDemoCenter(c: { name?: string | null; isTestFixture?: boolean | null } | null | undefined): boolean {
  if (!c) return false;
  return Boolean(c.isTestFixture) || looksLikeDemoName(c.name);
}

/** Un record collegato a un centro o a un'attività di prova è di prova. */
export function isDemoRecord(r: {
  centerName?: string | null;
  centerIsTestFixture?: boolean | null;
  activityName?: string | null;
}): boolean {
  return isDemoCenter({ name: r.centerName, isTestFixture: r.centerIsTestFixture }) || looksLikeDemoName(r.activityName);
}
