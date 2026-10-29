// Portale centri V2, Richieste (29/10/2026): prenotazioni, messaggi e gruppi
// in un elenco solo, la richiesta aperta in un foglio dal basso.
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  bookingDatesLabel,
  bookingStatus,
  buildInboxItems,
  chosenServices,
  dayBulkSummary,
  filterFromQuery,
  filterInbox,
  inboxSummary,
  relativeTime,
  spotsLabel,
  toAnswerCounts,
} from "../../lib/centers/partner-inbox";
import type { CenterBooking } from "../../lib/data/center-bookings";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");

const day = (date: string, partnerDecision: "pending" | "accepted" | "rejected" | "waitlisted" = "pending") => ({
  activityDayId: `d-${date}`,
  date,
  price: 15,
  partnerDecision,
  partnerNote: null,
  waitlistedAt: null,
  spotsLeft: 5,
  capacity: 12,
});

const booking = (over: Partial<CenterBooking> = {}): CenterBooking => ({
  id: "b1",
  status: "pending",
  partnerDecision: "pending",
  partnerProposalNote: null,
  partnerProposedAt: null,
  respondedAt: null,
  cancelledBy: null,
  readByCenter: false,
  readByParent: true,
  activityId: "pomeriggi",
  activityName: "Pomeriggi",
  parentName: "Giulia Ferri",
  parentEmail: "g@example.it",
  kidNames: ["Leo"],
  totalAmount: 30,
  discountAmount: 0,
  shuttleIncluded: false,
  preServiceIncluded: false,
  postServiceIncluded: true,
  mealIncluded: false,
  createdAt: "2026-10-28T10:00:00Z",
  weeks: [],
  days: [day("2026-11-02"), day("2026-11-03")],
  isDayBased: true,
  ...over,
});

test.describe("Richieste V2 — logica pura", () => {
  test("PI-01 elenco unico: da rispondere prima (la più vecchia in cima), poi il resto (la più recente in cima)", () => {
    const items = buildInboxItems({
      bookings: [
        booking({ id: "nuova", createdAt: "2026-10-29T08:00:00Z" }),
        booking({ id: "vecchia", createdAt: "2026-10-27T08:00:00Z" }),
        booking({ id: "fatta", createdAt: "2026-10-29T09:00:00Z", days: [day("2026-11-02", "accepted")] }),
      ],
      messages: [
        { id: "m1", parentName: "Marco", activityName: "Natale", createdAt: "2026-10-28T12:00:00Z", readByCenter: false, lastSide: "parent", lastText: "Si può arrivare alle 8?" },
        { id: "m2", parentName: "Sara", activityName: "Sabato", createdAt: "2026-10-26T12:00:00Z", readByCenter: true, lastSide: "center", lastText: "Certo!" },
      ],
      groups: [{ id: "g1", groupName: "3B Scuola Rossi", activityName: "Natale", kidsCount: 6, discountPercent: 10, status: "pending", createdAt: "2026-10-28T15:00:00Z" }],
    });
    expect(items.map((i) => i.id)).toEqual(["vecchia", "m1", "g1", "nuova", "fatta", "m2"]);
    expect(items.find((i) => i.id === "m1")?.href).toBe("/center/richieste/m1");
    expect(items.find((i) => i.id === "g1")?.detail).toBe("Natale · 6 bambini · sconto 10%");
    const counts = toAnswerCounts(items);
    expect(counts).toEqual({ tutte: 4, prenotazione: 2, messaggio: 1, gruppo: 1 });
    expect(inboxSummary(counts)).toBe("Da rispondere: 2 prenotazioni, 1 messaggio e 1 richiesta di gruppo.");
    expect(inboxSummary({ tutte: 0, prenotazione: 0, messaggio: 0, gruppo: 0 })).toContain("Niente da rispondere");
    expect(filterInbox(items, "messaggio").map((i) => i.id)).toEqual(["m1", "m2"]);
  });

  test("PI-02 filtri dall'indirizzo (?tipo=), anche dai link di prima", () => {
    expect(filterFromQuery("messaggi")).toBe("messaggio");
    expect(filterFromQuery("gruppi")).toBe("gruppo");
    expect(filterFromQuery("prenotazioni")).toBe("prenotazione");
    expect(filterFromQuery(undefined)).toBe("tutte");
    expect(filterFromQuery("boh")).toBe("tutte");
  });

  test("PI-03 stato di una prenotazione in parole", () => {
    expect(bookingStatus(booking()).label).toBe("Da rispondere");
    expect(bookingStatus(booking({ days: [day("2026-11-02", "accepted"), day("2026-11-03", "accepted")] })).label).toBe("Accettata");
    expect(bookingStatus(booking({ days: [day("2026-11-02", "accepted"), day("2026-11-03", "rejected")] })).label).toBe("Accettata in parte");
    expect(bookingStatus(booking({ days: [day("2026-11-02", "waitlisted")] })).label).toBe("Lista d'attesa");
    expect(bookingStatus(booking({ status: "cancelled", cancelledBy: "parent" })).label).toBe("Annullata dalla famiglia");
    expect(bookingStatus(booking({ isDayBased: false, days: [], partnerDecision: "proposed", status: "confirmed" })).label).toBe("Proposta alla famiglia");
  });

  test("PI-04 date, posti, servizi, tempo, riepilogo di una risposta su più giorni", () => {
    expect(bookingDatesLabel(booking())).toBe("2 e 3 nov");
    expect(bookingDatesLabel(booking({ days: [day("2026-12-22"), day("2026-12-23"), day("2026-12-24")] }))).toBe("3 giorni dal 22 dic");
    expect(bookingDatesLabel(booking({ isDayBased: false, days: [], weeks: [{ weekId: "w", startDate: "2027-07-05", spotsLeft: 3, capacity: 20 }] }))).toBe(
      "settimana dal 5 lug"
    );
    expect(spotsLabel(5, 12)).toEqual({ text: "5 liberi su 12", tone: "ok" });
    expect(spotsLabel(1, 12).text).toBe("ultimo posto");
    expect(spotsLabel(0, 12).text).toBe("pieno");
    expect(spotsLabel(3, 0).tone).toBe("unknown");
    expect(chosenServices(booking())).toEqual(["Uscita posticipata"]);
    const now = new Date("2026-10-29T10:00:00Z");
    expect(relativeTime("2026-10-29T09:45:00Z", now)).toBe("15 min fa");
    expect(relativeTime("2026-10-29T07:00:00Z", now)).toBe("3 ore fa");
    expect(relativeTime("2026-10-28T09:00:00Z", now)).toBe("ieri");
    expect(dayBulkSummary({ accepted: 2, rejected: 0, waitlisted: 1, waitlistUnavailable: 0, failed: 0 })).toBe(
      "2 giorni accettati · 1 giorno pieno: in lista d'attesa"
    );
  });
});

