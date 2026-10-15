// TRAMA — RISPOSTE AI 5 DUBBI DEL 15/10/2026 [no browser]
//   1. prenotazione = richiesta al centro, senza pagamento (beta);
//   4. "Community" → "Classe e scuola" con la nuova barra;
//   5. riga "Dicci cosa ne pensi" in fondo alla Home V2.

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { CLASSE_SCUOLA_COPY } from "../../lib/nextgen/classe-scuola-copy";
import { sanitizeBetaFeedbackClientContext } from "../../lib/nextgen/beta-feedback-shared";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

test.describe("TRAMA — Richiesta senza pagamento (V2) [no browser]", () => {
  test("BR-01 due passi 'Quando' / 'Chi partecipa', niente Pagamento in V2; Legacy invariato", () => {
    const c = read("app/booking/[id]/BookingClient.tsx");
    expect(c).toContain('? (["weeks", "kids"] as const)');
    expect(c).toContain('? ["Quando", "Chi partecipa"]');
    expect(c).toContain('"Invia la richiesta al centro"');
    expect(c).toContain("Nessun pagamento adesso");
    // il flusso di prima resta per chi non ha V2
    expect(c).toContain('["Settimane", "Servizi", "Bambini", "Pagamento"]');
    expect(c).toContain('"Conferma e paga"');
    // in V2 il passo pagamento non è mai nella sequenza: le carte finte stanno solo nel ramo "payment"
    expect(c).toContain('{currentStepKind === "payment" && (');
    // niente "Andiamo Insieme — in arrivo" finto nel passo bambini V2
    expect(c).toContain("{!v2 && (\n            <>\n            <div className=\"mb-1.5 mt-4 flex items-center gap-1.5 text-[13px] font-bold text-ink\">");
    // servizi nel primo passo, solo se ci sono settimane prenotabili
    expect(c).toContain('(v2 && currentStepKind === "weeks" && hasAnyService && hasBookableWeeks)');
    // stile: ponte colori V2 e intestazione V2
    expect(c).toContain('data-nav-v2={v2 ? "" : undefined}');
    expect(c).toContain("v2={v2} />");
    // settimana scelta in blu notte solo in V2; testi della card invariati (li usano i test live)
    const week = read("components/WeekCard.tsx");
    expect(week).toContain('"border-trama-primary bg-trama-primary-soft ring-2 ring-trama-primary/20"');
    expect(week).toContain('"border-sky bg-sky-light ring-2 ring-sky/30"');
    expect(week).toContain("`⚡ ultimi ${week.spots}` : `✓ ${week.spots} posti`");
  });

  test("BR-02 stessa azione e stessi controlli: createBookingAction, conflitti, bambini obbligatori", () => {
    const c = read("app/booking/[id]/BookingClient.tsx");
    expect(c).toContain("await createBookingAction({");
    expect(c).toContain("setWeekConflicts(result.conflicts);");
    expect(c).toContain('(currentStepKind === "kids" && selectedKids.length === 0)');
    expect(c).toContain('(currentStepKind === "weeks" && !dayBookingMode && selectedWeeks.length === 0)');
  });

  test("BR-03 flag: BOOKINGS_V2_ENABLED solo dentro TRAMA ONE, fail-closed, pagina e conferma", () => {
    const page = read("app/booking/[id]/page.tsx");
    expect(page).toContain('flagName: "BOOKINGS_V2_ENABLED"');
    expect(page).toContain("if (nextgen) {");
    expect(page).toContain(".catch(() => false);");
    expect(page).toContain("v2={v2}");
    const success = read("app/booking/[id]/success/page.tsx");
    expect(success).toContain("const requestV2 = nextgen && (await resolveRequestV2());");
    expect(success).toContain("Richiesta inviata");
    expect(success).toContain("In attesa\n            del centro");
    expect(success).toContain('href="/nextgen/prenotazioni"');
    // la conferma V2 non parla di pagamento né di iscrizione già fatta
    const v2Block = success.slice(success.indexOf("if (requestV2) {"), success.indexOf("  return (\n    <PhoneShell>\n      <div className=\"flex h-full min-h-screen flex-col items-center"));
    expect(v2Block.length).toBeGreaterThan(200);
    expect(v2Block).not.toMatch(/pagato|ufficialmente|🎉|✅/);
    // il ramo di prima resta per Legacy
    expect(success).toContain("Totale pagato");
    const entry = FEATURE_CATALOG.find((f) => f.key === "bookings_v2");
    expect(entry?.sourceFiles).toContain("app/booking/[id]/BookingClient.tsx");
    expect(entry?.releaseEligible).toBe(true);
  });

  test("BR-04 PageHeader: v2 forzabile fuori da /nextgen, default invariato", () => {
    const h = read("components/PageHeader.tsx");
    expect(h).toContain("v2 = false,");
    expect(h).toContain("if ((navV2 && showBrandIcon) || v2) {");
  });
});

test.describe("TRAMA — Classe e scuola [no browser]", () => {
  test("CS-01 testi: niente 'community', spiega la differenza con i Gruppi", () => {
    for (const v of Object.values(CLASSE_SCUOLA_COPY)) expect(v.toLowerCase()).not.toContain("community");
    expect(CLASSE_SCUOLA_COPY.title).toBe("Classe e scuola");
    expect(CLASSE_SCUOLA_COPY.intro).toContain("Gruppi");
  });

  test("CS-02 elenco e dettaglio usano i testi V2 solo con la nuova barra; Legacy resta 'Community'", () => {
    const list = read("app/nextgen/community/CommunityListClient.tsx");
    expect(list).toContain("const v2 = useNavV2();");
    expect(list).toContain("<PageHeader title={V2_COPY.title} showBrandIcon />");
    expect(list).toContain('{v2 ? V2_COPY.create : "Crea community"}');
    const detail = read("app/nextgen/community/[id]/CommunityDetailClient.tsx");
    expect(detail).toContain("const v2 = useNavV2();");
    expect(detail).toContain('{v2 ? V2_COPY.proposalsTitle : "Le attività della community"}');
  });

  test("CS-03 Planner → Gruppi V2: sezione 'Classe e scuola'; ramo vecchio invariato; Radar non toccato", () => {
    const g = read("components/nextgen/PlannerGroupsView.tsx");
    expect(g).toContain("{CLASSE_SCUOLA_COPY.sectionTitle}</h2>");
    expect(g).not.toContain("Le tue community</h2>");
    expect(g).toContain("Le tue Community</span>");
    expect(read("lib/radar/community.ts")).toContain("COMMUNITY_BADGE_LABEL =");
  });
});

test.describe("TRAMA — Feedback dalla Home V2 [no browser]", () => {
  test("FH-01 riga 'Dicci cosa ne pensi' apre il pannello esistente con fonte 'home'", () => {
    const home = read("app/nextgen/HomeDashboardV2Client.tsx");
    expect(home).toContain('onClick={() => openBetaFeedback("home")}');
    expect(home).toContain("Dicci cosa ne pensi");
    expect(read("lib/nextgen/feedback-open.ts")).toContain('"home"');
    expect(sanitizeBetaFeedbackClientContext({ source: "home" }).source).toBe("home");
    expect(sanitizeBetaFeedbackClientContext({ source: "altro" }).source).toBeUndefined();
  });
});
