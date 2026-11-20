// 20/11/2026 (Fabrizio: "questa informativa privacy rivista dal legale in
// modalità revisione.. se ti torna metti questa e integra me come
// responsabile dati"): nuova versione 2026-11-20 dell'informativa.
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { test, expect } from "@playwright/test";
import { LATEST_LEGAL_VERSION, isDraftLegalVersion, legalTextFor } from "../../lib/legal/texts";
import { parseLegalText } from "../../lib/legal/parse";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");
const sha = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");
const V = "2026-11-20";

test.describe("Informativa privacy 2026-11-20 [no browser]", () => {
  test("IPV-01 è l'ultima versione, non è una bozza e non ha segnaposti", () => {
    expect(LATEST_LEGAL_VERSION.privacy_notice).toBe(V);
    expect(isDraftLegalVersion(V)).toBe(false);
    const t = legalTextFor("privacy_notice", V)!;
    expect(t).not.toMatch(/\[[^\]]*\]/); // nessun [DA COMPLETARE] o nota tra parentesi quadre
    expect(t).not.toContain("__TITOLARE__");
    expect(t).not.toMatch(/\.\.|minorio|didati|3-15/); // refusi della bozza v.2
    expect(t.toLowerCase()).not.toMatch(/conforme al gdpr|pienamente conforme/);
  });

  test("IPV-02 contenuti chiave della revisione legale", () => {
    const t = legalTextFor("privacy_notice", V)!;
    for (const s of [
      "Il titolare del trattamento è Fabrizio",
      "anche se non hai un account",
      "titolari autonomi",
      "Lista d'attesa",
      "Segnalato dalla community",
      "La foto non viene conservata",
      "non viene inviata né conservata sui nostri server",
      "Photon",
      "Resend",
      "Clausole Contrattuali Standard",
      "entro 30 giorni",
      "sovrascritte entro 7 giorni",
      "al massimo 30 giorni",
      "Garante per la protezione dei dati personali",
    ])
      expect(t).toContain(s);
    // dati del genitore non necessari: non più elencati
    const s31 = t.slice(t.indexOf("**3.1"), t.indexOf("**3.2"));
    expect(s31).not.toMatch(/data di nascita|genere/);
    // diritti senza doppioni
    expect(t.match(/formato leggibile da un computer/g)?.length).toBe(1);
  });

  test("IPV-03 impaginazione: 12 sezioni, 14 sottosezioni 3.x, tabelle finalità e fornitori", () => {
    const blocks = parseLegalText(legalTextFor("privacy_notice", V)!);
    expect(blocks[0]).toEqual({ kind: "h1", text: "Informativa privacy di TRAMA" });
    expect(blocks.filter((b) => b.kind === "h2").length).toBe(12);
    const subs = blocks.filter((b) => b.kind === "p" && /^\*\*3\.\d+ ·/.test(b.text)).map((b) => (b as { text: string }).text.match(/3\.(\d+)/)![1]);
    expect(subs).toEqual(Array.from({ length: 14 }, (_, i) => String(i + 1)));
    const tables = blocks.filter((b) => b.kind === "table") as { kind: "table"; rows: string[][] }[];
    expect(tables[0].rows[0]).toEqual(["Finalità", "Base giuridica"]);
    expect(tables[1].rows[0]).toEqual(["Fornitore", "Cosa fa", "Dove"]);
  });

  test("IPV-04 pubblicazione: impronta esatta, nessuna migrazione automatica", () => {
    const sql = read("supabase/legal_publish_2026-11-20.sql");
    const text = legalTextFor("privacy_notice", V)!;
    expect(sql).toContain(`('privacy_notice', '${V}', '${sha(text)}', now())`);
    expect(sql).not.toContain("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toContain("on conflict (document_type, version) do nothing;");
  });

  test("IPV-05 dati del genitore non necessari: non si chiedono e non si scrivono più; pulizia preparata", () => {
    expect(read("components/ProfileHeaderClient.tsx")).toContain("showPersonalDetails = false,");
    const a = read("app/actions/profile.ts");
    expect(a).not.toContain("date_of_birth: input.dateOfBirth");
    expect(a).not.toContain("gender: input.gender");
    const sql = read("supabase/privacy_pulizia_genitore_20261120.sql");
    expect(sql).toContain("set date_of_birth = null, gender = null");
    expect(sql).not.toContain("-- STATO: PREPARATA, NON APPLICATA");
  });

  test("IPV-06 l'email d'invito alla famiglia dice all'invitato come trattiamo i suoi dati (art. 14)", () => {
    const f = read("app/actions/family.ts");
    expect(f).toContain("Come trattiamo i dati: tramapp.it/privacy.");
    expect(f).toContain("privacy@tramapp.it.`");
  });
});
