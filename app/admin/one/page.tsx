// TRAMA — ADMIN OPERATIVO (12/11/2026). Il Command Center (Sprint 6, E08)
// è diventato la home Admin "Oggi" (app/admin/page.tsx): stesse code, stesse
// etichette, per tutti gli Admin. Richiesta di Fabrizio: "Conserva i link
// esistenti tramite alias o redirect compatibili dove servono": /admin/one
// resta un ALIAS che mostra la stessa pagina (dentro la shell TRAMA ONE del
// layout, come prima: tests/one/smoke.spec.ts TC-N304). Il funnel del
// walkthrough "Benvenuto in TRAMA ONE" è in /admin/crescita.
export { default } from "../page";

export const dynamic = "force-dynamic";
