// TRAMA — mittente unico delle email transazionali (20/10/2026, Fabrizio:
// "From TRAMA <INVITE_FROM_EMAIL>, Reply-To EMAIL_REPLY_TO, nessun fallback
// personale"). [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  EMAIL_SENDER_NAME,
  buildResendPayload,
  extractEmailAddress,
  resolveEmailSettings,
} from "../../lib/email";

const ROOT = path.join(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

// Tutti i punti che inviano email oggi (audit del 20/10/2026).
const SENDERS = [
  "app/actions/family.ts", // invito altro genitore
  "app/actions/groups.ts", // invito gruppo
  "lib/booking-response/notify.ts", // risposta del centro alla prenotazione
  "app/actions/attendance.ts", // assenza segnata dal centro
  "app/actions/checkin.ts", // ritardo segnalato dal genitore
  "app/api/checkin/quick-action/route.ts", // ritardo dal link rapido
  "app/actions/invites.ts", // invito del Gestore
  "app/actions/waitlist.ts", // avviso nuova richiesta di invito
  "lib/centers/notify-center.ts", // centri del pilota: nuova richiesta, candidatura, approvazione (27/10/2026)
];

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

test.describe("TRAMA — Mittente unico email [no browser]", () => {
  test("EMM-01 From sempre 'TRAMA <indirizzo>', anche se la variabile contiene già un nome", () => {
    expect(EMAIL_SENDER_NAME).toBe("TRAMA");
    expect(resolveEmailSettings({ RESEND_API_KEY: "re_x", INVITE_FROM_EMAIL: "notifiche@tramapp.it" }).from).toBe(
      "TRAMA <notifiche@tramapp.it>"
    );
    expect(resolveEmailSettings({ RESEND_API_KEY: "re_x", INVITE_FROM_EMAIL: "  Altro Nome <notifiche@tramapp.it> " }).from).toBe(
      "TRAMA <notifiche@tramapp.it>"
    );
  });

  test("EMM-02 senza INVITE_FROM_EMAIL (o con un valore non valido) non si invia e c'è un messaggio chiaro", () => {
    for (const value of [undefined, "", "   ", "notifiche", "notifiche@tramapp", "TRAMA <>"]) {
      const s = resolveEmailSettings({ RESEND_API_KEY: "re_x", INVITE_FROM_EMAIL: value });
      expect(s.from, String(value)).toBeNull();
      expect(s.problems.join(" "), String(value)).toContain("INVITE_FROM_EMAIL");
      expect(buildResendPayload({ to: "a@b.it", subject: "s", html: "h" }, s)).toBeNull();
    }
  });

  test("EMM-03 Reply-To da EMAIL_REPLY_TO; se manca l'email parte senza Reply-To, come prima", () => {
    const input = { to: "genitore@example.com", subject: "Oggetto", html: "<p>ciao</p>" };
    const withReply = resolveEmailSettings({ RESEND_API_KEY: "re_x", INVITE_FROM_EMAIL: "notifiche@tramapp.it", EMAIL_REPLY_TO: "risposte@example.it" });
    expect(buildResendPayload(input, withReply)).toEqual({
      from: "TRAMA <notifiche@tramapp.it>",
      to: "genitore@example.com",
      subject: "Oggetto",
      html: "<p>ciao</p>",
      reply_to: "risposte@example.it",
    });

    const without = resolveEmailSettings({ RESEND_API_KEY: "re_x", INVITE_FROM_EMAIL: "notifiche@tramapp.it" });
    expect(without.problems).toEqual([]);
    expect(buildResendPayload(input, without)).not.toHaveProperty("reply_to");

    const invalid = resolveEmailSettings({ RESEND_API_KEY: "re_x", INVITE_FROM_EMAIL: "notifiche@tramapp.it", EMAIL_REPLY_TO: "non-valido" });
    expect(invalid.replyTo).toBeNull();
    expect(invalid.problems.join(" ")).toContain("EMAIL_REPLY_TO");
    expect(buildResendPayload(input, invalid)).not.toHaveProperty("reply_to");
  });

  test("EMM-04 estrazione indirizzo", () => {
    expect(extractEmailAddress("a.b@tramapp.it")).toBe("a.b@tramapp.it");
    expect(extractEmailAddress("Nome <a@tramapp.it>")).toBe("a@tramapp.it");
    expect(extractEmailAddress("a b@tramapp.it")).toBeNull();
    expect(extractEmailAddress(null)).toBeNull();
  });

  test("EMM-05 lib/email.ts: nessun mittente di ripiego, isEmailConfigured richiede chiave e mittente, campo reply_to", () => {
    const src = read("lib/email.ts");
    expect(src).not.toContain("onboarding@resend.dev");
    expect(src).toContain("export const isEmailConfigured = SETTINGS.apiKeyPresent && SETTINGS.from !== null;");
    expect(src).toContain("payload.reply_to = settings.replyTo");
    expect(src).toContain("process.env.EMAIL_REPLY_TO");
  });

  test("EMM-06 tutti gli invii passano da lib/email.ts e nessun file costruisce un proprio From/Reply-To", () => {
    for (const file of SENDERS) {
      const src = read(file);
      expect(src, file).toContain('from "@/lib/email"');
      expect(src, file).toContain("sendEmail(");
      expect(src, file).not.toMatch(/\bfrom:\s*["'`]/);
      expect(src, file).not.toMatch(/reply_?to\s*:/i);
    }

    const all = [...listSourceFiles("app"), ...listSourceFiles("lib"), ...listSourceFiles("components")];
    const callers = all.filter((f) => f !== path.join("lib", "email.ts") && read(f).includes("api.resend.com"));
    expect(callers, "chiamate dirette a Resend fuori da lib/email.ts").toEqual([]);

    const hardcoded = all.filter((f) => /trama@tramapp\.it|notifiche@tramapp\.it|onboarding@resend\.dev/.test(read(f)));
    expect(hardcoded, "indirizzi mittente/Reply-To scritti nel codice").toEqual([]);
  });
});
