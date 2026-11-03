// Test browser del 03/11/2026 (Partner 15:47, Parent 16:20).
// Cause verificate su codice e dati di produzione in sola lettura (vedi
// docs/trama-one/claude/PIPELINE_PARTNER_20261030.md, sezione 03/11).
// Logica pura + controlli sul sorgente. I percorsi nel browser (desktop e
// 390px) restano: pending local verification.
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  inventorySummary,
  spotsAfterCapacityChange,
  validateCalendar,
  validateDayInventory,
} from "../../lib/capacity/day-inventory";
import { applyBulkPatch, defaultBulkDraft } from "../../lib/availability-bulk";
import { weeklyOccupancyFromDays } from "../../lib/analytics";
import {
  DAY_PRICE_PRESETS,
  PRICE_ANY,
  PRICE_PRESETS,
  matchesPriceCap,
  priceCapChipLabel,
  priceCapNote,
  priceCapTitle,
  priceCapUnit,
  pricePresetsFor,
  weeklyCapForLeads,
} from "../../lib/nextgen/discover-filters";
import { activityPrice } from "../../lib/nextgen/activity-price";
import {
  GROUP_BY_PREFERENCE_LABEL,
  GROUP_PROPOSAL_MEANING,
  GROUP_PROPOSAL_NAME,
  GROUP_PROPOSAL_STATUS,
  groupProposalNextStep,
  groupingByPreferenceUseful,
} from "../../lib/groups/group-proposal";
import { ageLabel, sectionSummaries } from "../../lib/centers/activity-edit-v2";
import { DISCOUNT_RULES } from "../../lib/centers/discount-rules";
import { distanceText } from "../../lib/geo";
import type { DayAvailability } from "../../lib/types";

const ROOT = path.join(__dirname, "../..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");

const day = (date: string, capacity: number, spotsLeft: number, isOpen = true): DayAvailability =>
  ({ date, capacity, spotsLeft, isOpen }) as DayAvailability;

