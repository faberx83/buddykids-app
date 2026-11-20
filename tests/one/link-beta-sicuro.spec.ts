// 20/11/2026 (Fabrizio: "verifica che, una volta fatta la lista dei genitori,
// e generati i link personali, possano accedere tutti nella cohort del pilot"
// → "ok sistemiamo il punto 2 come da tua proposta").
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { BETA_CODE_STORAGE_KEY, betaJoinMessage, isBetaCodeUsable, normalizeBetaCode } from "../../lib/beta-cohorts/code";

const read = (f: string) => fs.readFileSync(path.join(__dirname, "../..", f), "utf8");
const NOW = Date.parse("2026-11-20T12:00:00Z");
const row = (o: Partial<{ active: boolean; expires_at: string | null; max_redemptions: number | null; redeemed_count: number }> = {}) => ({
  active: true,
  expires_at: null,
  max_redemptions: null,
  redeemed_count: 0,
  ...o,
});

test.describe("Link beta più sicuro [no browser]", () => {
  test("LBS-01 il codice si normalizza come in Admin (maiuscolo) e rifiuta il resto", () => {
    expect(normalizeBetaCode(" giulia-7k ")).toBe("GIULIA-7K");
    expect(normalizeBetaCode("TRAMABETA26")).toBe("TRAMABETA26");
    for (const bad of ["", null, undefined, "a b", "<script>", "x".repeat(65)]) expect(normalizeBetaCode(bad)).toBeNull();
  });

  test("LBS-02 stesse condizioni del trigger: attivo, non scaduto, non esaurito", () => {
    expect(isBetaCodeUsable(row(), NOW)).toBe(true);
    expect(isBetaCodeUsable(null, NOW)).toBe(false);
    expect(isBetaCodeUsable(row({ active: false }), NOW)).toBe(false);
    expect(isBetaCodeUsable(row({ expires_at: "2026-11-01T00:00:00Z" }), NOW)).toBe(false);
    expect(isBetaCodeUsable(row({ expires_at: "2027-01-31T22:59:00Z" }), NOW)).toBe(true);
    expect(isBetaCodeUsable(row({ max_redemptions: 2, redeemed_count: 2 }), NOW)).toBe(false);
    expect(isBetaCodeUsable(row({ max_redemptions: 2, redeemed_count: 1 }), NOW)).toBe(true);
  });

  test("LBS-03 il link si ricorda nel browser e vale anche registrandosi dall'icona", () => {
    const f = read("app/auth/login/LoginForm.tsx");
    expect(BETA_CODE_STORAGE_KEY).toBe("trama_beta_code");
    expect(f).toContain("if (urlBeta) window.localStorage.setItem(BETA_CODE_STORAGE_KEY, urlBeta);");
    expect(f).toContain("const betaParam = urlBeta ?? storedBeta;");
    expect(f).toContain("if (betaParam) metadata.beta_invite_code = betaParam;");
  });

  test("LBS-04 chi è già collegato e apre il link entra nella beta, senza modulo di registrazione", () => {
    const p = read("app/auth/login/page.tsx");
    expect(p).toContain("if (user) return <BetaJoinLoggedIn code={betaCodeNormalized} />;");
    const a = read("app/actions/beta-join.ts");
    expect(a).toContain('if ((profile as { role?: string } | null)?.role !== "parent") return { outcome: "not_parent" };');
    const m = read("lib/beta-cohorts/membership.ts");
    expect(m).toContain("export async function joinBetaCohortWithCode");
    expect(m).toContain('if (existing) return (existing as { active: boolean }).active ? "already" : "invalid";');
    expect(m).toContain('.is("beta_invited_by_code", null)');
  });

  test("LBS-05 messaggi chiari per ogni esito", () => {
    expect(betaJoinMessage("joined").title).toBe("Sei nella beta di TRAMA");
    expect(betaJoinMessage("already").title).toBe("Sei già nella beta");
    expect(betaJoinMessage("invalid").title).toBe("Link non più valido");
    expect(betaJoinMessage("not_parent").title).toBe("Link per le famiglie");
  });
});
