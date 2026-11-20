// 20/11/2026 (Fabrizio: "il codice invito ora confonde.. e bisogna far uscire
// 'aggiungi scarica l'app' dopo, una volta fatta la registrazione").
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

const read = (f: string) => fs.readFileSync(path.join(__dirname, "../..", f), "utf8");

test.describe("L'app si propone dopo la registrazione [no browser]", () => {
  test("ADR-01 con un link d'invito beta non compare il campo 'codice invito centro'", () => {
    expect(read("app/auth/login/LoginForm.tsx")).toContain('{mode === "signup" && !betaParam && (');
  });

  test("ADR-02 prima della registrazione nessun invito a installare (benvenuto, accesso, mini-infobar di Chrome)", () => {
    expect(read("components/landing/BenvenutoView.tsx")).not.toContain("<InstallAppHint");
    const p = read("components/InstallPrompt.tsx");
    expect(p).toContain('pathname?.startsWith("/auth")');
    expect(p).toContain('const stop = (e: Event) => e.preventDefault();');
  });

  test("ADR-03 dopo la registrazione: messaggio che anticipa, e a fine introduzione con un figlio l'app si propone", () => {
    expect(read("app/auth/login/LoginForm.tsx")).toContain("poi entra in TRAMA: lì ti spieghiamo come metterla sulla schermata Home.");
    const o = read("components/nextgen/OnboardingV2.tsx");
    expect(o).toContain('if (kidAddedRef.current) markFirstUsefulAction("figlio");');
    expect(read("lib/nextgen/first-action.ts")).toContain('| "figlio"');
  });
});
