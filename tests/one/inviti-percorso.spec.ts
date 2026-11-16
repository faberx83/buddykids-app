// TRAMA — LOTTO 2, primo incremento (16/11/2026). Iniziativa:
// claude/INIZIATIVA_admin_operativo.md. Richiesta di Fabrizio: "Verifica in
// test due casi: richiesta senza account → resta Da invitare; richiesta con
// account registrato via codice e senza invio segnato → sparisce da Da
// invitare ma resta nello storico. Riporta anche il conteggio di Oggi per
// entrambi."
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  INVITE_QUEUE_RULE,
  inviteNotMarked,
  inviteQueueState,
  invitePipeline,
  isAwaitingInvite,
  registeredNotMarkedNote,
  waitlistQueue,
  type WaitlistLike,
} from "../../lib/admin-ops/invitations";
import { buildQueue } from "../../lib/admin-ops/queues";
import { buildJourney } from "../../lib/admin-ops/journey";
import { computePreFunnel, familyFunnelScope, PRE_FUNNEL_NOTE } from "../../lib/beta-cockpit/pre-funnel";

const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const TODAY = "2026-11-16";

const senzaAccount: WaitlistLike = {
  id: "w-1",
  email: "nuova.famiglia@example.com",
  status: "nuovo",
  createdAt: "2026-11-10T09:00:00Z",
  invitedAt: null,
  comune: "Milano",
  account: null,
};
// Caso QA uxtest: richiesta 'nuovo', account creato lo stesso giorno con codice.
const registrataViaCodice: WaitlistLike = {
  id: "w-2",
  email: "Uxtest@Example.com",
  status: "nuovo",
  createdAt: "2026-10-22T08:00:00Z",
  invitedAt: null,
  comune: null,
  account: { id: "acc-2", createdAt: "2026-10-22T08:30:00Z", betaCode: "TRAMABETA26", inPilot: true },
};

/** Coda di Oggi costruita come in lib/data/command-center.ts. */
function oggi(items: WaitlistLike[]) {
  const { queue, registeredNotMarked } = waitlistQueue(items);
  return buildQueue(
    {
      key: "waitlist",
      label: "Famiglie in lista d'attesa da invitare",
      actor: "trama",
      href: "/admin/lista-attesa",
      nextStep: "Scrivere l'invito, poi segnarlo come inviato",
      items: queue.map((w) => ({ id: w.id, title: w.email, sub: w.comune ?? null, createdAt: w.createdAt, href: "/admin/lista-attesa" })),
      note: registeredNotMarked.length > 0 ? registeredNotMarkedNote(registeredNotMarked.length) : undefined,
    },
    TODAY
  );
}

