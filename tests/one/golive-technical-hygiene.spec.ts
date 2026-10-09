import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

// TRAMA — GO-LIVE · COMPLIANCE, pacchetto tecnico (09/10/2026).
// 1) Nessuna risorsa da CDN di terze parti nel browser delle famiglie
//    (font, icone, marker): prerequisito per non avere un cookie banner.
// 2) sharp >= 0.35.4 (GHSA-rgj7-g3m4-5g8c) tramite override.
// 3) Migration 41: search_path fisso e revoche mirate, SENZA toccare gli
//    helper usati dalle policy RLS lette anche da anon.
// [no browser]: lettura statica dei file reali. Il controllo visivo (font e
// icone identici a prima) resta "pending local verification".
//
// Comando: npx playwright test tests/one/golive-technical-hygiene.spec.ts

const ROOT = path.join(__dirname, "../..");

function read(relativeToRoot: string): string {
  return fs.readFileSync(path.join(ROOT, relativeToRoot), "utf-8");
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(rel));
    else if (/\.(tsx?|css|mjs|js)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const THIRD_PARTY_ASSET_HOSTS = /(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com)/;

test.describe("Risorse statiche senza CDN di terze parti [no browser]", () => {
  test("GLH-01: app/, components/ e lib/ non caricano font, icone o immagini da CDN esterne", () => {
    const offenders = ["app", "components", "lib"]
      .flatMap(listSourceFiles)
      .filter((file) => THIRD_PARTY_ASSET_HOSTS.test(read(file)));
    expect(offenders).toEqual([]);
  });

  test("GLH-02: Inter e Poppins arrivano da next/font, con gli stessi pesi di prima e le variabili sull'<html>", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain('import { Inter, Poppins } from "next/font/google";');
    expect(layout).toMatch(/Inter\(\{[\s\S]*weight: \["400", "500", "600", "700"\][\s\S]*variable: "--font-inter"/);
    expect(layout).toMatch(/Poppins\(\{[\s\S]*weight: \["500", "600", "700", "800"\][\s\S]*variable: "--font-poppins"/);
    expect(layout).toContain('<html lang="it" className={`${inter.variable} ${poppins.variable}`}>');
    expect(layout).not.toContain("<link");
  });

  test("GLH-03: Tailwind usa le variabili dei font, con il nome come ripiego", () => {
    const tw = read("tailwind.config.ts");
    expect(tw).toContain('sans: ["var(--font-inter)", "Inter", "sans-serif"]');
    expect(tw).toContain('poppins: ["var(--font-poppins)", "Poppins", "sans-serif"]');
  });

  test("GLH-04: icone Tabler dal pacchetto npm, stessa versione 3.19.0 della CDN di prima", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain('import "@tabler/icons-webfont/dist/tabler-icons.min.css";');
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.dependencies["@tabler/icons-webfont"]).toBe("3.19.0");
  });

  test("GLH-05: marker Leaflet di default dalle immagini del pacchetto leaflet", () => {
    const map = read("components/ActivityMap.tsx");
    for (const img of ["marker-icon-2x.png", "marker-icon.png", "marker-shadow.png"]) {
      expect(map).toContain(`from "leaflet/dist/images/${img}";`);
    }
    expect(map).toContain("iconUrl: markerIcon.src,");
  });
});

test.describe("Dipendenze [no browser]", () => {
  test("GLH-06: sharp forzato a >= 0.35.4 (GHSA-rgj7-g3m4-5g8c)", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.overrides?.sharp).toBe("^0.35.4");
  });
});

test.describe("Migration 41 — igiene sicurezza funzioni [no browser]", () => {
  const sql = read("supabase/migration_41_security_hygiene_functions.sql");
  const statements = sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  function block(title: string): string {
    const start = sql.indexOf(title);
    expect(start, title).toBeGreaterThan(-1);
    const next = sql.indexOf("-- ════", sql.indexOf("\n", sql.indexOf("-- ════", start) + 1) + 1);
    return sql.slice(start, next === -1 ? undefined : next);
  }

  test("GLH-07: nessuna tabella, policy o dato toccato; solo alter/revoke/grant su funzioni", () => {
    expect(statements).not.toMatch(/\b(create|drop|alter)\s+(table|policy|index)\b/i);
    expect(statements).not.toMatch(/\b(insert|update|delete)\s+(into|from)?\s*public\./i);
    expect(statements).toContain("set search_path = public, extensions, pg_temp");
  });

  test("GLH-08: search_path sulle 26 funzioni dell'advisor, con controllo del conteggio", () => {
    expect(statements).toContain("if touched <> 26 then");
    const sp = block("1) search_path fisso");
    for (const fn of ["current_role", "is_platform_admin", "get_family_member_ids", "external_planner_items_set_updated_at"]) {
      expect(sp).toContain(`'${fn}'`);
    }
  });

  test("GLH-09: le RPC per utenti loggati perdono anon E PUBLIC, e restano ad authenticated", () => {
    const rpc = block("2a) RPC solo per utenti loggati");
    expect(rpc).toContain("revoke execute on function %s from public, anon");
    expect(rpc).toContain("grant execute on function %s to authenticated, service_role");
    expect(rpc).toContain("if touched <> 9 then");
    for (const fn of ["accept_group_invite", "redeem_invite_discount", "admin_review_center_onboarding", "list_public_groups"]) {
      expect(rpc).toContain(`'${fn}'`);
    }
  });

  test("GLH-10: gli helper usati dalle policy RLS e le funzioni pubbliche per scelta NON vengono revocati", () => {
    const revokeBlocks = block("2a) RPC solo per utenti loggati") + block("2b) Funzioni trigger");
    for (const fn of [
      "is_platform_admin",
      "current_center_id",
      "current_role",
      "is_family_member",
      "is_group_member",
      "is_community_member",
      "get_family_member_ids",
      "get_shared_plan",
      "get_invite_preview",
      "get_beta_invite_preview",
      "is_current_published_legal_document",
    ]) {
      expect(revokeBlocks, fn).not.toContain(`'${fn}'`);
    }
  });

  test("GLH-11: funzioni trigger chiuse a tutti i ruoli API", () => {
    const trg = block("2b) Funzioni trigger");
    expect(trg).toContain("'handle_new_user', 'init_center_onboarding_lead'");
    expect(trg).toContain("revoke execute on function %s from public, anon, authenticated");
  });

  test("GLH-12: post-check e rollback documentati", () => {
    expect(sql).toContain("POST-CHECK");
    expect(sql).toContain("ROLLBACK");
    expect(sql).toContain("has_function_privilege('anon'");
  });
});
