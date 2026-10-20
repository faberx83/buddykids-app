// TRAMA — TRASLOCO SU tramapp.it, LINK CORTI, GENITORI MODIFICABILI
// (16/10/2026, Fabrizio: "chi è dentro con buddykids venga riportato e
// riloggato su tramapp.it", "vanno aggiornati gli indirizzi ovunque… metterei
// uno short link", "la lista dei genitori deve essere modificabile"). [no browser]

import fs from "fs";
import path from "path";
import { createHmac } from "crypto";
import { test, expect } from "@playwright/test";
import {
  decodeHandoff,
  encodeHandoff,
  isMoveCandidate,
  readHandoffFragment,
  safeNextPath,
  HANDOFF_TTL_SECONDS,
  type MoveRequestInfo,
} from "../../lib/domain-move";
import {
  canonicalHostForLegacy,
  familyInviteDestination,
  familyOriginFromLocation,
  isCanonicalHost,
  newShortInviteToken,
  productionFamilyOrigin,
  shortInviteUrl,
} from "../../lib/public-links";
import { familyHost } from "../../lib/tenant";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { getReleaseById } from "../../lib/releases/catalog";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");
const sign = (d: string) => createHmac("sha256", "chiave-di-prova").update(d).digest("base64url");
const page = (over: Partial<MoveRequestInfo> = {}): MoveRequestInfo => ({
  method: "GET",
  pathname: "/nextgen",
  fetchDest: "document",
  accept: "text/html",
  rsc: null,
  prefetch: false,
  ...over,
});

