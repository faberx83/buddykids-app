// TRAMA — UNA SOLA FORMA PER LE EMAIL ALLE FAMIGLIE (ritest del 22/10/2026,
// Fabrizio: "inviata mail ma con formato non allineato alle altre").
// Stesso aspetto del buongiorno di TRAMA (lib/nextgen/daily-briefing.ts):
// fondo caldo sempre chiaro, segno TRAMA, titolo blu notte, pulsante blu
// notte con raggio 12, nota piccola in fondo. Logica pura, nessun I/O:
// testata in tests/one/parent-ux-fix.spec.ts.

export const EMAIL_PUBLIC_ORIGIN = "https://tramapp.it";

export function escapeEmailHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const FONT = "-apple-system,Helvetica,Arial,sans-serif";

/**
 * Email nello stile TRAMA. `paragraphs` sono già HTML (il chiamante usa
 * escapeEmailHtml sui dati inseriti dagli utenti); titolo, pulsante e nota
 * vengono ripuliti qui.
 */
export function tramaEmailHtml(input: {
  title: string;
  paragraphs: string[];
  cta?: { label: string; href: string } | null;
  /** Testo piccolo in fondo (es. a quale email è arrivato l'invito). */
  footnote?: string | null;
  /** Mostrato sotto il pulsante: il link in chiaro, se il pulsante non si apre. */
  showLinkFallback?: boolean;
}): string {
  const title = escapeEmailHtml(input.title);
  const paragraphs = input.paragraphs
    .map((p) => `<tr><td style="padding:10px 0 0;font:15px/1.5 ${FONT};color:#172A4D">${p}</td></tr>`)
    .join("\n");
  const cta = input.cta
    ? `<tr><td style="padding:22px 0 4px"><a href="${escapeEmailHtml(input.cta.href)}" style="display:inline-block;padding:13px 22px;border-radius:12px;background:#172A4D;color:#fff;font:600 15px ${FONT};text-decoration:none">${escapeEmailHtml(input.cta.label)}</a></td></tr>`
    : "";
  const fallback =
    input.cta && input.showLinkFallback
      ? `<tr><td style="padding:10px 0 0;font:12px/1.5 ${FONT};color:#8A8F98">Se il pulsante non si apre: <a href="${escapeEmailHtml(input.cta.href)}" style="color:#8A8F98">${escapeEmailHtml(input.cta.href)}</a></td></tr>`
      : "";
  const footnote = input.footnote
    ? `<tr><td style="padding:18px 0 0;font:12px/1.5 ${FONT};color:#8A8F98">${escapeEmailHtml(input.footnote)}</td></tr>`
    : "";
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<style>:root{color-scheme:light only;supported-color-schemes:light only}body,table,td{background-color:#FDFCFA !important}</style>
<title>${title}</title></head><body bgcolor="#FDFCFA" style="margin:0;background:#FDFCFA;color-scheme:light only">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FDFCFA" style="background:#FDFCFA"><tr><td align="center" bgcolor="#FDFCFA" style="padding:24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 0 8px"><img src="${EMAIL_PUBLIC_ORIGIN}/brand/trama-logo-mark.png" alt="TRAMA" width="44" style="display:block;height:auto"></td></tr>
<tr><td style="font:600 24px/1.25 ${FONT};color:#172A4D">${title}</td></tr>
${paragraphs}
${cta}
${fallback}
${footnote}
</table></td></tr></table></body></html>`;
}
