// 17/11/2026 (Fabrizio: "nella home page di benvenuto dovremmo aggiungere
// qualcosa che indichi come scaricare l'app PWA da android e iphone?" → "ok
// procedi"): una riga nella pagina di benvenuto, foglietto iPhone/Android.
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

const read = (f: string) => fs.readFileSync(path.join(__dirname, "../..", f), "utf8");

test.describe("Benvenuto: usala come un'app [no browser]", () => {
  test("BIA-01 riga sotto i pulsanti, foglietto con iPhone e Android", () => {
    // 20/11/2026: tolta dalla pagina di benvenuto (si propone dopo la registrazione,
    // vedi app-dopo-registrazione.spec.ts); il foglietto resta per i centri.
    expect(read("components/landing/BenvenutoView.tsx")).not.toContain("<InstallAppHint");
    const c = read("components/landing/InstallAppHint.tsx");
    expect(c).toContain("Usala come un&apos;app: aggiungila alla schermata Home");
    expect(c).toContain('&quot;Aggiungi alla schermata Home&quot;');
    expect(c).toContain('&quot;Installa app&quot;');
    // Su iPhone le notifiche arrivano solo con TRAMA sulla schermata Home: lo diciamo.
    expect(c).toContain("Su iPhone serve anche per ricevere le notifiche");
  });

  test("BIA-02 aperta dall'icona la riga non compare; scheda del telefono in uso già aperta", () => {
    const c = read("components/landing/InstallAppHint.tsx");
    expect(c).toContain('window.matchMedia?.("(display-mode: standalone)").matches === true');
    expect(c).toContain("setHidden(isStandalone());");
    expect(c).toContain("setTab(detectPlatform());");
  });
});
