// TRAMA — "LA TUA FAMIGLIA" (15/10/2026, Fabrizio: "la sezione famiglia in
// profilo va analizzata bene" → "Si a tutto"). [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { cleanHelperName, defaultFamilyName, familySummaryLine, isBuiltInHelper } from "../../lib/nextgen/family-page-v2";
import { profileV2Sections } from "../../lib/nextgen/profile-v2";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");
const noop = () => {};

test.describe("TRAMA — La tua famiglia [no browser]", () => {
  test("FV2-01 il gruppo famiglia nasce dal cognome, senza il passaggio 'Crea famiglia'", () => {
    expect(defaultFamilyName("Fabrizio Rossi")).toBe("Famiglia Rossi");
    expect(defaultFamilyName("Fabrizio")).toBe("La nostra famiglia");
    expect(defaultFamilyName(null)).toBe("La nostra famiglia");
    const actions = read("app/actions/family.ts");
    expect(actions).toContain("export async function inviteCoParentAction(email: string)");
    expect(actions).toContain("const created = await createFamilyAction(defaultFamilyName(");
  });

  test("FV2-02 chi vi aiuta: nomi puliti, niente doppioni di Nonno/Nonna/Tata", () => {
    expect(cleanHelperName("  Zia   Carla ")).toBe("Zia Carla");
    expect(cleanHelperName("   ")).toBeNull();
    expect(cleanHelperName("x".repeat(41))).toBeNull();
    expect(isBuiltInHelper("nonna")).toBe(true);
    expect(isBuiltInHelper("Zia Carla")).toBe(false);
    const a = read("app/actions/family-people.ts");
    expect(a).toContain('.update({ active: false })'); // togliere non cancella le assegnazioni passate
    expect(a).toContain('.update({ responsible_label: name })'); // rinominare aggiorna anche Chi accompagna
    expect(a).toContain('.eq("parent_id", user.id)');
  });

  test("FV2-03 pagina: quattro blocchi, flag PROFILE_V2, vecchio hub come ripiego", () => {
    const page = read("app/nextgen/profile/famiglia/page.tsx");
    expect(page).toContain('flag("PROFILE_V2_ENABLED")');
    expect(page).toContain("if (!v2) return <FamigliaHubClient />;");
    const c = read("app/nextgen/profile/famiglia/FamigliaV2Client.tsx");
    for (const t of ["<ProfileKidsSection", "Genitori", "Chi vi aiuta", "Luoghi", "inviteCoParentAction(email)", "joinFamilyByCodeAction(code)"]) {
      expect(c).toContain(t);
    }
    expect(c).not.toContain("Crea famiglia");
    expect(c).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  test("FV2-04 Profilo: una riga 'La tua famiglia' con i nomi dei figli; ?addKid=1 porta lì", () => {
    const items = profileV2Sections({ unreadReplies: 0, kidNames: ["Lino", "Franchidea"], classicFallbackEnabled: false, onFeedback: noop, onClassic: noop }).flatMap((s) => s.items);
    const fam = items.find((i) => i.key === "famiglia")!;
    expect(fam.title).toBe("La tua famiglia");
    expect(fam.subtitle).toBe("Lino e Franchidea · genitori, aiuti, luoghi");
    expect(fam.href).toBe("/nextgen/profile/famiglia");
    expect(items.some((i) => i.key === "indirizzi")).toBe(false);
    expect(familySummaryLine([])).toBe("Aggiungi i tuoi figli");
    expect(read("app/nextgen/profile/page.tsx")).toContain('if (params.addKid === "1") redirect("/nextgen/profile/famiglia?addKid=1");');
  });
});
