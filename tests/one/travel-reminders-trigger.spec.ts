import { test as pureTest, expect as pureExpect } from "@playwright/test";
import { computeTriggerMinutes, isReminderDue } from "@/lib/travel-reminders/trigger";

// 03/09/2026 — Promemoria di partenza reali (segnalazione Fabrizio:
// "possiamo attivare i reminder ora che ci sono le notifiche?"). Il cron
// (app/api/cron/travel-reminders/route.ts) gira ogni 15 minuti, non
// esattamente al minuto giusto — questi test coprono la logica pura della
// "finestra di tolleranza" e il wraparound intorno a mezzanotte, i due punti
// più facili da sbagliare in silenzio.

pureTest.describe("computeTriggerMinutes — minuto del giorno in cui avvisare", () => {
  pureTest("16:00 con allarme 30 min -> 15:30 (930 minuti)", () => {
    pureExpect(computeTriggerMinutes("16:00", 30)).toBe(15 * 60 + 30);
  });

  pureTest("00:10 con allarme 30 min -> wraparound a 23:40 del giorno prima (1420 minuti)", () => {
    pureExpect(computeTriggerMinutes("00:10", 30)).toBe(23 * 60 + 40);
  });

  pureTest("00:00 con allarme 15 min -> 23:45 (1425 minuti)", () => {
    pureExpect(computeTriggerMinutes("00:00", 15)).toBe(23 * 60 + 45);
  });
});

pureTest.describe("isReminderDue — finestra di tolleranza (il cron non gira esattamente al minuto giusto)", () => {
  pureTest("esattamente al trigger -> due (diff 0)", () => {
    pureExpect(isReminderDue("15:30", "16:00", 30, 20)).toBe(true);
  });

  pureTest("10 minuti dopo il trigger, entro la tolleranza -> due", () => {
    pureExpect(isReminderDue("15:40", "16:00", 30, 20)).toBe(true);
  });

  pureTest("esattamente al bordo della tolleranza (20 min dopo) -> due", () => {
    pureExpect(isReminderDue("15:50", "16:00", 30, 20)).toBe(true);
  });

  pureTest("appena oltre la tolleranza (21 min dopo) -> non più due", () => {
    pureExpect(isReminderDue("15:51", "16:00", 30, 20)).toBe(false);
  });

  pureTest("prima del trigger -> non ancora due", () => {
    pureExpect(isReminderDue("15:00", "16:00", 30, 20)).toBe(false);
  });

  pureTest("wraparound: trigger 23:40 (target 00:10, allarme 30), ora 23:45 -> due", () => {
    pureExpect(isReminderDue("23:45", "00:10", 30, 20)).toBe(true);
  });

  pureTest("wraparound: trigger 23:40, ora 00:05 del giorno dopo (25 min dopo) -> due (dentro la finestra che attraversa la mezzanotte)", () => {
    pureExpect(isReminderDue("00:05", "00:10", 30, 30)).toBe(true);
  });

  pureTest("molto lontano dal trigger (12 ore) -> non due", () => {
    pureExpect(isReminderDue("03:30", "16:00", 30, 20)).toBe(false);
  });
});