test.describe("IP — coda Da invitare, regola unica", () => {
  test("IP-01 richiesta senza account: resta Da invitare in Lista, Famiglie e Oggi (Oggi = 1)", () => {
    expect(inviteQueueState(senzaAccount, senzaAccount.account)).toBe("da_invitare");
    expect(isAwaitingInvite(senzaAccount, null)).toBe(true);
    const [row] = invitePipeline([senzaAccount], []);
    expect(row.stage).toBe("richiesta");
    expect(row.inviteNotMarked).toBe(false);
    const q = oggi([senzaAccount]);
    expect(q.count).toBe(1);
    expect(q.note).toBeNull();
  });

  test("IP-02 registrata via codice senza invio segnato: fuori dalla coda, nello storico, nessuna data inventata (Oggi = 0)", () => {
    expect(inviteQueueState(registrataViaCodice, registrataViaCodice.account)).toBe("registrata");
    expect(isAwaitingInvite(registrataViaCodice, registrataViaCodice.account)).toBe(false);
    expect(inviteNotMarked(registrataViaCodice, registrataViaCodice.account)).toBe(true);
    const [row] = invitePipeline([registrataViaCodice], []);
    expect(row.stage).toBe("registrata");
    expect(row.archived).toBe(false); // resta nello storico, non archiviata
    expect(row.invitedAt).toBeNull(); // nessuna data d'invio inventata
    expect(row.inviteNotMarked).toBe(true);
    expect(row.usedCode).toBe("TRAMABETA26");
    expect(row.accountId).toBe("acc-2");
    const q = oggi([registrataViaCodice]);
    expect(q.count).toBe(0);
    expect(q.note).toBe("1 richiesta già registrata senza invio segnato: fuori dalla coda");
    // L'oggetto d'origine non è stato toccato.
    expect(registrataViaCodice.status).toBe("nuovo");
    expect(registrataViaCodice.invitedAt).toBeNull();
  });

  test("IP-03 i due casi insieme: Oggi = 1, Lista d'attesa e Famiglie danno lo stesso numero", () => {
    const items = [senzaAccount, registrataViaCodice];
    expect(oggi(items).count).toBe(1);
    const listaDaInvitare = items.filter((i) => inviteQueueState(i, i.account) === "da_invitare").length;
    const famiglieDaInvitare = invitePipeline(items, []).filter((r) => !r.archived && r.stage === "richiesta").length;
    expect(listaDaInvitare).toBe(1);
    expect(famiglieDaInvitare).toBe(1);
  });

  test("IP-04 l'account vince sullo stato della riga; archiviata resta fuori; invio segnato senza account resta 'inviato'", () => {
    const acc = { id: "a", createdAt: "2026-11-01T00:00:00Z", betaCode: null };
    expect(inviteQueueState({ status: "invitato" }, acc)).toBe("registrata");
    expect(inviteQueueState({ status: "invitato" }, null)).toBe("invito_segnato");
    expect(inviteQueueState({ status: "archiviato" }, null)).toBe("archiviata");
    expect(inviteQueueState({ status: "archiviato" }, acc)).toBe("archiviata");
    // Invito segnato e poi registrata: nessun "non segnato".
    expect(inviteNotMarked({ status: "invitato", invitedAt: "2026-11-02T00:00:00Z" }, acc)).toBe(false);
  });

  test("IP-05 compatibilità: senza account risolto a monte, invitePipeline cerca ancora fra i genitori per email", () => {
    const { account: _drop, ...w } = registrataViaCodice;
    const [row] = invitePipeline([w], [{ id: "p-1", email: "uxtest@example.com", createdAt: "2026-10-22T08:30:00Z", betaCode: "X" }]);
    expect(row.stage).toBe("registrata");
    expect(row.accountId).toBe("p-1");
  });

  test("IP-06 le tre pagine usano la stessa regola e nessuna conta più per sola colonna status", () => {
    const cc = read("lib/data/command-center.ts");
    expect(cc).toContain("waitlistQueue(waitlist.items)");
    expect(cc).not.toContain('waitlist.items.filter((w) => w.status === "nuovo")');
    const lista = read("app/admin/lista-attesa/ListaAttesaAdminClient.tsx");
    expect(lista).toContain("inviteQueueState(i, i.account)");
    expect(lista).not.toContain('items.filter((i) => i.status === "nuovo")');
    expect(lista).toContain("INVITE_QUEUE_RULE");
    const fam = read("app/admin/famiglie/page.tsx");
    expect(fam).toContain("invitePipeline(data.waitlist, data.parents)");
    expect(fam).toContain("INVITE_QUEUE_RULE");
    expect(read("lib/data/admin-ops.ts")).toContain("findAccountsByEmail(supabase");
    expect(read("lib/data/waitlist.ts")).toContain("export async function findAccountsByEmail(");
    expect(INVITE_QUEUE_RULE).toContain("senza un account con la stessa email");
  });

  test("IP-07 niente date inventate: 'Segna come inviato' rifiutato se l'account esiste; archiviare non cancella invited_at", () => {
    const src = read("app/actions/waitlist-admin.ts");
    expect(src).toContain("non segno un invio con la data di oggi");
    expect(src).toContain('if (status === "invitato") patch.invited_at = nowIso;');
    expect(src).toContain('if (status === "nuovo") patch.invited_at = null;');
    expect(src).not.toContain('invited_at: status === "invitato" ? new Date().toISOString() : null');
    const lista = read("app/admin/lista-attesa/ListaAttesaAdminClient.tsx");
    expect(lista).toContain('{i.status !== "invitato" && !i.account && (');
    expect(lista).toContain('status === "nuovo" ? null : i.invitedAt');
  });
});

