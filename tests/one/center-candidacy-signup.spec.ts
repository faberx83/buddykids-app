// Candidatura centro → registrazione gestore (27/10/2026).
// migration_30 aveva riscritto handle_new_user() perdendo il ramo della
// candidatura (migration_21): chi si registrava dopo l'approvazione restava
// "genitore". migration_52 lo ripristina. Questi controlli statici evitano
// che una futura riscrittura del trigger lo perda di nuovo: l'ULTIMA
// migration che ridefinisce handle_new_user() deve contenere tutti e tre i
// rami (candidatura, invito-sconto, codice beta).
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

const ROOT = path.resolve(__dirname, "..", "..");
const SUPA = path.join(ROOT, "supabase");

function lastHandleNewUserMigration(): { file: string; sql: string } {
  const files = fs
    .readdirSync(SUPA)
    .filter((f) => /^migration_\d+.*\.sql$/.test(f))
    .sort((a, b) => Number(a.match(/^migration_(\d+)/)![1]) - Number(b.match(/^migration_(\d+)/)![1]));
  let last: { file: string; sql: string } | null = null;
  for (const f of files) {
    const sql = fs.readFileSync(path.join(SUPA, f), "utf8");
    if (/create\s+or\s+replace\s+function\s+public\.handle_new_user\s*\(/i.test(sql)) last = { file: f, sql };
  }
  if (!last) throw new Error("nessuna migration ridefinisce handle_new_user()");
  return last;
}

test.describe("Candidatura centro: il trigger di registrazione", () => {
  test("CC-01: l'ultima versione di handle_new_user() ha il ramo candidatura", () => {
    const { file, sql } = lastHandleNewUserMigration();
    expect(file, "attesa migration_52 o successiva").not.toBe("migration_30_beta_invite_codes.sql");
    expect(sql).toContain("lead_type = 'self_candidacy'");
    expect(sql).toContain("lower(candidate_email) = lower(new.email)");
    expect(sql).toMatch(/case when v_candidacy_center_id is not null then 'center_admin' else 'parent' end/);
  });

  test("CC-02: restano anche i rami invito-sconto e codice beta", () => {
    const { sql } = lastHandleNewUserMigration();
    expect(sql).toContain("update public.invites");
    expect(sql).toContain("update public.beta_invite_codes");
    expect(sql).toContain("insert into public.beta_cohort_memberships");
    expect(sql).toContain("beta_invited_by_code");
  });

  test("CC-03: il ramo candidatura non può far fallire una registrazione", () => {
    const { sql } = lastHandleNewUserMigration();
    const branch = sql.slice(sql.indexOf("select claimed_center_id"), sql.indexOf("insert into public.profiles"));
    expect(branch).toMatch(/exception when others then\s+v_candidacy_center_id := null;/);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path to 'public', 'pg_catalog'/i);
  });

  test("CC-04: la migration è preparata, non applicata da sola", () => {
    const sql = fs.readFileSync(path.join(SUPA, "migration_52_candidatura_centro_ripristino.sql"), "utf8");
    expect(sql.split("\n")[1]).toBe("-- STATO: PREPARATA, NON APPLICATA");
  });
});
