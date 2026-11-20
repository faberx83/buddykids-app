// 20/11/2026 (Fabrizio: "come è possibile che Greta sia finita lì se ha il mio
// link? Verifica perché forse non gira qualcosa"): chi mette TRAMA sulla
// schermata Home dal link d'invito riparte dall'invito, non da "/".
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { inviteStartUrl, manifestForInvite, FAMILY_MANIFEST_BASE } from "../../lib/beta-cohorts/invite-manifest";

const read = (f: string) => fs.readFileSync(path.join(__dirname, "../..", f), "utf8");

test.describe("Icona con l'invito dentro [no browser]", () => {
  test("ICI-01 il manifest d'invito è quello delle famiglie con start_url che porta il codice", () => {
    const fam = JSON.parse(read("public/manifest-family.json"));
    const m = manifestForInvite("TRAMABETA");
    for (const k of ["name", "short_name", "display", "background_color", "theme_color"]) expect(m[k as keyof typeof m]).toEqual(fam[k]);
    expect(m.icons).toEqual(fam.icons);
    expect(m.start_url).toBe("/auth/login?beta=TRAMABETA&da=app");
    expect(m.id).toBe("/");
    expect(inviteStartUrl(null)).toBe("/");
    expect(FAMILY_MANIFEST_BASE.start_url).toBe("/");
  });

  test("ICI-02 la pagina d'invito dichiara il manifest d'invito; la rotta normalizza il codice", () => {
    const p = read("app/auth/login/page.tsx");
    expect(p).toContain("const manifest = inviteCode ? `/manifest-invito?beta=${encodeURIComponent(inviteCode)}` : undefined;");
    expect(p).toContain("...(manifest ? { manifest } : {}),");
    const r = read("app/manifest-invito/route.ts");
    expect(r).toContain('normalizeBetaCode(new URL(request.url).searchParams.get("beta"))');
    expect(r).toContain('"Content-Type": "application/manifest+json; charset=utf-8"');
    // proxy.ts lascia passare /manifest* senza login (installabilità)
    expect(read("proxy.ts")).toContain('!pathname.startsWith("/manifest") &&');
  });

  test("ICI-03 aperta dall'icona da chi è già dentro: si entra nell'app, senza schermate", () => {
    const p = read("app/auth/login/page.tsx");
    expect(p).toContain('if (params.da === "app") {');
    expect(p).toContain('redirect("/nextgen");');
  });

  test("ICI-04 sulla pagina di benvenuto chi ha già un invito torna alla registrazione; dopo la registrazione il codice si dimentica", () => {
    expect(read("components/landing/BenvenutoView.tsx")).toContain("<InviteResumeBanner />");
    const b = read("components/landing/InviteResumeBanner.tsx");
    expect(b).toContain("Hai già un invito a TRAMA");
    expect(b).toContain("href={`/auth/login?beta=${encodeURIComponent(code)}`}");
    expect(read("app/auth/login/LoginForm.tsx")).toContain("window.localStorage.removeItem(BETA_CODE_STORAGE_KEY);");
  });
});
