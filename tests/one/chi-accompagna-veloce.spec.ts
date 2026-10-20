// TRAMA — CHI ACCOMPAGNA PIÙ VELOCE (20/10/2026, release "chi-accompagna-veloce").
// Fabrizio: "1) il click e l'assegnazione è lungo… 2) se assegno qualcosa in un
// giorno, dovrebbe propormi di applicarlo a tutto l'impegno se
// plurigiornaliero 3) se chi è assegnato è già utente TRAMA manda notifica
// (solo all'assegnatario, una per giro), per chi non lo è proporre subito
// condivisione". [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  APPLY_ALL_HORIZON_DAYS,
  buildAssignNotice,
  collapseChanges,
  isPartnerChoice,
  otherDaysOfCommitments,
} from "../../lib/nextgen/assign-plus";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { getReleaseById } from "../../lib/releases/catalog";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { isKnownProductEvent } from "../../lib/telemetry/known-events";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

const campus = {
  id: "b1",
  status: "confirmed",
  partnerDecision: "accepted",
  activityName: "Campus Natale",
  kidIds: ["lino"],
  weeks: [{ startDate: "2026-12-21", endDate: "2026-12-25" }, { startDate: "2026-12-28", endDate: "2027-01-01" }],
  dayDates: [],
};
const gara = { id: "e1", title: "Gara Rimininfiera Winter", startDate: "2026-12-05", endDate: "2026-12-08", kidIds: ["fra"] };

