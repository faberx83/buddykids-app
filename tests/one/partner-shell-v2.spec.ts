// Portale centri V2, guscio (28/10/2026). Fabrizio: "dobbiamo rivedere tutto
// il portale in ordine e pronto per una prima condivisione con potenziali partner".
// Quattro sezioni al posto del menu laterale, palette petrolio e senape,
// sezione "Centro" fatta di righe verso le pagine esistenti.
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  PARTNER_SHELL_FLAG,
  PARTNER_SUBTABS,
  PARTNER_TABS,
  activeSubTab,
  badgeLabel,
  partnerBadges,
  sectionForPath,
} from "../../lib/centers/partner-shell";
import { toAnswerSummary } from "../../lib/centers/partner-oggi";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { RELEASE_CATALOG } from "../../lib/releases/catalog";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");

test.describe("Portale centri V2 — guscio: logica", () => {
  test("PS-01 quattro sezioni nell'ordine del mock", () => {
    expect(PARTNER_TABS.map((t) => t.label)).toEqual(["Oggi", "Richieste", "Attività", "Centro"]);
    expect(PARTNER_TABS.map((t) => t.href)).toEqual(["/center", "/center/prenotazioni", "/center/activities", "/center/centro"]);
  });

  test("PS-02 ogni pagina del portale di oggi ha la sua sezione", () => {
    const cases: [string, string][] = [
      ["/center", "oggi"],
      ["/center/attendance", "oggi"],
      ["/center/prenotazioni", "richieste"],
      ["/center/richieste", "richieste"],
      ["/center/richieste/abc", "richieste"],
      ["/center/group-requests", "richieste"],
      ["/center/activities", "attivita"],
      ["/center/activities/new", "attivita"],
      ["/center/activities/x/calendar", "attivita"],
      ["/center/promotions", "attivita"],
      ["/center/centro", "centro"],
      ["/center/profile", "centro"],
      ["/center/account/preferenze", "centro"],
      ["/center/invites", "centro"],
      ["/center/servizi-consigliati", "centro"],
      ["/center/report-presenze", "centro"],
    ];
    for (const [p, s] of cases) expect(sectionForPath(p), p).toBe(s);
  });

  test("PS-03 schede dentro Richieste e Attività, la più lunga vince", () => {
    expect(PARTNER_SUBTABS.richieste?.map((t) => t.label)).toEqual(["Prenotazioni", "Messaggi", "Gruppi"]);
    expect(activeSubTab("/center/richieste/123")).toBe("/center/richieste");
    expect(activeSubTab("/center/activities/x/calendar")).toBe("/center/activities");
    expect(activeSubTab("/center/promotions")).toBe("/center/promotions");
    expect(activeSubTab("/center")).toBeNull();
  });

  test("PS-04 pallini: Richieste somma prenotazioni, gruppi e messaggi; Oggi i check-in", () => {
    expect(partnerBadges({ unreadBookings: 2, pendingGroupRequests: 1, unreadMessages: 3, unconfirmedCheckins: 4 })).toEqual({
      richieste: 6,
      oggi: 4,
      bySubTab: { "/center/prenotazioni": 2, "/center/richieste": 3, "/center/group-requests": 1 },
    });
    const zero = partnerBadges({ unreadBookings: -1, pendingGroupRequests: NaN, unreadMessages: 0, unconfirmedCheckins: 0 });
    expect(zero.richieste).toBe(0);
    expect(zero.oggi).toBe(0);
    expect(Object.values(zero.bySubTab)).toEqual([0, 0, 0]);
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(3)).toBe("3");
    expect(badgeLabel(12)).toBe("9+");
  });
});