test.describe("TRAMA — Trasloco su tramapp.it [no browser]", () => {
  test("TD-01 vecchi indirizzi → nuovi, per ciascun portale", () => {
    expect(canonicalHostForLegacy("buddykids-app.vercel.app")).toBe("tramapp.it");
    expect(canonicalHostForLegacy("BUDDYKIDS-PARTNER.vercel.app:443")).toBe("partner.tramapp.it");
    expect(canonicalHostForLegacy("buddykids-admin.vercel.app")).toBe("admin.tramapp.it");
    // anteprime e locale: nessun trasloco
    expect(canonicalHostForLegacy("buddykids-app-git-claude-x.vercel.app")).toBeNull();
    expect(canonicalHostForLegacy("localhost:3000")).toBeNull();
    expect(isCanonicalHost("partner.tramapp.it")).toBe(true);
    expect(isCanonicalHost("tramapp.it.evil.com")).toBe(false);
  });

  test("TD-02 si sposta solo l'apertura di una pagina, mai API, file, navigazioni interne o ritorni dal login", () => {
    expect(isMoveCandidate(page())).toBe(true);
    expect(isMoveCandidate(page({ pathname: "/auth/login" }))).toBe(true);
    expect(isMoveCandidate(page({ fetchDest: null, accept: "text/html,application/xhtml+xml" }))).toBe(true);
    for (const pathname of ["/api/cron/travel-reminders", "/_next/static/x.js", "/sw.js", "/manifest.json", "/icon-192.png", "/auth/callback", "/auth/reset-password", "/auth/trasloco/avvio", "/internal/deploy-notify"]) {
      expect(isMoveCandidate(page({ pathname })), pathname).toBe(false);
    }
    expect(isMoveCandidate(page({ method: "POST" }))).toBe(false);
    expect(isMoveCandidate(page({ rsc: "1" }))).toBe(false);
    expect(isMoveCandidate(page({ prefetch: true }))).toBe(false);
    expect(isMoveCandidate(page({ fetchDest: "empty" }))).toBe(false);
  });

  test("TD-03 il percorso di ritorno resta dentro TRAMA", () => {
    expect(safeNextPath("/nextgen/planner?w=2")).toBe("/nextgen/planner?w=2");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null, "/a\nb"]) {
      expect(safeNextPath(bad as string | null), String(bad)).toBe("/");
    }
  });

  test("TD-04 passaggio del login: firmato, scade in 2 minuti, non manomettibile", () => {
    const now = 1_800_000_000;
    const frag = encodeHandoff({ at: "access", rt: "refresh", n: "/nextgen/profile", ts: now }, sign);
    const parts = readHandoffFragment(`#${frag}`);
    expect(parts).not.toBeNull();
    const ok = decodeHandoff(parts!.p, parts!.s, sign, now + 30);
    expect(ok).toEqual({ ok: true, payload: { at: "access", rt: "refresh", n: "/nextgen/profile", ts: now } });
    expect(decodeHandoff(parts!.p, parts!.s, sign, now + HANDOFF_TTL_SECONDS + 1)).toEqual({ ok: false, reason: "expired" });
    const other = (d: string) => createHmac("sha256", "altra-chiave").update(d).digest("base64url");
    expect(decodeHandoff(parts!.p, parts!.s, other, now)).toEqual({ ok: false, reason: "bad_signature" });
    expect(decodeHandoff(parts!.p + "x", parts!.s, sign, now).ok).toBe(false);
    // un percorso esterno infilato nel passaggio torna "/"
    const evil = encodeHandoff({ at: "a", rt: "r", n: "//evil.com", ts: now }, sign);
    const e = readHandoffFragment(evil)!;
    const res = decodeHandoff(e.p, e.s, sign, now);
    expect(res.ok && res.payload.n).toBe("/");
  });

  test("TD-05 proxy: solo vecchi indirizzi, cookie 'già traslocato' e 'release spenta', link corti pubblici", () => {
    const proxy = read("proxy.ts");
    expect(proxy).toContain("const legacyTarget = canonicalHostForLegacy(hostname);");
    expect(proxy).toContain('if (request.cookies.get(MOVE_DONE_COOKIE)?.value === "done") {');
    expect(proxy).toContain('if (request.cookies.get(MOVE_SKIP_COOKIE)?.value !== "1") {');
    expect(proxy).toContain('!pathname.startsWith("/i/") &&');
    // il controllo avviene PRIMA di rinfrescare la sessione sul vecchio indirizzo
    expect(proxy.indexOf("const legacyTarget")).toBeLessThan(proxy.indexOf("const sessionResponse = await updateSession(request);"));
  });

  test("TD-06 avvio: release controllata, sessione nel frammento, vecchia sessione dimenticata senza logout", () => {
    const r = read("app/auth/trasloco/avvio/route.ts");
    expect(r).toContain('const FLAG = "DOMAIN_MOVE_TRAMAPP_ENABLED";');
    expect(r).toContain("if (!enabled) return stay();");
    expect(r).toContain("`${target}${MOVE_LANDING_PATH}#${fragment}`");
    expect(r).toContain('if (c.name.startsWith("sb-")) res.cookies.set(c.name, "", { path: "/", maxAge: 0 });');
    expect(r).not.toContain("signOut(");
    const a = read("app/actions/domain-move.ts");
    expect(a).toContain("decodeHandoff(parts.p, parts.s, signer, Math.floor(Date.now() / 1000))");
    expect(a).toContain("supabase.auth.setSession({");
    const p = read("app/auth/trasloco/page.tsx");
    expect(p).toContain('window.history.replaceState(null, "", window.location.pathname);');
  });

  test("TD-07 accendibile dalla card Release: flag spento di default, voce di catalogo e release dedicate", () => {
    expect(FEATURE_FLAG_REGISTRY.DOMAIN_MOVE_TRAMAPP_ENABLED.defaultValue).toBe(false);
    const entry = FEATURE_CATALOG.find((e) => e.key === "domain_move_tramapp");
    expect(entry?.flagName).toBe("DOMAIN_MOVE_TRAMAPP_ENABLED");
    expect(entry?.releaseEligible).toBe(true);
    expect(getReleaseById("trasloco-tramapp")?.featureKeys).toEqual(["domain_move_tramapp"]);
  });
});

