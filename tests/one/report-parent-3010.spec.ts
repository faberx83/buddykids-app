// Report Parent/Partner del 30/10/2026 (ChatGPT), lotto L1: UX-CROSS-001,
// UX-CROSS-002, UX-CROSS-003, REV-PARENT-001, REV-PARENT-002.
// Cause verificate su codice e dati di produzione in sola lettura (vedi
// docs/trama-one/claude/PIPELINE_PARENT_20261030.md). Logica pura + controlli
// sul sorgente; percorsi nel browser: pending local verification.
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { activityPrice } from "../../lib/nextgen/activity-price";
import { bookingWhenLabel, daysLabelIt } from "../../lib/nextgen/booking-receipt";

const ROOT = path.join(__dirname, "../..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");

test.describe("UX-CROSS-001 prezzo: una regola per card, dettaglio e riepilogo", () => {
  test("RP-01 solo giorni, solo settimane, mista; zero e mancante distinti", () => {
    // La demo del 30/10: price_per_week 150, solo giornate → €30 al giorno (come richiesta e portale centri).
    expect(activityPrice({ pricePerWeek: 150, bookingMode: "day_only" }).label).toBe("€30 al giorno");
    expect(activityPrice({ pricePerWeek: 150, bookingMode: "week_only" }).label).toBe("€150 a settimana");
    expect(activityPrice({ pricePerWeek: 150 }).label).toBe("€150 a settimana");
    expect(activityPrice({ pricePerWeek: 150, bookingMode: "mixed" }).label).toBe("€150 a settimana · o €30 al giorno");
    expect(activityPrice({ pricePerWeek: 0, bookingMode: "day_only" }).label).toBe("€0 al giorno");
    expect(activityPrice({ pricePerWeek: null, bookingMode: "day_only" }).label).toBe("Prezzo da chiedere");
    expect(activityPrice({ pricePerWeek: 145, bookingMode: "day_only" }).label).toBe("€29 al giorno");
    expect(activityPrice({ pricePerWeek: 148, bookingMode: "day_only" }).label).toBe("€29,60 al giorno");
  });

  test("RP-02 la usano Scopri, la card del Planner, la scheda V2 e quella di prima", () => {
    for (const f of [
      "components/nextgen/DiscoverResultCard.tsx",
      "components/nextgen/PlannerActivityCardCompact.tsx",
      "components/nextgen/ActivityDetailV2.tsx",
      "app/activity/[id]/DetailClient.tsx",
    ]) {
      expect(read(f), f).toContain("activityPrice(");
    }
    expect(read("components/nextgen/DiscoverResultCard.tsx")).not.toContain('€{activity.pricePerWeek} <span className="text-[12.5px] font-medium text-ink-2">a settimana</span>');
  });
});

test.describe("UX-CROSS-002 stesso link, stessa offerta per chi guarda con o senza accesso", () => {
  test("RP-03 giorni e posti non dipendono dall'accesso né dal tracciamento", () => {
    const page = read("app/activity/[id]/page.tsx");
    expect(page).toContain("getActivityDays(activity, { includeAfterSeason: true })");
    // Il tracciamento (?source=…&cid=…) non sceglie la versione della scheda.
    expect(page).not.toMatch(/searchParams\)\)\.source/);
    const legacy = read("app/activity/[id]/DetailClient.tsx");
    expect(legacy).toContain('label="Costo" value={activityPrice(activity).label}');
    expect(legacy).toContain('{activity.bookingMode !== "day_only" && <InfoRow icon="ti-calendar" label="Settimane disponibili"');
  });
});

test.describe("UX-CROSS-003 ricevuta della richiesta", () => {
  test("RP-04 'Quando' con i giorni scelti, non un trattino", () => {
    expect(daysLabelIt(["2026-12-07"])).toBe("lunedì 7 dicembre");
    expect(daysLabelIt(["2026-12-08", "2026-12-07"])).toBe("7 e 8 dicembre");
    expect(daysLabelIt(["2026-11-30", "2026-12-01"])).toBe("30 novembre e 1 dicembre");
    expect(bookingWhenLabel({ weeksLabel: "—", dayDates: ["2026-12-07"] })).toBe("lunedì 7 dicembre");
    expect(bookingWhenLabel({ weeksLabel: "Settimana 3 (8 lug–12 lug)", dayDates: [] })).toBe("Settimana 3 (8 lug–12 lug)");
    expect(bookingWhenLabel({ weeksLabel: "—", dayDates: [] })).toBe("—");
  });

  test("RP-05 il riepilogo legge anche i giorni; ricevuta con orario e stato 'In attesa del centro'", () => {
    const data = read("lib/data/bookings.ts");
    expect(data).toContain("booking_days ( activity_days ( date ) )");
    expect(data).toContain("dayDates,");
    const page = read("app/booking/[id]/success/page.tsx");
    expect(page).toContain("bookingWhenLabel({ weeksLabel: summary.weeksLabel, dayDates: summary.dayDates })");
    expect(page).toContain('<SRow label="Stato" value="In attesa del centro" />');
    expect(page).toContain("Nessun pagamento adesso.");
  });
});

test.describe("REV-PARENT-002 'Foto aggiornata' solo dopo il salvataggio riuscito", () => {
  test("RP-06 messaggio dopo il salvataggio, errore e foto di prima se non riesce", () => {
    const b = read("components/AvatarUploadButton.tsx");
    expect(b).toContain('{saved && !error ? "Foto aggiornata" : ""}');
    expect(b).toContain('role="status" aria-live="polite"');
    const kids = read("components/ProfileKidsSection.tsx");
    expect(kids).toContain("setKids((prev) => prev.map((k) => (k.id === kidId ? { ...k, avatarUrl: before } : k)));");
    expect(kids).toContain("throw new Error(res.error);");
    const parent = read("components/ProfileHeaderClient.tsx");
    expect(parent).toContain("setAvatarUrl(before);");
  });
});