test.describe("Portale centri V2 — guscio: flusso (controlli sul sorgente)", () => {
  test("PS-05 flag, funzionalità e release dedicata (accendibile prima in anteprima interna)", () => {
    const flag = FEATURE_FLAG_REGISTRY[PARTNER_SHELL_FLAG as keyof typeof FEATURE_FLAG_REGISTRY] as {
      defaultValue: boolean;
      allowedScopes: readonly string[];
    };
    expect(flag.defaultValue).toBe(false);
    expect(flag.allowedScopes).toContain("cohort");
    const feature = FEATURE_CATALOG.find((f) => f.key === "partner_shell_v2");
    expect(feature?.flagName).toBe(PARTNER_SHELL_FLAG);
    expect(feature?.releaseEligible).toBe(true);
    const release = RELEASE_CATALOG.find((r) => r.id === "centri-portale-v2");
    expect(release?.featureKeys).toEqual(["partner_shell_v2"]);
  });

  test("PS-06 layout: guscio solo col flag e solo per gestore o Admin; senza flag il menu di prima", () => {
    const l = read("app/center/layout.tsx");
    expect(l).toContain("PARTNER_SHELL_FLAG");
    expect(l).toMatch(/realRole === "center_admin" \|\| realRole === "platform_admin"/);
    expect(l).toContain("<PartnerShellV2");
    expect(l).toContain("<DashboardLayout");
    // Le cose di servizio restano anche nel guscio.
    const shellBlock = l.slice(l.indexOf("if (shellV2)"), l.indexOf("<DashboardLayout"));
    expect(shellBlock).toContain("NotificationCenter");
    expect(shellBlock).toContain("BetaFeedbackButton");
  });

  test("PS-07 palette: token partner-* nuovi, quelli di prima invariati", () => {
    const t = read("tailwind.config.ts");
    for (const v of ['primary: "#0E5A63"', 'accent: "#D9A93C"', '"accent-ink": "#8A6410"', 'soft: "#E2F0EF"', 'page: "#F6F9F8"', 'line: "#DCE6E3"']) {
      expect(t).toContain(v);
    }
    expect(t).toContain('DEFAULT: "#1FA88E"');
    expect(t).toContain('navy: "#172A4D"');
  });

  test("PS-08 card di attivazione con i colori del portale centri, senape mai per il testo", () => {
    const c = read("components/center/ActivationCard.tsx");
    expect(c).not.toMatch(/trama-(navy|primary|accent)/);
    expect(c).toContain('stroke="#D9A93C"');
    expect(c).not.toMatch(/text-partner-accent(?!-ink)/);
  });

  test("PS-09 sezione Centro: righe verso le pagine esistenti, ancore nel profilo, uscita", () => {
    const p = read("app/center/centro/page.tsx");
    for (const href of [
      "/center/profile#contatti",
      "/center/profile#indirizzo",
      "/center/profile#descrizione",
      "/center/profile#cancellazioni",
      "/center/profile#sconti",
      "/center/promotions",
      "/center/attendance",
      "/center/report-presenze",
      "/center/invites",
      "/center/servizi-consigliati",
      "/center/account",
    ]) {
      expect(p, href).toContain(href);
    }
    expect(p).toContain('redirect("/center/profile")');
    expect(p).toContain("LogoutButton");
    const form = read("app/center/profile/CenterProfileClient.tsx");
    for (const id of ["contatti", "indirizzo", "descrizione", "accessibilita", "social", "sconti", "cancellazioni"]) {
      expect(form, id).toContain(`id="${id}"`);
    }
  });
});

test.describe("Portale centri V2 — Oggi", () => {
  test("PS-10 'Da rispondere': conteggio, frase e destinazione", () => {
    expect(toAnswerSummary({ bookings: 2, messages: 1, groups: 0, oldestBookingDays: 1 })).toEqual({
      total: 3,
      detail: "2 prenotazioni e 1 messaggio · la più vecchia da 1 giorno",
      href: "/center/prenotazioni",
    });
    expect(toAnswerSummary({ bookings: 0, messages: 3, groups: 0, oldestBookingDays: 0 })).toEqual({
      total: 3,
      detail: "3 messaggi",
      href: "/center/richieste",
    });
    expect(toAnswerSummary({ bookings: 0, messages: 0, groups: 1, oldestBookingDays: 0 }).href).toBe("/center/group-requests");
    expect(toAnswerSummary({ bookings: 1, messages: 2, groups: 1, oldestBookingDays: 0 }).detail).toBe(
      "1 prenotazione, 2 messaggi e 1 richiesta di gruppo"
    );
    expect(toAnswerSummary({ bookings: 0, messages: 0, groups: 0, oldestBookingDays: 4 })).toEqual({
      total: 0,
      detail: "",
      href: "/center/prenotazioni",
    });
  });

  test("PS-11 Oggi V2 col guscio, dashboard di prima senza; niente euro nei numeri", () => {
    const page = read("app/center/page.tsx");
    expect(page).toContain("partnerShellEnabledForCurrentUser()");
    expect(page).toContain("<OggiV2");
    expect(page).toContain("<StatCard");
    const oggi = read("components/center/OggiV2.tsx");
    expect(oggi).toContain("Da rispondere");
    expect(oggi).toContain("Niente da rispondere");
    expect(oggi).toContain("Registro presenze");
    expect(oggi).toContain("ActivationCard");
    expect(oggi).not.toMatch(/€|Fatturato/);
  });

  test("PS-12 ponte di colori per le pagine non ancora ridisegnate, solo dentro il guscio", () => {
    const css = read("app/globals.css");
    const block = css.slice(css.indexOf("PONTE V2 PER LE PAGINE DEL PORTALE CENTRI"));
    expect(block).toContain("[data-partner-v2] .bg-sky");
    expect(block).toContain("[data-partner-v2] .text-sky");
    expect(block).toContain("#0e5a63");
    expect(read("components/center/PartnerShellV2.tsx")).toContain("data-partner-v2");
  });
});

