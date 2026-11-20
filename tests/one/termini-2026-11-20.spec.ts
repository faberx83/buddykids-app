// 20/11/2026 (Fabrizio: "togli la bozza1 dai termini di servizio").
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { test, expect } from "@playwright/test";
import { LATEST_LEGAL_VERSION, isDraftLegalVersion, legalTextFor } from "../../lib/legal/texts";
import { parseLegalText } from "../../lib/legal/parse";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");
const sha = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");
const V = "2026-11-20";

test.describe("Termini di servizio 2026-11-20 [no browser]", () => {
  test("TDS-01 ultima versione, non è una bozza, nessun segnaposto", () => {
    expect(LATEST_LEGAL_VERSION.terms).toBe(V);
    expect(isDraftLegalVersion(V)).toBe(false);
    const t = legalTextFor("terms", V)!;
    expect(t).not.toMatch(/\[[^\]]*\]/);
    expect(t).toContain("TRAMA è un servizio di Fabrizio Pirulli, persona fisica");
  });

  test("TDS-02 restano le garanzie della bozza 1 e c'è la regola sui gruppi", () => {
    const t = legalTextFor("terms", V)!;
    for (const s of ["non è un'iscrizione", "In TRAMA non si paga nulla", "maggiorenne", "legge italiana", "privacy@tramapp.it"]) expect(t).toContain(s);
    expect(t).toContain("**Un gruppo di famiglie non prenota posti.**");
    expect(t).not.toContain("centri estivi");
    expect(parseLegalText(t).filter((b) => b.kind === "h2").length).toBe(11);
  });

  test("TDS-03 pubblicazione con l'impronta esatta", () => {
    const sql = read("supabase/legal_publish_terms_2026-11-20.sql");
    expect(sql).toContain(`('terms', '${V}', '${sha(legalTextFor("terms", V)!)}', now())`);
    expect(sql).not.toContain("-- STATO: PREPARATA, NON APPLICATA");
  });
});