test.describe("Richieste V2 — flusso (controlli sul sorgente)", () => {
  test("PI-05 la pagina di sempre (stesso indirizzo dei link nelle email) mostra l'elenco unico solo col guscio", () => {
    const p = read("app/center/prenotazioni/page.tsx");
    expect(p).toContain("partnerShellEnabledForCurrentUser()");
    expect(p).toContain("<InboxV2");
    expect(p).toContain("<PrenotazioniClient");
    expect(read("app/center/richieste/page.tsx")).toContain('redirect("/center/prenotazioni?tipo=messaggi")');
    expect(read("app/center/group-requests/page.tsx")).toContain('redirect("/center/prenotazioni?tipo=gruppi")');
    expect(read("app/center/richieste/[id]/page.tsx")).toContain('"/center/prenotazioni?tipo=messaggi"');
  });

  test("PI-06 il foglio usa le azioni di sempre: giorni, lista d'attesa, annulla giorno, proposta, letto", () => {
    const s = read("components/center/BookingSheet.tsx");
    for (const fn of [
      "respondToBookingDaysAction",
      "respondToBookingAction",
      "promoteWaitlistedDayAction",
      "cancelBookingDayAction",
      "markBookingsReadAction",
    ]) {
      expect(s, fn).toContain(`${fn}(`);
    }
    expect(s).toContain('decision: "proposed"');
    expect(s).toContain("Note della famiglia per il centro");
    // Nessuna parola tecnica di prima.
    expect(s).not.toMatch(/Giorni spot|Supabase/);
  });

  test("PI-07 risposta a più prenotazioni insieme, gruppi con l'azione di sempre", () => {
    const c = read("components/center/InboxV2.tsx");
    expect(c).toContain("respondSelected");
    expect(c).toContain("respondGroupRequestAction(");
    expect(c).toContain('aria-haspopup="dialog"');
  });

  test("PI-08 foglio accessibile: dialog modale, Esc chiude, il fuoco resta dentro", () => {
    const s = read("components/center/PartnerSheet.tsx");
    expect(s).toContain('role="dialog"');
    expect(s).toContain('aria-modal="true"');
    expect(s).toContain('e.key === "Escape"');
    expect(s).toContain('e.key !== "Tab"');
  });
});
