// Allowlist minima per funzionalità di debug/QA riservate alle utenze di
// test personali di Fabrizio (richiesta esplicita: "nascosto per utenti
// esterni e beta tester, attivo solo per le mie utenze di test").
// NON è un meccanismo generale: per gating su cohort/percentuali/utenti
// multipli usare invece lib/feature-flags/ (resolveFeatureFlag), che
// supporta override per userId/ruolo/cohort via tabella feature_flag_overrides.
// Questo helper esiste apposta per un caso più semplice e specifico: un
// singolo indirizzo Gmail e tutte le sue varianti "+" (es.
// faberx83+newparent@gmail.com), usate per creare rapidamente nuovi account
// di test — un allowlist per userId fisso non reggerebbe questo pattern,
// dato che ogni variante "+" è un account Supabase (quindi un userId) diverso.
const TEST_ACCOUNT_BASE = "faberx83@gmail.com";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Riconosce sia l'indirizzo esatto sia qualunque variante Gmail "+tag"
// (faberx83+qualcosa@gmail.com). Gmail ignora tutto ciò che segue "+" nella
// local-part ai fini della consegna, ma per Supabase/il nostro DB sono
// email (quindi account) a tutti gli effetti distinti — per questo il
// controllo è testuale, non un semplice confronto di uguaglianza.
export function isVersionToggleTestAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  if (normalized === TEST_ACCOUNT_BASE) return true;

  const [base, domain] = TEST_ACCOUNT_BASE.split("@");
  const pattern = new RegExp(`^${base}\\+[^@]+@${domain}$`);
  return pattern.test(normalized);
}
