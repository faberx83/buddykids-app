// TRAMA — FIGLI NELLO STILE V2 (15/10/2026, Fabrizio: "vanno aggiornate anche
// le icone dei figli, sia avatar che interessi"). [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { interestIcon, interestLabel, isKidInterestOption, kidInitial } from "../../lib/nextgen/kid-visual";
import { categories } from "../../lib/mock-data";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

test.describe("TRAMA — Figli V2 [no browser]", () => {
  test("FG-01 interessi: parola senza emoji e icona al tratto; i valori salvati non cambiano", () => {
    expect(interestLabel("⚽ Sport")).toBe("Sport");
    expect(interestLabel("🏊 Piscina")).toBe("Piscina");
    expect(interestLabel("Inglese")).toBe("Inglese");
    expect(interestIcon("⚽ Sport")).toBe("ti-ball-football");
    expect(interestIcon("💻 Tecnologia")).toBe("ti-device-laptop");
    expect(interestIcon("Qualcosa di nuovo")).toBe("ti-star");
    // ogni interesse proposto ha un'icona dedicata
    for (const c of categories.filter((x) => isKidInterestOption(x.id))) expect(interestIcon(c.label)).not.toBe("ti-star");
    // "Intera"/"Mezza" non sono interessi
    expect(isKidInterestOption("intera")).toBe(false);
    expect(kidInitial(" lino")).toBe("L");
    // stesso valore salvato di prima ("⚽ Sport"): il matching di Scopri non cambia
    expect(read("components/AddKidForm.tsx")).toContain("const value = `${c.emoji} ${c.label}`;");
  });

  test("FG-02 avatar: iniziale sulla tinta del figlio al posto della faccina, solo in V2", () => {
    const sec = read("components/ProfileKidsSection.tsx");
    expect(sec).toContain("{kidInitial(k.name)}");
    expect(sec).toContain("KID_TONES[kids.indexOf(k) % KID_TONES.length]");
    expect(sec).toContain('badgeClassName={v2 ? "bg-trama-primary" : undefined}');
    // Legacy invariato
    expect(sec).toContain("{k.emoji}");
    const row = read("components/KidRow.tsx");
    expect(row).toContain("{kidInitial(kid.name)}");
    expect(row).toContain("{kid.emoji}");
    expect(read("app/booking/[id]/BookingClient.tsx")).toContain("toneIndex={kids.indexOf(k)}");
  });

  test("FG-03 chip 'Per chi' e scoperte: solo il nome con la nuova barra", () => {
    expect(read("components/nextgen/KidName.tsx")).toContain("if (v2) return <>{kid.name}</>;");
    expect(read("components/nextgen/ExternalPlannerItemsSection.tsx")).not.toContain("{kid.emoji} {kid.name}");
    expect(read("components/nextgen/DiscoveryLeadCard.tsx")).not.toContain("{kid.emoji} {kid.name}");
    expect(read("components/nextgen/OnboardingV2.tsx")).toContain("interestIcon(opt.value)");
  });
});
