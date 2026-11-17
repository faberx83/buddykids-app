// 17/11/2026 (Fabrizio: "Meno cose da ricordare. Più tempo per esserci" come
// prima frase della pagina di benvenuto, "è il leit motiv di tutto"; claim in
// italiano ovunque lo vedono le famiglie; colori: variante B, "un pelo più
// calda" dell'app, con pulsante e logo invariati).
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

const read = (f: string) => fs.readFileSync(path.join(__dirname, "../..", f), "utf8");
const CLAIM = "Meno cose da ricordare. Più tempo per esserci.";

test.describe("Benvenuto: claim e variante calda [no browser]", () => {
  test("BCC-01 il titolo è il claim, la frase di prima resta sotto", () => {
    const v = read("components/landing/BenvenutoView.tsx");
    expect(v).toContain('Meno cose da ricordare. <span className="text-trama-coral-ink">Più tempo per esserci.</span>');
    expect(v).toContain("TRAMA organizza il tempo dei tuoi figli");
    expect(v).not.toContain("Il tempo dei tuoi figli, organizzato.");
    const page = read("app/benvenuto/page.tsx");
    expect(page).toContain(`title: "TRAMA — ${CLAIM}"`);
    expect(page).toContain('url: "/og/trama-benvenuto.png"');
    expect(fs.existsSync(path.join(__dirname, "../..", "public/og/trama-benvenuto.png"))).toBe(true);
  });

  test("BCC-02 parte alta su sabbia, promessa in corallo, pulsante invariato", () => {
    const v = read("components/landing/BenvenutoView.tsx");
    expect(v.match(/className="bg-trama-sand"/g)?.length).toBe(2);
    expect(v).toContain("bg-trama-coral-soft");
    expect(v).toContain("bg-trama-primary px-6 text-[16px] font-semibold text-white");
    const tw = read("tailwind.config.ts");
    expect(tw).toContain('sand: "#F7F1E8"');
    expect(tw).toContain('"coral-ink": "#B4473D"');
  });

  test("BCC-03 claim in italiano per le famiglie (login, avvio, fondo pagina); centri invariati", () => {
    expect(read("components/TramaLoginHeader.tsx")).toContain(CLAIM);
    expect(read("components/landing/BenvenutoView.tsx")).toContain(`© 2026 TRAMA · ${CLAIM}`);
    const t = read("lib/tenant.ts");
    const fam = t.slice(t.indexOf("  family: {"), t.indexOf("  partner: {"));
    const par = t.slice(t.indexOf("  partner: {"), t.indexOf("  admin: {"));
    expect(fam).toContain(`splashClaim: "${CLAIM}"`);
    expect(par).toContain('splashClaim: "Organizing childhood. Together."');
  });
});