// ─────────────────────────────────────────────
// Partner #1 (HIGH) — inventario impossibile
// ─────────────────────────────────────────────
test.describe("Partner #1 posti di un giorno: niente dati impossibili", () => {
  test("TB-01 criteri di accettazione: 2/3 rifiutato; 2/2, 2/0, 0/0 validi", () => {
    expect(validateDayInventory({ date: "2026-12-08", capacity: 2, spotsLeft: 3 })).toHaveLength(1);
    expect(validateDayInventory({ date: "2026-12-08", capacity: 2, spotsLeft: 3 })[0].field).toBe("spotsLeft");
    expect(validateDayInventory({ date: "2026-12-08", capacity: 2, spotsLeft: 2 })).toEqual([]);
    expect(validateDayInventory({ date: "2026-12-08", capacity: 2, spotsLeft: 0 })).toEqual([]);
    expect(validateDayInventory({ date: "2026-12-08", capacity: 0, spotsLeft: 0 })).toEqual([]);
  });

  test("TB-02 negativi e non interi rifiutati, con il campo giusto", () => {
    expect(validateDayInventory({ date: "d", capacity: -1, spotsLeft: 0 })[0].field).toBe("capacity");
    expect(validateDayInventory({ date: "d", capacity: 2, spotsLeft: -1 })[0].field).toBe("spotsLeft");
    expect(validateDayInventory({ date: "d", capacity: 2.5, spotsLeft: 1 })[0].field).toBe("capacity");
    expect(validateDayInventory({ date: "d", capacity: 3, spotsLeft: 1.5 })[0].field).toBe("spotsLeft");
    expect(validateDayInventory({ date: "d", capacity: Number.NaN, spotsLeft: 0 })[0].field).toBe("capacity");
  });

  test("TB-03 capienza sotto i confermati rifiutata; liberi ≤ totali − confermati", () => {
    const below = validateDayInventory({ date: "d", capacity: 1, spotsLeft: 0 }, 2);
    expect(below).toHaveLength(1);
    expect(below[0].field).toBe("capacity");
    expect(below[0].message).toContain("2 posti confermati");
    expect(validateDayInventory({ date: "d", capacity: 5, spotsLeft: 4 }, 2)[0].field).toBe("spotsLeft");
    expect(validateDayInventory({ date: "d", capacity: 5, spotsLeft: 3 }, 2)).toEqual([]);
    expect(validateDayInventory({ date: "d", capacity: 2, spotsLeft: 0 }, 2)).toEqual([]);
  });

  test("TB-04 calendario intero: problemi per data e messaggio unico 'niente è stato salvato'", () => {
    const issues = validateCalendar(
      [
        { date: "2026-12-07", capacity: 2, spotsLeft: 2 },
        { date: "2026-12-08", capacity: 2, spotsLeft: 3 },
      ],
      {}
    );
    expect(issues.map((i) => i.date)).toEqual(["2026-12-08"]);
    expect(inventorySummary(issues, (d) => d.slice(8))).toBe("Da correggere prima di salvare: 08. Niente è stato salvato.");
  });

  test("TB-05 cambio dei totali: i liberi seguono la differenza e non superano totali − confermati", () => {
    expect(spotsAfterCapacityChange({ capacity: 10, spotsLeft: 8 }, 12, 2)).toBe(10);
    expect(spotsAfterCapacityChange({ capacity: 10, spotsLeft: 8 }, 4, 2)).toBe(2);
    expect(spotsAfterCapacityChange({ capacity: 10, spotsLeft: 0 }, 2, 2)).toBe(0);
    expect(spotsAfterCapacityChange({ capacity: 2, spotsLeft: 2 }, 0, 0)).toBe(0);
  });

  test("TB-06 modifica multipla: ridurre i totali tiene conto dei confermati (niente liberi > totali)", () => {
    const days = [day("2026-12-07", 10, 7), day("2026-12-08", 10, 10)];
    const draft = { ...defaultBulkDraft(), capacity: { include: true, value: 5 } };
    const out = applyBulkPatch(days, new Set(["2026-12-07", "2026-12-08"]), draft, { "2026-12-07": 3 });
    const d7 = out.find((d) => d.date === "2026-12-07")!;
    const d8 = out.find((d) => d.date === "2026-12-08")!;
    expect(d7.capacity).toBe(5);
    expect(d7.spotsLeft).toBe(2);
    expect(d8.capacity).toBe(5);
    expect(d8.spotsLeft).toBe(5);
    expect(validateCalendar(out, { "2026-12-07": 3 })).toEqual([]);
  });

  test("TB-07 grafico: un dato vecchio 2/3 non dà più occupazione negativa", () => {
    const [w] = weeklyOccupancyFromDays([day("2026-12-08", 2, 3)]);
    expect(w.occupancyPercent).toBeGreaterThanOrEqual(0);
    expect(w.occupancyPercent).toBe(0);
  });

  test("TB-08 il server valida prima di scrivere e non scrive nulla se c'è un errore", () => {
    const src = read("app/actions/center.ts");
    const fn = src.slice(src.indexOf("export async function saveActivityDaysAction"));
    const body = fn.slice(0, fn.indexOf("\nexport ", 10));
    expect(body).toContain("getConfirmedSpotsByDate(");
    expect(body).toContain("validateCalendar(");
    expect(body).toContain("niente è stato salvato");
    expect(body.indexOf("validateCalendar(")).toBeLessThan(body.indexOf(".from(\"activity_days\")") === -1 ? Infinity : body.indexOf(".from(\"activity_days\")"));
    // Nessuna cancellazione di prenotazioni nel salvataggio del calendario.
    expect(body).not.toMatch(/from\("bookings"\)[\s\S]{0,80}\.delete\(/);
    expect(body).not.toMatch(/from\("booking_days"\)[\s\S]{0,80}\.delete\(/);
  });

  test("TB-09 in pagina: errore accanto al campo, salvataggio bloccato, confermati passati dal server", () => {
    const cal = read("components/AvailabilityCalendar.tsx");
    expect(cal).toContain("confirmedByDate");
    expect(cal).toContain('role="alert"');
    expect(cal).toContain("aria-invalid");
    expect(cal).toContain('data-testid="calendar-invalid"');
    expect(cal).toContain("spotsAfterCapacityChange(");
    const page = read("app/center/activities/[id]/calendar/page.tsx");
    expect(page).toContain("getConfirmedSpotsByDate(");
    expect(page).toContain("confirmedByDate=");
  });

  test("TB-10 migration 58 preparata: vincolo liberi ≤ totali su giorni e settimane", () => {
    const sql = read("supabase/migration_58_posti_coerenti.sql");
    expect(sql).toContain("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toContain("activity_days_posti_coerenti");
    expect(sql).toContain("activity_weeks_posti_coerenti");
    expect(sql).toContain("spots_left <= capacity");
  });
});

// ─────────────────────────────────────────────
// Partner #2 — pubblicazione implicita e sospensione
// ─────────────────────────────────────────────
test.describe("Partner #2 'Crea e pubblica' e nuove richieste sospese", () => {
  test("TB-11 il bottone dice che si pubblica e spiega cosa vedono le famiglie", () => {
    for (const f of ["components/center/TemplateActivityForm.tsx", "app/center/activities/new/NewActivityForm.tsx"]) {
      const src = read(f);
      expect(src, f).toContain("Crea e pubblica");
      expect(src, f).toContain('data-testid="publish-notice"');
    }
  });

  test("TB-12 migration 59 preparata: sospendere blocca solo le NUOVE richieste", () => {
    const sql = read("supabase/migration_59_richieste_sospese.sql");
    expect(sql).toContain("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toContain("requests_paused_at");
    expect(sql).toMatch(/before insert on public\.bookings/i);
    expect(sql).not.toMatch(/before (insert or )?update on public\.bookings/i);
    expect(sql).not.toMatch(/delete from public\.bookings/i);
  });

  test("TB-13 stato visibile nella scheda attività e in elenco; la pausa non tocca le prenotazioni", () => {
    const edit = read("components/center/ActivityEditV2.tsx");
    expect(edit).toContain('data-testid="activity-status"');
    expect(edit).toContain('data-testid="activity-pause-toggle"');
    expect(edit).toContain('data-testid="activity-pause-confirm"');
    expect(read("components/center/ActivitiesV2.tsx")).toContain('data-testid="activity-paused-badge"');
    const action = read("app/actions/center-activities-v2.ts");
    const fn = action.slice(action.indexOf("export async function setActivityRequestsPausedAction"));
    const body = fn.slice(0, fn.indexOf("\nexport ", 10) === -1 ? undefined : fn.indexOf("\nexport ", 10));
    expect(body).toContain("requests_paused_at");
    expect(body).not.toContain('from("bookings")');
  });

  test("TB-14 lato famiglie: richieste sospese → niente bottone di prenotazione", () => {
    expect(read("components/nextgen/ActivityDetailV2.tsx")).toContain('data-testid="requests-paused-cta"');
    expect(read("app/activity/[id]/page.tsx")).toContain("getRequestsPausedAt(");
    expect(read("app/activity/[id]/page.tsx")).toContain("!requestsPaused");
  });
});

// ─────────────────────────────────────────────
// Partner #3 + Parent #2 — Proposta di gruppo, una definizione
// ─────────────────────────────────────────────
test.describe("Proposta di gruppo: stessa definizione per famiglie e centri", () => {
  test("TB-15 nome, significato e stati", () => {
    expect(GROUP_PROPOSAL_NAME).toBe("Proposta di gruppo");
    expect(GROUP_PROPOSAL_MEANING).toContain("non riserva posti");
    expect(GROUP_PROPOSAL_MEANING).toContain("non crea prenotazioni");
    expect(GROUP_PROPOSAL_STATUS.accepted.family).toBe("Proposta di gruppo accettata");
    expect(GROUP_PROPOSAL_STATUS.pending.partner).toBeTruthy();
    expect(groupProposalNextStep("accepted")).toMatch(/giorni|prenot/i);
  });

  test("TB-16 famiglie, inbox centri, notifiche e Home usano il modulo comune", () => {
    for (const f of [
      "components/GroupDetailClient.tsx",
      "lib/centers/partner-inbox.ts",
      "components/center/InboxV2.tsx",
      "lib/data/notifications.ts",
    ]) {
      expect(read(f), f).toContain("lib/groups/group-proposal");
    }
    expect(read("app/nextgen/HomeDashboardClient.tsx")).toContain("i posti non sono ancora prenotati");
  });

  test("TB-17 nessuna prenotazione finta: il Planner non legge group_requests", () => {
    const plannerFiles = fs.readdirSync(path.join(ROOT, "lib/planner")).filter((f) => f.endsWith(".ts"));
    for (const f of plannerFiles) expect(read(`lib/planner/${f}`), f).not.toContain("group_requests");
    const accept = read("app/actions/center.ts") + read("app/actions/center-activities-v2.ts");
    expect(accept).not.toMatch(/group_requests[\s\S]{0,400}from\("bookings"\)\.insert/);
  });
});

// ─────────────────────────────────────────────
// Parent #1 — budget in Scopri con unità esplicita
// ─────────────────────────────────────────────
test.describe("Parent #1 budget: unità esplicita secondo la copertura", () => {
  // Fixture del criterio di accettazione.
  const day30 = { pricePerWeek: 150, bookingMode: "day_only" as const }; // €30 al giorno
  const day200 = { pricePerWeek: 1000, bookingMode: "day_only" as const }; // €200 al giorno
  const week150 = { pricePerWeek: 150, bookingMode: "week_only" as const }; // €150 a settimana
  const missing = { pricePerWeek: null, bookingMode: "day_only" as const }; // prezzo da chiedere
  const mixed = { pricePerWeek: 200, bookingMode: "mixed" as const }; // €200 a settimana · o €40 al giorno

  test("TB-18 'Giorni singoli' → budget al giorno, con soglie al giorno", () => {
    const unit = priceCapUnit(["day_only"]);
    expect(unit).toBe("day");
    expect(priceCapTitle(unit)).toBe("Prezzo al giorno");
    expect(pricePresetsFor(unit)).toBe(DAY_PRICE_PRESETS);
    expect(pricePresetsFor(unit).map((p) => p.label)).not.toContain("Fino a €150");
    expect(priceCapUnit([], true)).toBe("day");
  });

  test("TB-19 al giorno: €30/giorno passa con ≤€30, €200/giorno no, mista confrontata sul giorno, mancante visibile", () => {
    expect(activityPrice(day30).label).toBe("€30 al giorno");
    expect(matchesPriceCap(day30, 30, "day")).toBe(true);
    expect(matchesPriceCap(day200, 30, "day")).toBe(false);
    expect(matchesPriceCap(day200, 50, "day")).toBe(false);
    expect(matchesPriceCap(mixed, 30, "day")).toBe(false);
    expect(matchesPriceCap(mixed, 50, "day")).toBe(true);
    expect(matchesPriceCap(missing, 20, "day")).toBe(true);
    expect(matchesPriceCap(day200, PRICE_ANY, "day")).toBe(true);
  });

  test("TB-20 a settimana: €150/sett passa con ≤€150; una settimana di €30/giorno conta €150", () => {
    expect(priceCapUnit(["week_only"])).toBe("week");
    expect(matchesPriceCap(week150, 150, "week")).toBe(true);
    expect(matchesPriceCap(mixed, 150, "week")).toBe(false);
    expect(matchesPriceCap(day30, 150, "mixed")).toBe(true);
    expect(matchesPriceCap(day200, 350, "mixed")).toBe(false);
    expect(matchesPriceCap(missing, 150, "week")).toBe(true);
  });

  test("TB-21 'Qualsiasi' non è più un tetto nascosto a €500", () => {
    expect(PRICE_PRESETS[0].value).toBe(PRICE_ANY);
    expect(matchesPriceCap(day200, PRICE_ANY, "mixed")).toBe(true);
    expect(weeklyCapForLeads(PRICE_ANY, "mixed")).toBe(Number.POSITIVE_INFINITY);
    expect(weeklyCapForLeads(30, "day")).toBe(150);
    expect(weeklyCapForLeads(250, "week")).toBe(250);
  });

  test("TB-22 unità dichiarata nella nota e nel chip", () => {
    expect(priceCapNote("day")).toContain("prezzo di un giorno");
    expect(priceCapNote("mixed")).toContain("contiamo 5 giorni");
    expect(priceCapNote("week")).toContain("prezzo da chiedere");
    expect(priceCapChipLabel(30, "day")).toBe("Prezzo (≤€30/giorno)");
    expect(priceCapChipLabel(150, "week")).toBe("Prezzo (≤€150/sett.)");
    expect(priceCapChipLabel(PRICE_ANY, "day")).toBe("Prezzo");
  });

  test("TB-23 Scopri usa la regola comune (niente più a.pricePerWeek > maxPrice)", () => {
    const src = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(src).not.toContain("a.pricePerWeek > maxPrice");
    expect(src).toContain("matchesPriceCap(a, maxPrice, priceUnit)");
    expect(src).toContain("priceCapChipLabel(maxPrice, priceUnit)");
    const sheet = read("components/nextgen/DiscoverFiltersSheet.tsx");
    expect(sheet).not.toContain('title="Prezzo a settimana"');
    expect(sheet).toContain("priceCapTitle(priceUnit)");
    expect(sheet).toContain('data-testid="price-cap-note"');
  });
});

// ─────────────────────────────────────────────
// Rifiniture Partner #4 e Parent #3
// ─────────────────────────────────────────────
test.describe("Rifiniture di testo", () => {
  test("TB-24 età: niente più '6-11 anni anni'", () => {
    expect(ageLabel("6-11 anni")).toBe("6-11 anni");
    expect(ageLabel("6-11")).toBe("6-11 anni");
    expect(ageLabel("")).toBe("");
    const s = sectionSummaries(
      {
        name: "UX DEMO", ageRange: "6-11 anni", description: "", tagIds: [], bookingMode: "day_only",
        minDaysPerBooking: null, spotsLeft: 0, showExactSpots: false, pricePerWeek: 150, shuttlePrice: 0,
        preService: { available: false }, postService: { available: false }, mealOption: "none", mealPriceExtra: 0,
        dietaryOptions: [], schedule: [], address: "", coverImageUrl: null, galleryUrls: [], hasBar: false, accessible: false,
      } as never,
      () => undefined
    );
    expect(JSON.stringify(s)).not.toContain("anni anni");
    expect(read("components/center/ActivityEditV2.tsx")).toContain("ageLabel(saved.ageRange)");
  });

  test("TB-25 Sconti: cumulabilità e giornate spiegate secondo il calcolo reale", () => {
    const byKey = Object.fromEntries(DISCOUNT_RULES.map((r) => [r.key, r.text]));
    expect(byKey.multiweek).toContain("Non vale per le prenotazioni a giornate");
    expect(byKey.siblings).toContain("Vale anche per le giornate");
    expect(byKey.together).toContain("si sommano");
    expect(byKey.group).toContain("Non viene tolta in automatico");
    expect(read("components/center/CenterProfileV2.tsx")).toContain('data-testid="discount-rules"');
    // Le regole descritte corrispondono al calcolo della prenotazione.
    const booking = read("app/booking/[id]/BookingClient.tsx");
    expect(booking).toContain("!dayBookingMode && nWeeks >= 2");
    expect(booking).toContain("familyDiscountAmount(perChildSubtotal");
    expect(booking).toContain("const groupDiscount = weekDiscount + familyDiscount + inviteDiscountAmount;");
  });

  test("TB-26 gruppo: 'Raggruppa per attività preferita' solo con almeno due preferenze diverse", () => {
    expect(GROUP_BY_PREFERENCE_LABEL).toBe("Raggruppa per attività preferita");
    expect(groupingByPreferenceUseful([])).toBe(false);
    expect(groupingByPreferenceUseful([{ preferredTagId: "calcio" }, { preferredTagId: "calcio" }])).toBe(false);
    expect(groupingByPreferenceUseful([{ preferredTagId: "calcio" }, { preferredTagId: null }])).toBe(false);
    expect(groupingByPreferenceUseful([{ preferredTagId: "calcio" }, { preferredTagId: "danza" }])).toBe(true);
    const src = read("components/GroupDetailClient.tsx");
    expect(src).not.toContain("Genera aggregazioni");
    expect(src).toContain("groupingByPreferenceUseful(detail.kids)");
  });

  test("TB-27 scheda a giornate: 'Date e posti'; scheda anonima senza 'Nessuna limitazione non disponibile'", () => {
    expect(read("components/nextgen/ActivityDetailV2.tsx")).toContain('activity.bookingMode === "day_only" ? "Date e posti" : "Settimane e posti"');
    const legacy = read("app/activity/[id]/DetailClient.tsx");
    expect(legacy).not.toContain('label="Nessuna limitazione"');
    expect(legacy).toContain('unavailableText="da verificare con il centro"');
  });

  test("TB-28 niente '0 km' senza una distanza reale", () => {
    expect(distanceText(0)).toBeNull();
    expect(distanceText(null)).toBeNull();
    expect(distanceText(Number.NaN)).toBeNull();
    expect(distanceText(2.4)).toBe("2,4 km");
    for (const f of [
      "app/activity/[id]/DetailClient.tsx",
      "components/ActivityCard.tsx",
      "components/ActivityCardHorizontal.tsx",
      "components/nextgen/PlannerActivityCardCompact.tsx",
    ]) {
      expect(read(f), f).not.toContain("{activity.distanceKm} km");
      expect(read(f), f).toContain("distanceText(activity.distanceKm)");
    }
  });
});