test.describe("TRAMA — Chi accompagna più veloce [no browser]", () => {
  test("CAV-01 tutto l'impegno: gli altri giorni feriali futuri, mai il giorno scelto né il weekend", () => {
    const r = otherDaysOfCommitments({ dateIso: "2026-12-22", todayIso: "2026-12-01", kidId: "lino", bookings: [campus], externalItems: [gara] });
    expect(r).toHaveLength(1);
    expect(r[0].key).toBe("booking:b1");
    expect(r[0].title).toBe("Campus Natale");
    expect(r[0].dates).not.toContain("2026-12-22");
    expect(r[0].dates).toEqual(["2026-12-21", "2026-12-23", "2026-12-24", "2026-12-25", "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01"]);
    // Impegno a mano (sab 5 – mar 8): solo lun 7 resta, oltre a mar 8 scelto.
    const g = otherDaysOfCommitments({ dateIso: "2026-12-08", todayIso: "2026-12-01", kidId: "fra", bookings: [], externalItems: [gara] });
    expect(g[0].dates).toEqual(["2026-12-07"]);
    // Giorni passati esclusi; figlio diverso: niente.
    expect(otherDaysOfCommitments({ dateIso: "2026-12-29", todayIso: "2026-12-29", kidId: "lino", bookings: [campus], externalItems: [] })[0].dates[0]).toBe("2026-12-30");
    expect(otherDaysOfCommitments({ dateIso: "2026-12-22", todayIso: "2026-12-01", kidId: "fra", bookings: [campus], externalItems: [] })).toEqual([]);
    // Prenotazione rifiutata o annullata: niente da proporre.
    expect(otherDaysOfCommitments({ dateIso: "2026-12-22", todayIso: "2026-12-01", kidId: "lino", bookings: [{ ...campus, partnerDecision: "rejected" }], externalItems: [] })).toEqual([]);
  });

  test("CAV-02 un impegno 'tutto l'anno' si ferma a sei mesi", () => {
    const anno = { id: "e2", title: "Calcio", startDate: "2026-09-01", endDate: "2027-12-31", kidIds: ["lino"] };
    const r = otherDaysOfCommitments({ dateIso: "2026-10-21", todayIso: "2026-10-20", kidId: "lino", bookings: [], externalItems: [anno] });
    const limit = new Date("2026-10-20T00:00:00Z");
    limit.setUTCDate(limit.getUTCDate() + APPLY_ALL_HORIZON_DAYS);
    expect(r[0].dates[r[0].dates.length - 1] <= limit.toISOString().slice(0, 10)).toBe(true);
    expect(r[0].dates.length).toBeLessThanOrEqual(200); // limite dell'azione
  });

  test("CAV-03 notifica: solo per l'altro genitore, una per giro, conta l'ultima scelta", () => {
    expect(isPartnerChoice("partner")).toBe(true);
    for (const v of ["io", "nonna", "nonno", "tata", "altro"] as const) expect(isPartnerChoice(v)).toBe(false);
    const changes = [
      { dateIso: "2026-10-21", kidName: "Lino", moment: "andata" as const, assigned: true },
      { dateIso: "2026-10-21", kidName: "Lino", moment: "andata" as const, assigned: false },
      { dateIso: "2026-10-21", kidName: "Lino", moment: "andata" as const, assigned: true },
      { dateIso: "2026-10-23", kidName: "Franchidea", moment: "ritorno" as const, assigned: true },
    ];
    expect(collapseChanges(changes)).toHaveLength(2);
    const n = buildAssignNotice({ fromName: "Fabrizio", changes, nonce: "1" })!;
    expect(n.title).toBe("Fabrizio ti ha affidato 2 passaggi");
    expect(n.body).toBe("mer 21 ott · porti Lino\nven 23 ott · ritiri Franchidea");
    expect(n.deepLink).toBe("/nextgen/planner?week=2026-10-19&panel=chi");
    expect(n.tag).toBe("chi-accompagna-1");
    const removed = buildAssignNotice({ fromName: null, changes: [{ dateIso: "2026-10-21", kidName: "Lino", moment: "ritorno", assigned: false }], nonce: "2" })!;
    expect(removed.title).toBe("L'altro genitore ha cambiato chi accompagna");
    expect(removed.body).toBe("mer 21 ott · non ritiri più Lino");
    expect(buildAssignNotice({ fromName: "F", changes: [], nonce: "3" })).toBeNull();
  });

  test("CAV-04 velocità: la scelta va a schermo prima del salvataggio; niente ridisegno del Planner a ogni tocco", () => {
    const c = read("app/nextgen/planner/PlannerV2Client.tsx");
    const choose = c.slice(c.indexOf("async function choose(kidId: string, kidName: string"), c.indexOf("async function applyToAll("));
    expect(choose.indexOf("// Subito a schermo.")).toBeGreaterThan(-1);
    expect(choose.indexOf("// Subito a schermo.")).toBeLessThan(choose.indexOf("await setResponsibilityAction("));
    expect(choose).toContain("if (seqRef.current[key] !== seq) return;");
    expect(c).not.toContain("busyKey");
    const a = read("app/actions/responsibilities.ts");
    const single = a.slice(a.indexOf("export async function setResponsibilityAction("), a.indexOf("export async function setWeekBulkResponsibilityAction("));
    expect(single).not.toContain("revalidatePath(");
    // Il foglio ricarica il Planner alla chiusura (come prima).
    expect(c).toMatch(/onClose=\{\(\) => \{\s*setPanel\(null\);\s*if \(assignFromLink\.current\)/);
  });

  test("CAV-05 cablaggio: notifica alla chiusura del foglio, solo con l'altro genitore su TRAMA e la release accesa", () => {
    const c = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(c).toContain("if (plusEnabled && partnerOnTrama && changes.length > 0) void notifyPartnerAssignmentsAction(changes)");
    expect(c).toContain('<Sheet title={`Chi accompagna · ${day.label}`} onClose={close} ownHistoryEntry={ownHistoryEntry}>');
    const n = read("app/actions/assign-notify.ts");
    expect(n).toContain("flagName: CHI_ACCOMPAGNA_PLUS_FLAG,");
    expect(n).toContain("const others = (family?.members ?? []).filter((m) => !m.isMe);");
    expect(n).toContain("for (const m of others) await sendPushToUser(m.parentId, notice);");
    expect(isKnownProductEvent("assign_partner_notified")).toBe(true);
    const d = read("app/nextgen/planner/planner-v2-data.ts");
    expect(d).toContain(".then((f) => (f?.members ?? []).some((m) => !m.isMe))");
  });

  test("CAV-06 release: flag spento di default, voce di catalogo e pacchetto", () => {
    expect(FEATURE_FLAG_REGISTRY.CHI_ACCOMPAGNA_PLUS_ENABLED.defaultValue).toBe(false);
    const entry = FEATURE_CATALOG.find((e) => e.key === "chi_accompagna_plus");
    expect(entry?.releaseEligible).toBe(true);
    expect(entry?.flagName).toBe("CHI_ACCOMPAGNA_PLUS_ENABLED");
    expect(getReleaseById("chi-accompagna-veloce")?.featureKeys).toEqual(["chi_accompagna_plus"]);
  });
});
