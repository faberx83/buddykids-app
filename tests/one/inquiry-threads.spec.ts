// Messaggi con il centro come conversazione (27/10/2026; approvato il 15/10,
// richiamato da Fabrizio: "un botta e risposta e non n messaggi diversi").
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  INQUIRY_THREADS_FLAG,
  cleanMessageBody,
  headerAfterMessage,
  isMissingRelationError,
  messageTimeLabel,
  previewLine,
  threadMessages,
} from "../../lib/inquiries/thread";
import { centerNewMessageEmail } from "../../lib/centers/pilot-emails";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");

const header = { id: "i1", message: "Ci sono posti?", reply: "Sì, 3", createdAt: "2026-10-20T08:00:00Z", repliedAt: "2026-10-20T10:00:00Z" };

test.describe("Conversazione: logica pura", () => {
  test("IT-01 senza messaggi salvati la conversazione si ricostruisce dal ticket (domanda + risposta)", () => {
    const m = threadMessages(header, null);
    expect(m.map((x) => [x.side, x.body])).toEqual([
      ["parent", "Ci sono posti?"],
      ["center", "Sì, 3"],
    ]);
    expect(threadMessages({ ...header, reply: null }, []).length).toBe(1);
  });

  test("IT-02 con messaggi salvati vale la tabella, in ordine di tempo", () => {
    const m = threadMessages(header, [
      { id: "b", side: "center", body: "Sabato no", createdAt: "2026-10-21T09:00:00Z" },
      { id: "a", side: "parent", body: "E il sabato?", createdAt: "2026-10-21T08:00:00Z" },
    ]);
    expect(m.map((x) => x.body)).toEqual(["E il sabato?", "Sabato no"]);
  });

  test("IT-03 stato dopo un messaggio: la famiglia riapre (da rispondere), il centro risponde (nuovo per la famiglia)", () => {
    const p = headerAfterMessage("parent", "x", "T");
    expect(p).toMatchObject({ status: "aperta", read_by_center: false, read_by_parent: true, last_message_at: "T" });
    const c = headerAfterMessage("center", "ok", "T");
    expect(c).toMatchObject({ status: "risposta", reply: "ok", replied_at: "T", read_by_parent: false, read_by_center: true });
  });

  test("IT-04 testo: vuoto o troppo lungo rifiutato; anteprima con chi ha scritto", () => {
    expect(cleanMessageBody("  ").ok).toBe(false);
    expect(cleanMessageBody("x".repeat(4001)).ok).toBe(false);
    expect(cleanMessageBody("  ciao ")).toEqual({ ok: true, body: "ciao" });
    const last = { id: "1", side: "center" as const, body: "Sì,\n  abbiamo posto", createdAt: "" };
    expect(previewLine(last, "parent")).toBe("Centro: Sì, abbiamo posto");
    expect(previewLine(last, "center")).toBe("Tu: Sì, abbiamo posto");
    expect(previewLine({ ...last, side: "parent" }, "center")).toBe("Famiglia: Sì, abbiamo posto");
  });

  test("IT-05 orario all'italiana, fuso di Roma", () => {
    const now = new Date("2026-10-27T16:00:00Z");
    expect(messageTimeLabel("2026-10-27T13:05:00Z", now)).toBe("oggi 14:05");
    expect(messageTimeLabel("2026-10-26T08:12:00Z", now)).toBe("ieri 09:12");
    expect(messageTimeLabel("2026-10-12T16:30:00Z", now)).toBe("12 ott 18:30");
  });

  test("IT-06 tabella mancante riconosciuta (ricaduta sul ticket)", () => {
    expect(isMissingRelationError({ code: "42P01" })).toBe(true);
    expect(isMissingRelationError({ code: "PGRST205", message: "Could not find the table" })).toBe(true);
    expect(isMissingRelationError({ code: "23505", message: "duplicate" })).toBe(false);
  });

  test("IT-07 email al centro per un nuovo messaggio: testo ripulito, link alla conversazione", () => {
    const m = centerNewMessageEmail({ activityName: "Ponte", parentFirstName: "<b>Ada</b>", preview: "Ciao <script>", inquiryId: "abc" });
    expect(m.subject).toBe("Nuovo messaggio: Ponte");
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<b>Ada</b>");
    expect(m.html).toContain("https://partner.tramapp.it/center/richieste/abc");
  });
});

