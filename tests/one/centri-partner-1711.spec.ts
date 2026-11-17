// 17/11/2026, Fabrizio: "la pagina dei centri che si raggiunge da parent
// (tramapp.it/centri?da=benvenuto) deve avere i colori dell'app partner",
// pagine bidirezionali famiglie ⇄ centri, e "la stessa nota per scaricare
// l'app … anche lato centri". Controlli sul sorgente; la resa nel browser
// (desktop e 390 px) resta pending local verification.
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

const read = (f: string) => fs.readFileSync(path.join(__dirname, "../..", f), "utf8");

test.describe("Pagina per i centri nei colori del portale centri [no browser]", () => {
  test("CPC-01 palette del portale centri: niente colori delle famiglie, filo e segno del portale", () => {
    const v = read("components/landing/CentriView.tsx");
    expect(v).not.toMatch(/trama-(primary|accent|page|line)\b/);
    expect(v).not.toContain("data-nav-v2");
    expect(v).not.toContain("TramaThread");
    expect(v).toContain("bg-partner-page");
    expect(v).toContain("<PartnerThread />");
    expect(v).toContain('className="bg-partner-primary"');
    expect(v).toContain("/brand/trama-logo-mark-navy.png");
    expect(v).toContain(">Per i centri</span>");
  });

  test("CPC-02 bidirezionali: centri → famiglie (in alto, su telefono e in fondo) e famiglie → centri", () => {
    const v = read("components/landing/CentriView.tsx");
    expect(v.match(/href="\/benvenuto\?da=centri"/g)?.length).toBe(3);
    expect(v).toContain("Sei un genitore?");
    expect(read("components/landing/BenvenutoView.tsx")).toContain('href="/centri?da=benvenuto"');
    // Dal login del portale centri alla pagina per i centri (sul dominio delle famiglie).
    const login = read("app/auth/login/LoginForm.tsx");
    expect(login).toContain("`${CANONICAL_FAMILY_ORIGIN}/centri?da=accesso-centri`");
  });

  test("CPC-03 'usala come un'app' anche per i centri: porta a partner.tramapp.it, niente promessa di notifiche", () => {
    const h = read("components/landing/InstallAppHint.tsx");
    expect(h).toContain('export type InstallHintVariant = "famiglie" | "centri";');
    expect(h).toContain('const PARTNER_URL = "https://partner.tramapp.it";');
    expect(h).toContain("Il portale centri come un&apos;app: aggiungilo alla schermata Home");
    const centerBlock = h.slice(h.indexOf("const CENTER_STEPS"), h.indexOf("const TONES"));
    expect(centerBlock.match(/Apri \{partnerLink\}/g)?.length).toBe(2); // iPhone e Android
    expect(centerBlock).not.toContain("notifiche");
    expect(read("components/landing/CentriView.tsx")).toContain('<InstallAppHint variant="centri" />');
    expect(read("app/auth/login/LoginForm.tsx")).toContain('<InstallAppHint variant="centri" />');
    // La pagina delle famiglie resta com'era.
    expect(read("components/landing/BenvenutoView.tsx")).toContain("<InstallAppHint />");
  });
});
