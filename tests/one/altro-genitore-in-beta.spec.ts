// 19/11/2026 (Fabrizio: "ok allora correggi per l'altro genitore"): chi entra
// in una famiglia con l'invito eredita la coorte beta degli altri adulti,
// altrimenti vedrebbe l'app senza le funzioni accese per la beta.
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { cohortsToInherit, FAMILY_INHERITABLE_COHORTS, type CohortRow } from "../../lib/beta-cohorts/family-inherit";

const read = (f: string) => fs.readFileSync(path.join(__dirname, "../..", f), "utf8");
const NOW = Date.parse("2026-11-20T10:00:00Z");
const BETA = "trama-one-controlled-beta";
const row = (user_id: string, cohort_key: string, active = true, expires_at: string | null = null): CohortRow => ({ user_id, cohort_key, active, expires_at });

test.describe("Altro genitore nella stessa beta [no browser]", () => {
  test("AGB-01 eredita la coorte beta di chi l'ha invitato, con la stessa scadenza", () => {
    const out = cohortsToInherit("b", [row("a", BETA, true, "2027-01-31T22:59:00Z")], NOW);
    expect(out).toEqual([{ cohort_key: BETA, expires_at: "2027-01-31T22:59:00Z", from_user_id: "a" }]);
  });

  test("AGB-02 niente se chi invita non è in beta, se la riga è spenta o scaduta, o fuori elenco", () => {
    expect(cohortsToInherit("b", [], NOW)).toEqual([]);
    expect(cohortsToInherit("b", [row("a", BETA, false)], NOW)).toEqual([]);
    expect(cohortsToInherit("b", [row("a", BETA, true, "2026-11-01T00:00:00Z")], NOW)).toEqual([]);
    expect(cohortsToInherit("b", [row("a", "partner-pilot")], NOW)).toEqual([]);
    expect(FAMILY_INHERITABLE_COHORTS).toEqual([BETA, "internal-preview"]);
  });

  test("AGB-03 mai sopra una scelta di Admin: se l'invitato ha già la riga (anche spenta) non si tocca", () => {
    expect(cohortsToInherit("b", [row("a", BETA), row("b", BETA, false)], NOW)).toEqual([]);
  });

  test("AGB-04 più adulti: vince la scadenza più lontana, null = senza scadenza", () => {
    const out = cohortsToInherit("c", [row("a", BETA, true, "2026-12-31T00:00:00Z"), row("b", BETA, true, null)], NOW);
    expect(out[0]).toMatchObject({ expires_at: null, from_user_id: "b" });
  });

  test("AGB-05 agganciata a invito via link e via codice, best-effort, solo service role", () => {
    const a = read("app/actions/family.ts");
    expect(a).toContain("if ((await inheritFamilyCohorts(family.id as string, user.id)).length > 0) revalidatePath(\"/nextgen\", \"layout\");");
    expect(a).toContain("if (row.family_id && (await inheritFamilyCohorts(row.family_id, user.id)).length > 0) revalidatePath(\"/nextgen\", \"layout\");");
    const m = read("lib/beta-cohorts/membership.ts");
    expect(m).toContain('import "server-only";');
    expect(m).toContain('{ onConflict: "user_id,cohort_key", ignoreDuplicates: true }');
    expect(m).toContain("console.error(\"[beta] coorte dell'altro genitore non assegnata\"");
  });
});
