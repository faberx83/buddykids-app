// TRAMA — controllo del formato email in accesso e registrazione
// (16/10/2026, Fabrizio: "dobbiamo aggiungere check su formato mail quando si
// fa login"). Il controllo del browser (type="email") accetta anche
// "nome@gmail" senza ".com": qui si chiede un dominio completo e si
// suggerisce la correzione per gli errori di battitura più comuni.
// Logica pura, testata in tests/one/email-check.spec.ts.

const TYPO_DOMAINS: Record<string, string> = {
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.it": "gmail.com",
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "hotmail.con": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.ti": "hotmail.it",
  "libero.con": "libero.it",
  "libero.ti": "libero.it",
  "yahoo.con": "yahoo.com",
  "yaho.com": "yahoo.com",
  "icloud.con": "icloud.com",
  "outlook.con": "outlook.com",
};

/** Email pulita: spazi tolti, tutto minuscolo. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type EmailCheck = { ok: true; email: string } | { ok: false; message: string; suggestion?: string };

export function checkEmail(raw: string): EmailCheck {
  const email = normalizeEmail(raw);
  if (!email) return { ok: false, message: "Scrivi la tua email." };
  if (/\s/.test(email)) return { ok: false, message: "L'email non può contenere spazi." };
  const at = email.split("@");
  if (at.length !== 2 || !at[0] || !at[1]) return { ok: false, message: "Controlla l'email: deve essere del tipo nome@esempio.it." };
  const [local, domain] = at;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return { ok: false, message: "Controlla l'email: c'è un punto di troppo prima della @." };
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) || domain.includes("..") || domain.startsWith(".") || domain.startsWith("-")) {
    return { ok: false, message: "Controlla l'email: dopo la @ manca qualcosa (es. gmail.com)." };
  }
  const fix = TYPO_DOMAINS[domain];
  if (fix) {
    const suggestion = `${local}@${fix}`;
    return { ok: false, message: `Forse intendevi ${suggestion}?`, suggestion };
  }
  return { ok: true, email };
}