test.describe("Conversazione: flusso (controlli sul sorgente)", () => {
  test("IT-10 flag e catalogo: spento di default, accendibile", () => {
    expect(INQUIRY_THREADS_FLAG).toBe("INQUIRY_THREADS_ENABLED");
    expect(FEATURE_FLAG_REGISTRY.INQUIRY_THREADS_ENABLED.defaultValue).toBe(false);
    const e = FEATURE_CATALOG.find((x) => x.key === "inquiry_threads");
    expect(e?.flagName).toBe("INQUIRY_THREADS_ENABLED");
    expect(e?.releaseEligible).toBe(true);
  });

  test("IT-11 migration 54: additiva, messaggi mai modificati, regole di scrittura per lato, backfill senza doppioni", () => {
    const sql = read("supabase/migration_54_messaggi_centro.sql");
    expect(sql.split("\n")[1]).toBe("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toContain("create table if not exists public.inquiry_messages");
    expect(sql).toContain("alter table public.inquiry_messages enable row level security;");
    expect(sql).not.toMatch(/for (update|delete)/);
    expect(sql).toContain("and author_side = 'parent'");
    expect(sql).toContain("and author_side = 'center'");
    expect(sql).toContain("and not exists (select 1 from public.inquiry_messages m where m.inquiry_id = i.id);");
  });

  test("IT-12 'Contatta il gestore' riprende la conversazione aperta su quell'attività (solo col flag)", () => {
    const a = read("app/actions/inquiries.ts");
    const fn = a.slice(a.indexOf("export async function createInquiryAction"), a.indexOf("async function sendParentMessage"));
    expect(fn).toContain("if (threads) {");
    expect(fn).toContain("const existing = await findOpenInquiryForActivity(supabase, user.id, input.activityDbId);");
    expect(fn).toContain('await appendMessage(supabase, created.id as string, user.id, "parent", clean.body, at);');
  });

  test("IT-13 la risposta del centro è un messaggio in più e resta anche in 'reply' (Admin SLA, badge, notifiche)", () => {
    const a = read("app/actions/inquiries.ts");
    const fn = a.slice(a.indexOf("export async function replyToInquiryAction"), a.indexOf("export async function markInquiriesReadAction"));
    expect(fn).toContain('headerAfterMessage("center", clean.body, at)');
    expect(fn).toContain('await appendMessage(supabase, input.inquiryId, user.id, "center", clean.body, at);');
    expect(fn).toContain("deepLink: `/nextgen/richieste/${input.inquiryId}`");
  });

  test("IT-14 pagine: elenco e conversazione dietro il flag per famiglia e centro; spento = come prima", () => {
    const pp = read("app/nextgen/richieste/page.tsx");
    expect(pp).toContain("return <RichiesteView inquiries={inquiries} showBrandIcon />;");
    expect(pp).toContain("<MessaggiV2View");
    expect(read("app/nextgen/richieste/[id]/page.tsx")).toContain('if (!threads) redirect("/nextgen/richieste");');
    const cp = read("app/center/richieste/page.tsx");
    expect(cp).toContain("if (!threads) return <RichiesteClient initialInquiries={inquiries} />;");
    expect(read("app/center/richieste/[id]/page.tsx")).toContain('if (!threads) redirect("/center/richieste");');
    const v = read("components/inquiries/InquiryThreadView.tsx");
    expect(v).toContain("markInquiriesReadAction({ ids: [thread.id], side: viewer, read: true })");
  });

  test("IT-15 foglio 'Contatta il gestore' V2 col flag (risolto all'apertura), vecchio foglio altrimenti", () => {
    const b = read("components/ContactCenterButton.tsx");
    expect(b).toContain("const ctx = await getContactContextAction(activityDbId);");
    expect(b).toContain("{open && threads && (");
    expect(b).toContain("{open && threads === false && (");
    expect(b).toContain("Continua la conversazione");
  });
});