test.describe("TRAMA — Indirizzi e link corti [no browser]", () => {
  test("LC-01 in produzione i link alle famiglie vanno sempre su tramapp.it", () => {
    for (const h of ["tramapp.it", "partner.tramapp.it", "buddykids-app.vercel.app", "buddykids-admin.vercel.app"]) {
      expect(familyHost(h), h).toBe("tramapp.it");
      expect(productionFamilyOrigin(h), h).toBe("https://tramapp.it");
    }
    expect(familyHost("localhost:3999")).not.toBe("tramapp.it");
    expect(familyOriginFromLocation({ host: "buddykids-partner.vercel.app", origin: "https://buddykids-partner.vercel.app" })).toBe("https://tramapp.it");
    expect(familyOriginFromLocation({ host: "localhost:3999", origin: "http://localhost:3999" })).toBe("http://localhost:3999");
  });

  test("LC-02 link corto: token d'invito o codice famiglia", () => {
    const t = newShortInviteToken();
    expect(t).toMatch(/^[A-Za-z2-9]{12}$/);
    expect(newShortInviteToken()).not.toBe(t);
    expect(shortInviteUrl("https://tramapp.it/", t)).toBe(`https://tramapp.it/i/${t}`);
    expect(familyInviteDestination(t)).toBe(`/nextgen/planner/famiglia?accept=${t}`);
    expect(familyInviteDestination("K7PX3M")).toBe("/nextgen/profile/famiglia?code=K7PX3M");
    // i vecchi inviti (UUID) continuano a funzionare
    expect(familyInviteDestination("3f2a9c1e-7b4d-4e2a-9c1e-7b4d4e2a9c1e")).toBe("/nextgen/planner/famiglia?accept=3f2a9c1e-7b4d-4e2a-9c1e-7b4d4e2a9c1e");
    for (const bad of ["", "../x", "a b", "<script>", "x".repeat(80)]) expect(familyInviteDestination(bad), bad).toBeNull();
  });

  test("LC-03 inviti famiglia, gruppi, condivisioni e inviti centro usano i nuovi indirizzi", () => {
    const fam = read("app/actions/family.ts");
    expect(fam).toContain("const token = newShortInviteToken();");
    expect(fam).toContain("const link = shortInviteUrl(origin, token);");
    expect(fam).toContain("link: shortInviteUrl(origin, fam.invite_code as string),");
    expect(fam).not.toContain("/auth/login?next=${encodeURIComponent(acceptPath)}");
    expect(read("app/actions/groups.ts")).toContain('const host = familyHost(h.get("host") || "localhost:3000");');
    expect(read("app/actions/plan-shares.ts")).toContain('const host = familyHost(headerList.get("host") || "");');
    expect(read("components/GroupDetailClient.tsx")).toContain("${familyOriginFromLocation(window.location)}/groups/join/${groupId}");
    expect(read("app/center/invites/InvitesClient.tsx")).toContain("${familyOriginFromLocation(window.location)}/auth/login?invite=${code}");
    expect(read("app/nextgen/planner/famiglia/FamigliaClient.tsx")).toContain("return shortInviteUrl(familyOriginFromLocation(window.location), token);");
    const route = read("app/i/[key]/route.ts");
    expect(route).toContain("const target = loggedIn ? dest : `/auth/login?next=${encodeURIComponent(dest)}`;");
  });

  test("LC-04 deploy e test puntano a tramapp.it; i vecchi alias restano riallineati", () => {
    const d = read("deploy.sh");
    expect(d).toContain('TEST_SCOPE="$TEST_SCOPE" bash test-deploy.sh https://tramapp.it');
    expect(d).toContain('local target="${TEST_BASE_URL:-https://tramapp.it}"');
    expect(d).toContain("vercel alias set buddykids-app.vercel.app buddykids-partner.vercel.app");
    expect(read("test-deploy.sh")).toContain('BASE_URL="${1:-https://tramapp.it}"');
  });
});

