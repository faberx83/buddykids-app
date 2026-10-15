// TRAMA — PROFILO V2 (14/10/2026). Voci raggruppate, flag, catalogo,
// riuso dei componenti esistenti con la variante v2. [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { profileV2Sections } from "../../lib/nextgen/profile-v2";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { RELEASE_CATALOG } from "../../lib/releases/catalog";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");
const noop = () => {};

test.describe("TRAMA — Profilo V2 [no browser]", () => {
  test("PRV2-01 tre gruppi nell'ordine Famiglia, Le tue attività, App", () => {
    const s = profileV2Sections({ unreadReplies: 0, classicFallbackEnabled: false, onFeedback: noop, onClassic: noop });
    expect(s.map((x) => x.title)).toEqual(["Famiglia", "Le tue attività", "App"]);
  });

  test("PRV2-02 stesse destinazioni di oggi, senza 'Le mie prenotazioni' (è nella barra) e con 'Salvati' al posto di 'Preferiti'", () => {
    const items = profileV2Sections({ unreadReplies: 0, classicFallbackEnabled: false, onFeedback: noop, onClassic: noop }).flatMap((x) => x.items);
    const hrefs = items.map((i) => i.href).filter(Boolean);
    for (const h of [
      // 15/10/2026: Famiglia e Indirizzi confluiscono in "La tua famiglia"
      "/nextgen/profile/famiglia",
      "/nextgen/groups",
      "/nextgen/community",
      "/nextgen/planner?mode=calendario",
      "/nextgen/planner/promemoria",
      "/nextgen/preferiti",
      "/nextgen/presenze",
      "/nextgen/richieste",
      "/nextgen/center-leads",
      "/nextgen/profile/impostazioni",
      "/nextgen/trama",
      "/nextgen/profile/segnalazioni",
    ])
      expect(hrefs).toContain(h);
    expect(hrefs).not.toContain("/nextgen/prenotazioni");
    expect(items.find((i) => i.href === "/nextgen/preferiti")?.title).toBe("Salvati");
    expect(items.map((i) => i.title)).not.toContain("Preferiti");
  });

  test("PRV2-03 ogni destinazione esiste come pagina", () => {
    const items = profileV2Sections({ unreadReplies: 0, classicFallbackEnabled: false, onFeedback: noop, onClassic: noop }).flatMap((x) => x.items);
    for (const h of items.map((i) => i.href).filter((h): h is string => !!h)) {
      const p = h.split("?")[0].replace(/^\//, "");
      expect(fs.existsSync(path.join(__dirname, "../..", "app", p, "page.tsx")), h).toBe(true);
    }
  });

  test("PRV2-04 messaggi non letti sul badge; 'Ricevute' resta 'Presto'; 'Torna alla versione classica' solo col suo flag", () => {
    const off = profileV2Sections({ unreadReplies: 3, classicFallbackEnabled: false, onFeedback: noop, onClassic: noop }).flatMap((x) => x.items);
    expect(off.find((i) => i.key === "richieste")?.badge).toBe(3);
    expect(off.find((i) => i.key === "ricevute")?.soon).toBe(true);
    expect(off.map((i) => i.key)).not.toContain("classica");
    const on = profileV2Sections({ unreadReplies: 0, classicFallbackEnabled: true, onFeedback: noop, onClassic: noop }).flatMap((x) => x.items);
    expect(on.map((i) => i.key)).toContain("classica");
  });

  test("PRV2-05 flag spento di default, nel catalogo e nella release della nuova barra", () => {
    expect(FEATURE_FLAG_REGISTRY.PROFILE_V2_ENABLED.defaultValue).toBe(false);
    const entry = FEATURE_CATALOG.find((f) => f.key === "profile_v2");
    expect(entry?.flagName).toBe("PROFILE_V2_ENABLED");
    expect(entry?.releaseEligible).toBe(true);
    expect(RELEASE_CATALOG.find((r) => r.id === "nav-v2")?.featureKeys).toContain("profile_v2");
  });

  test("PRV2-06 la pagina sceglie V2 solo con il flag, con ripiego sul Profilo attuale", () => {
    const page = read("app/nextgen/profile/page.tsx");
    expect(page).toContain('flagName: "PROFILE_V2_ENABLED"');
    expect(page).toContain("}).catch(() => false); // ripiego: Profilo attuale");
    expect(page).toContain("if (profileV2Enabled) {");
    expect(page).toContain("<ProfileNextgenClient");
  });

  test("PRV2-07 riusa intestazione e figli esistenti con la variante v2 (default invariato per Legacy e Gestore)", () => {
    const client = read("app/nextgen/profile/ProfileV2Client.tsx");
    expect(client).toContain("<ProfileHeaderClient");
    // 15/10/2026: i figli (ProfileKidsSection v2) stanno in "La tua famiglia"
    expect(client).not.toContain("<ProfileKidsSection");
    expect(read("app/nextgen/profile/famiglia/FamigliaV2Client.tsx")).toContain("<ProfileKidsSection");
    expect(client.match(/\n\s+v2\n/g)?.length).toBe(1);
    expect(client).toContain("<TramaThread");
    expect(read("components/ProfileHeaderClient.tsx")).toContain("  v2 = false,");
    expect(read("components/ProfileKidsSection.tsx")).toContain("  v2 = false,");
    // LogoutButton: stessa logica, classe opzionale; senza classe identico a prima
    expect(read("components/LogoutButton.tsx")).toContain("className ??");
  });
});
