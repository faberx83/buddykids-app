// TRAMA — RELEASE CANDIDATE 20/11 (16/11/2026). Richiesta di Fabrizio:
// "FINAL BETA FIX / RELEASE CANDIDATE 20.11" (Lotti A–C). Iniziativa:
// claude/INIZIATIVA_beta_p0_1611.md. Logica pura + controlli sul sorgente;
// il blocco nel database è provato su Postgres 16 locale (vedi iniziativa).
// Prove nel browser: pending local verification.
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  DEMO_BLOCKED_CTA,
  DEMO_DB_ERROR_TAG,
  DEMO_SIMULATE_CTA,
  DEMO_SIMULATE_NOTE,
  demoRequestMode,
  isDemoCenterRecord,
  isDemoTester,
} from "../../lib/nextgen/demo-label";
import {
  REAL_DISCOVERY_LEADS,
  isDiscoveryLeadEnded,
  leadTemporalLabel,
  sortDiscoveryLeadsForDisplay,
  type DiscoveryLeadRecord,
} from "../../lib/discovery/real-dataset";
import { buildDiscoveryMapItems } from "../../lib/discovery/result-model";

const ROOT = path.join(__dirname, "../..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");

test.describe("A1 — chi può fare richieste DEMO", () => {
  test("regole pure: dati prima del nome, collaudatori fail-closed", () => {
    expect(isDemoCenterRecord({ name: "Centro vero", isDemo: true })).toBe(true);
    expect(isDemoCenterRecord({ name: "Centro vero", isTestFixture: true })).toBe(true);
    expect(isDemoCenterRecord({ name: "Centro Demo" })).toBe(true);
    expect(isDemoCenterRecord({ name: "Leone XIII Sport", isDemo: false })).toBe(false);
    expect(isDemoTester({ role: "platform_admin" })).toBe(true);
    expect(isDemoTester({ role: "parent", isFabrizioTestAccount: true })).toBe(true);
    expect(isDemoTester({ role: "parent", cohortKeys: ["internal-preview"] })).toBe(true);
    expect(isDemoTester({ role: "parent", cohortKeys: ["trama-one-controlled-beta"] })).toBe(false);
    expect(isDemoTester({})).toBe(false);
    expect(demoRequestMode(false, false)).toBe("none");
    expect(demoRequestMode(false, true)).toBe("none");
    expect(demoRequestMode(true, true)).toBe("simulate");
    expect(demoRequestMode(true, false)).toBe("blocked");
  });

  test("le server action controllano prima di scrivere e non avvisano i gestori per una simulazione", () => {
    const booking = read("app/booking/[id]/actions.ts");
    const guard = booking.indexOf('const demoAccess = await getDemoAccess(input.activityDbId, user.id);');
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(booking.indexOf('.from("bookings").insert'));
    expect(booking).toContain('if (demoAccess.mode === "blocked") return { error: DEMO_BLOCKED_MESSAGE };');
    expect(booking.indexOf("if (demoAccess.demo) return { bookingId };")).toBeLessThan(booking.indexOf("sendPushToUser(admin.id"));
    expect(booking).toContain("error?.message?.includes(DEMO_DB_ERROR_TAG)");
    const inquiries = read("app/actions/inquiries.ts");
    expect(inquiries.indexOf("getDemoAccess(input.activityDbId, user.id)")).toBeLessThan(inquiries.indexOf('.from("activity_inquiries")\n    .insert'));
    expect(inquiries.match(/if \(!demoAccess\.demo\) await notifyCenterOfParentMessage/g)?.length).toBe(2);
  });

  test("lettura sui dati, fail-closed nelle azioni, ripiego sul nome solo prima della migration", () => {
    const src = read("lib/demo/access.ts");
    expect(src).toContain('import "server-only";');
    expect(src).toContain("centers ( name, is_test_fixture, is_demo )");
    expect(src).toContain('if (typeof row.center.is_demo === "boolean") return row.center.is_demo || row.center.is_test_fixture === true;');
    expect(src).toContain('if (row === "error") return opts.failClosed ?? true;');
    expect(src).toContain("isVersionToggleTestAccount");
    expect(src).toContain("getActiveCohortKeys");
  });

  test("migration 63 PREPARATA: dato is_demo, stessa regola dei collaudatori, trigger su richieste e messaggi", () => {
    const sql = read("supabase/migration_63_centri_demo.sql");
    expect(sql.split("\n")[1]).toBe("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toContain("add column if not exists is_demo boolean not null default false");
    expect(sql).toContain("m.cohort_key = 'internal-preview'");
    expect(sql).toContain("p.role = 'platform_admin'");
    expect(sql).toContain("before insert on public.bookings");
    expect(sql).toContain("before insert on public.activity_inquiries");
    expect(sql).toContain(DEMO_DB_ERROR_TAG);
    expect(sql).toContain("if auth.uid() is null then");
    // Contatti: solo i 5 centri di prova storici, con i valori originali per il rientro.
    expect(sql).toMatch(/set contact_email = null, contact_phone = null, social_links = '\{\}'::jsonb/);
    for (const domain of ["crearte.it", "camobrera.it", "centrolido.it", "scuolaaria.it", "techkids.it"]) expect(sql).toContain(domain);
    expect(sql).not.toMatch(/^\s*(drop table|delete from|truncate)/im);
  });
});

test.describe("A2 — percorso e CTA delle attività DEMO e a giornate", () => {
  test("scheda V2: famiglie 'Solo dimostrazione', collaudatori 'Simula richiesta', a giornate 'Scegli i giorni'", () => {
    const src = read("components/nextgen/ActivityDetailV2.tsx");
    expect(src).toContain('const bookLabel = demoMode === "simulate" ? DEMO_SIMULATE_CTA : "Prenota";');
    expect(src).toContain('data-testid="demo-blocked-cta"');
    expect(src).toContain("{DEMO_BLOCKED_CTA}");
    expect(src).toContain('const needsDayChoice = showDaySelection && (activity.bookingMode === "day_only" || !weeksBookable);');
    expect(src).toContain('document.getElementById("giorni-h")');
    expect(src).toContain("Scegli i giorni");
    expect(DEMO_BLOCKED_CTA).toBe("Solo dimostrazione");
    expect(DEMO_SIMULATE_CTA).toBe("Simula richiesta");
  });

  test("pagina richiesta: famiglie bloccate dal server, niente 'il centro riceve' per una DEMO, niente 'esaurite' prima della scelta", () => {
    const page = read("app/booking/[id]/page.tsx");
    expect(page).toContain('if (demoMode === "blocked") {');
    expect(page).toContain('data-testid="demo-booking-blocked"');
    const client = read("app/booking/[id]/BookingClient.tsx");
    expect(client).toContain("? DEMO_SIMULATE_CTA");
    expect(client).toMatch(/\{demo \? \(\s*<p data-testid="demo-booking-note"/);
    expect(client).not.toContain("Le settimane intere per questa attività sono al momento esaurite");
    expect(client).toContain('hasBookableDays ? "Scegli i giorni" : "Nessuna disponibilità"');
    const success = read("app/booking/[id]/success/page.tsx");
    expect(success).toContain('demo ? "Simulazione registrata" : "Richiesta inviata"');
    expect(DEMO_SIMULATE_NOTE).toMatch(/Nessun centro vero la riceve/);
  });

  test("le pagine passano la modalità calcolata sul server", () => {
    const act = read("app/activity/[id]/page.tsx");
    expect(act).toContain("getDemoAccess(activity.dbId, viewerId, { failClosed: false })");
    expect(act).toContain("demoMode={demoMode}");
    expect(act).toContain("weeksBookable={hasAvailableWeek}");
  });
});

test.describe("A3 — nessun contatto verso soggetti reali da una DEMO", () => {
  test("scheda: niente 'Apri mappa' e niente 'Contatta il gestore' per le famiglie su una DEMO", () => {
    const src = read("components/nextgen/ActivityDetailV2.tsx");
    expect(src).toContain("{dateSummary && !isDemo && (() => {");
    expect(src).toContain("{!preview && !demoBlocked && (");
  });
});

test.describe("B — badge DEMO nel popup mappa", () => {
  test("il marker partner porta l'informazione demo fino al popup", () => {
    const items = buildDiscoveryMapItems([{ id: "a", name: "Ponte (prova)", emoji: "🎨", lat: 45, lng: 9, demo: true }], []);
    expect(items[0]).toMatchObject({ kind: "partner", demo: true });
    expect(read("app/nextgen/search/SearchDiscoveryClient.tsx")).toContain("badge: item.demo ? DEMO_BADGE : undefined");
    expect(read("components/ActivityMap.tsx")).toContain('data-testid="map-popup-badge"');
  });
});

test.describe("C — catalogo", () => {
  const today = "2026-11-16";

  test("Leone XIII: prezzo strutturato al giorno, verifica sulla pagina dell'organizzatore", () => {
    const leone = REAL_DISCOVERY_LEADS.find((l) => l.id === "milano-leone-xiii-christmas-camp-2026")!;
    expect(leone.price).toBe(60);
    expect(leone.priceUnit).toBe("al_giorno");
    expect(leone.startDate).toBe("2026-12-28");
    expect(leone.endDate).toBe("2026-12-30");
    expect(leone.verifiedOn).toBe("2026-11-16");
    expect(leone.temporalNote).toContain("28–30/12/2026");
  });

  test("il link 'Sito dell'organizzatore' / 'Vedi la fonte' porta alla pagina, non al modulo", () => {
    for (const f of ["components/nextgen/DiscoveryLeadCard.tsx", "components/nextgen/DiscoveryMapPopupCard.tsx"]) {
      const src = read(f);
      expect(src).toContain("const ctaHref = lead.officialUrl;");
      expect(src).not.toContain("lead.registrationUrl || lead.officialUrl");
    }
  });

  test("edizioni concluse riconoscibili e in fondo; senza date 'da verificare'", () => {
    const base = REAL_DISCOVERY_LEADS[0];
    const ended = { ...base, id: "x-ended", confidence: "high", startDate: "2026-06-08", endDate: "2026-07-31", seasonYear: 2026 } as DiscoveryLeadRecord;
    const future = { ...base, id: "x-future", confidence: "medium", startDate: "2026-12-28", endDate: "2026-12-30", seasonYear: 2026 } as DiscoveryLeadRecord;
    const undated = { ...base, id: "x-undated", startDate: null, endDate: null, seasonYear: 2026 } as unknown as DiscoveryLeadRecord;
    expect(isDiscoveryLeadEnded(ended, today)).toBe(true);
    expect(leadTemporalLabel(ended, today)).toEqual({ text: "Edizione 2026 conclusa", tone: "muted" });
    expect(leadTemporalLabel(future, today)).toBeNull();
    expect(leadTemporalLabel(undated, today)).toEqual({ text: "Date 2026 da verificare", tone: "warn" });
    expect(sortDiscoveryLeadsForDisplay([ended, future], today).map((l) => l.id)).toEqual(["x-future", "x-ended"]);
    // Senza data di oggi: ordinamento di prima (solo confidenza).
    expect(sortDiscoveryLeadsForDisplay([future, ended]).map((l) => l.id)).toEqual(["x-ended", "x-future"]);
    expect(read("components/nextgen/DiscoveryLeadCard.tsx")).toContain('data-testid="lead-temporal"');
  });
});