test.describe("TRAMA — Genitori modificabili [no browser]", () => {
  test("GM-01 togliere un genitore: solo chi ha creato la famiglia, mai sé stesso né il creatore", () => {
    const a = read("app/actions/family.ts");
    expect(a).toContain("export async function removeFamilyMemberAction(parentId: string)");
    expect(a).toContain('if (membership.role !== "creatore" && membership.role !== "admin") {');
    expect(a).toContain("if (!parentId || parentId === ctx.user.id)");
    expect(a).toContain('if (target.role === "creatore") return { error: "Non puoi togliere chi ha creato la famiglia" };');
    expect(a).toContain('.delete().eq("family_id", ctx.familyId).eq("parent_id", parentId)');
  });

  test("GM-02 annullare un invito: solo della propria famiglia e solo se ancora in attesa", () => {
    const a = read("app/actions/family.ts");
    expect(a).toContain("export async function cancelFamilyInviteAction(inviteId: string)");
    expect(a).toContain('.update({ status: "expired" })');
    expect(a).toContain('.eq("family_id", ctx.familyId)\n    .in("status", ["pending", "sent"])');
  });

  test("GM-03 nella pagina: Togli sugli altri genitori, Rimanda e Annulla sugli inviti", () => {
    const c = read("app/nextgen/profile/famiglia/FamigliaV2Client.tsx");
    expect(c).toContain('const removable = canInvite && m.role !== "creatore";');
    expect(c).toContain("aria-label={`Togli ${name} dalla famiglia`}");
    expect(c).toContain("aria-label={`Rimanda il link a ${i.invitedEmail}`}");
    expect(c).toContain("aria-label={`Annulla l'invito a ${i.invitedEmail}`}");
    expect(c).toContain("const url = shortInviteUrl(familyOriginFromLocation(window.location), token);");
  });
});

test.describe("TRAMA — V1 spenta ma tenuta lì [no browser]", () => {
  test("V1-01 la vecchia Home porta chi è collegato su /nextgen; /?v1=1 e ?denied restano", () => {
    const home = read("app/(main)/page.tsx");
    expect(home).toContain('if (isSupabaseConfigured && !denied && v1 !== "1") {');
    expect(home).toContain('if (user) redirect("/nextgen");');
    expect(read("components/VersionToggle.tsx")).toContain('get("v1") === "1") return;');
  });

  test("V1-02 dopo il login, ?next=/ non conta come destinazione scelta", () => {
    const f = read("app/auth/login/LoginForm.tsx");
    expect(f).toContain('const explicitNext = next && next !== "/" ? next : null;');
    expect(f).toContain("explicitNext || (tenant === \"family\"");
  });

  test("V1-03 i test della vecchia Home la aprono con /?v1=1", () => {
    for (const p of ["tests/genitori/home.spec.ts", "tests/genitori/home-planner.spec.ts", "tests/gestore/attendance.spec.ts"]) {
      const s = read(p);
      expect(s, p).toContain('await page.goto("/?v1=1");');
      expect(s, p).not.toContain('await page.goto("/");');
    }
  });
});

test.describe("TRAMA — Caricamento col logo [no browser]", () => {
  test("V1-04 il proxy porta da / a /nextgen prima di disegnare la vecchia Home", () => {
    const proxy = read("proxy.ts");
    expect(proxy).toContain('pathname === "/" &&\n        request.nextUrl.searchParams.get("v1") !== "1" &&');
    expect(proxy).toContain('home.pathname = "/nextgen";');
    expect(read("app/auth/login/LoginForm.tsx")).toContain(
      'router.push(tenant === "family" && destination === "/" ? "/nextgen" : destination);'
    );
  });

  test("LD-01 logo animato in tutte le schermate di caricamento, fermo con 'riduci movimento'", () => {
    const css = read("app/globals.css");
    expect(css).toContain("@keyframes tramaWeave {");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\n  \.trama-weave \{\n    animation: none;/);
    const spinner = read("components/TramaSpinner.tsx");
    // 20/10/2026: "relative" per stare sopra l'alone colorato del loader v8.
    expect(spinner).toContain('className="trama-weave relative"');
    expect(spinner).toContain('role="status"');
    for (const p of ["app/nextgen/loading.tsx", "app/(main)/loading.tsx", "app/center/loading.tsx", "app/admin/loading.tsx", "app/auth/trasloco/page.tsx"]) {
      expect(read(p), p).toContain("<TramaSpinner");
    }
    // il logo di caricamento non sovrascrive la posizione salvata per "indietro"
    expect(read("components/nextgen/NextgenScrollActivity.tsx")).toContain(
      `if (el.querySelector('[data-testid="trama-loader"]')) return;`
    );
  });
});
