import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { evaluateFlag } from "../../lib/feature-flags/evaluate";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { formatBuildLabel, getBuildInfo } from "../../lib/build-info";

// TRAMA — TEST PIPELINE NUOVO ACCOUNT (30/09/2026). Bolla temporanea
// "Test nuovo Claude · build <sha> · <data ora>" dietro
// BUILD_INFO_BUBBLE_ENABLED. Stesso principio "[no browser]" del resto della
// suite tests/one: logica pura + lettura statica dei call site reali. La
// verifica visiva live (flag acceso sul proprio account, bolla visibile nelle
// tre aree, poi flag spento e bolla sparita) resta a Fabrizio:
// pending local verification.
//
// Comando: npx playwright test tests/one/build-info-bubble.spec.ts

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf-8");
}

test.describe("TRAMA — BUILD_INFO_BUBBLE_ENABLED: flag [no browser]", () => {
  test("BIB-01: registrato con defaultValue=false e scope user consentito", () => {
    const def = FEATURE_FLAG_REGISTRY.BUILD_INFO_BUBBLE_ENABLED;
    expect(def).toBeDefined();
    expect(def.defaultValue).toBe(false);
    expect(def.allowedScopes).toContain("user");
  });

  test("BIB-02: nessun override → false (nessuno vede la bolla dopo il deploy)", () => {
    expect(evaluateFlag("BUILD_INFO_BUBBLE_ENABLED", { environment: "production", userId: "u1" }, [])).toBe(false);
  });

  test("BIB-03: override user → true solo per quell'utente", () => {
    const overrides = [{ scopeType: "user" as const, scopeValue: "fabrizio", enabled: true, expiresAt: null }];
    expect(evaluateFlag("BUILD_INFO_BUBBLE_ENABLED", { userId: "fabrizio" }, overrides)).toBe(true);
    expect(evaluateFlag("BUILD_INFO_BUBBLE_ENABLED", { userId: "altro" }, overrides)).toBe(false);
  });
});

test.describe("TRAMA — build info: label [no browser]", () => {
  test("BIB-04: SHA accorciato a 7 caratteri e ora di Roma", () => {
    const info = getBuildInfo({
      TRAMA_BUILD_SHA: "aa9764e1bd6d0dc4cfcbf2ce70650410059f83ff",
      TRAMA_BUILD_TIME: "2026-09-30T12:01:00.000Z",
    });
    expect(info.shortSha).toBe("aa9764e");
    expect(formatBuildLabel(info)).toBe("build aa9764e · 30/09 14:01");
  });

  test("BIB-05: ora legale/solare gestita (dicembre = UTC+1)", () => {
    const info = getBuildInfo({ TRAMA_BUILD_SHA: "abcdef1234", TRAMA_BUILD_TIME: "2026-12-01T22:59:00.000Z" });
    expect(formatBuildLabel(info)).toBe("build abcdef1 · 01/12 23:59");
  });

  test("BIB-06: SHA assente → 'sha n/d', mai un valore inventato", () => {
    const info = getBuildInfo({ TRAMA_BUILD_TIME: "2026-09-30T12:01:00.000Z" });
    expect(info.shortSha).toBeNull();
    expect(formatBuildLabel(info)).toBe("build sha n/d · 30/09 14:01");
  });

  test("BIB-07: ora assente o non valida → solo SHA", () => {
    expect(formatBuildLabel(getBuildInfo({ TRAMA_BUILD_SHA: "aa9764e1" }))).toBe("build aa9764e");
    expect(formatBuildLabel(getBuildInfo({ TRAMA_BUILD_SHA: "aa9764e1", TRAMA_BUILD_TIME: "boh" }))).toBe("build aa9764e");
  });

  test("BIB-08: fallback su VERCEL_GIT_COMMIT_SHA se TRAMA_BUILD_SHA è vuoto", () => {
    expect(getBuildInfo({ TRAMA_BUILD_SHA: "", VERCEL_GIT_COMMIT_SHA: "1234567890" }).shortSha).toBe("1234567");
  });
});

test.describe("TRAMA — BuildInfoBubble: call site [no browser]", () => {
  const layouts: Array<[string, string]> = [
    ["../../app/nextgen/layout.tsx", "family"],
    ["../../app/center/layout.tsx", "center"],
    ["../../app/admin/layout.tsx", "admin"],
  ];

  for (const [file, tenant] of layouts) {
    test(`BIB-09 (${tenant}): ${file} risolve il flag server-side e monta la bolla`, () => {
      const src = readSource(file);
      expect(src).toContain('import BuildInfoBubble from "@/components/BuildInfoBubble"');
      expect(src).toContain(`resolveBuildInfoBubbleLabel({ userId: user.id, role: realRole, tenant: "${tenant}" })`);
      expect(src).toContain("<BuildInfoBubble label={buildInfoLabel} />");
      expect(src).toContain("let buildInfoLabel: string | null = null;");
    });
  }

  test("BIB-10: la bolla non intercetta tap/click e non renderizza nulla senza label", () => {
    const src = readSource("../../components/BuildInfoBubble.tsx");
    expect(src).toContain("pointer-events-none");
    expect(src).toContain("if (!label) return null;");
    expect(src).toContain("Test nuovo Claude");
  });

  test("BIB-11: il resolver usa il flag giusto ed è server-only", () => {
    const src = readSource("../../lib/build-info-bubble.ts");
    expect(src.startsWith('import "server-only";')).toBe(true);
    expect(src).toContain('flagName: "BUILD_INFO_BUBBLE_ENABLED"');
  });

  test("BIB-12: next.config.mjs espone SHA e ora di build", () => {
    const src = readSource("../../next.config.mjs");
    expect(src).toContain("TRAMA_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA");
    expect(src).toContain("TRAMA_BUILD_TIME: new Date().toISOString()");
  });
});