test.describe("IJ — percorso fino al Pilota", () => {
  const [registered] = invitePipeline([registrataViaCodice], []);

  test("IJ-01 benvenuto saltato ma app usata: attivazione visibile, walkthrough distinto", () => {
    const j = buildJourney(
      registered,
      { onboardingStatus: "skipped", firstActionAt: "2026-10-22T09:00:00Z", firstActionLabel: "Bambino aggiunto", lastSignInAt: "2026-10-25T18:00:00Z" },
      true
    );
    expect(j.pilotHref).toBe("/admin/one/pilot/acc-2");
    expect(j.walkthrough.value).toBe("Saltato");
    expect(j.walkthrough.detail).toContain("non conta come attivazione");
    expect(j.firstAction.detail).toBe("Bambino aggiunto");
    expect(j.returned.value).toBe("Sì");
    expect(j.inviteMarked.value).toBe("Non segnato");
    expect(j.inviteMarked.detail).toContain("nessuna data d'invio");
    expect(j.registered.detail).toBe("codice TRAMABETA26");
  });

  test("IJ-02 benvenuto completato senza uso; ritorno stesso giorno; dati non misurabili", () => {
    const noUse = buildJourney(registered, { onboardingStatus: "completed", firstActionAt: null, firstActionLabel: null, lastSignInAt: null }, true);
    expect(noUse.firstAction.value).toBe("Nessuna ancora");
    expect(noUse.firstAction.detail).toContain("uso non ancora iniziato");
    const sameDay = buildJourney(
      registered,
      { onboardingStatus: "completed", firstActionAt: "2026-10-22T09:00:00Z", firstActionLabel: "Bambino aggiunto", lastSignInAt: "2026-10-22T10:00:00Z" },
      true
    );
    expect(sameDay.returned.value).toBe("Non ancora");
    const noKey = buildJourney(
      registered,
      { onboardingStatus: "completed", firstActionAt: "2026-10-22T09:00:00Z", firstActionLabel: "Bambino aggiunto", lastSignInAt: null },
      false
    );
    expect(noKey.returned.value).toBe("Non misurabile");
    const outside = buildJourney({ ...registered, inPilot: false }, null, true);
    expect(outside.pilotHref).toBeNull();
    expect(outside.firstAction.unknown).toBe(true);
    const [notRegistered] = invitePipeline([senzaAccount], []);
    expect(buildJourney(notRegistered, null, true).registered.value).toBe("—");
  });

  test("IJ-03 Inviti e registrazioni porta alla scheda Pilota e mostra le colonne del percorso", () => {
    const fam = read("app/admin/famiglie/page.tsx");
    for (const h of ["Benvenuto", "Prima azione utile", "Ritorno", "Invito segnato", "Scheda Pilota →"]) expect(fam).toContain(h);
    expect(fam).toContain("getPilotUsers()");
  });
});

test.describe("IF — funnel: unità, periodo, non tracciati", () => {
  const period = { preset: "custom" as const, from: "2026-11-01", to: "2026-11-16", label: "1–16 nov" };
  const raw = {
    landingViews: ["2026-10-20T10:00:00Z", "2026-11-02T10:00:00Z", "2026-11-03T10:00:00Z", "2026-11-03T11:00:00Z"],
    requests: [
      { createdAt: "2026-11-05T10:00:00Z", invitedAt: null, status: "nuovo" as const, hasAccount: true },
      { createdAt: "2026-11-06T10:00:00Z", invitedAt: "2026-11-07T10:00:00Z", status: "invitato" as const, hasAccount: false },
      { createdAt: "2026-10-01T10:00:00Z", invitedAt: null, status: "archiviato" as const, hasAccount: false },
    ],
    accounts: [
      { createdAt: "2026-11-05T10:30:00Z", withCode: true, fromRequest: true },
      { createdAt: "2026-10-10T10:30:00Z", withCode: true, fromRequest: false },
    ],
    excludedAccounts: 3,
  };

  test("IF-01 ogni conteggio ha unità e periodo; i non tracciati sono dichiarati", () => {
    const rows = computePreFunnel(raw, period);
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by.visite.value).toBe(3);
    expect(by.visite.unit).toContain("non persone");
    expect(by.visite.scope).toContain("tracciate dal");
    expect(by.richieste.value).toBe(2);
    expect(by.segnato.value).toBe(1);
    expect(by.account.value).toBe(1);
    expect(by.account.unit).toContain("persone");
    expect(by.account.rule).toContain("(3 in tutto)");
    expect(by.registrate_senza_invio.value).toBe(1);
    for (const k of ["preparato", "consegnato", "codice"]) expect(by[k].value).toBeNull();
    for (const r of rows) {
      expect(r.unit.length).toBeGreaterThan(0);
      expect(r.scope.length).toBeGreaterThan(0);
      expect(`${r.label} ${r.detail ?? ""} ${r.unit}`).not.toContain("%");
    }
  });

  test("IF-02 nessuna percentuale fra unità diverse; il funnel famiglie dichiara unità, data e denominatore", () => {
    expect(PRE_FUNNEL_NOTE).toContain("nessuna percentuale");
    const scope = familyFunnelScope(period);
    expect(scope).toContain("Unità: famiglie");
    expect(scope).toContain("16 nov");
    expect(scope).toContain("denominatore");
    const sections = read("app/admin/beta/sections.tsx");
    expect(sections).toContain("view.preFunnel &&");
    expect(sections).toContain("Non tracciato");
    expect(sections).toContain("familyFunnelScope(view.period)");
    // Il funnel famiglie esistente resta: stessa tabella e stessa regola countOf.
    expect(sections).toContain("countOf(f.reached, total)");
  });
});
