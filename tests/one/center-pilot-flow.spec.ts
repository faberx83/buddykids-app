// Revisione del processo di candidatura dei centri + percorso del pilota
// (27/10/2026, claude/INIZIATIVA_partner_admin_v2.md, P0).
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  CENTER_PILOT_FLOW_FLAG,
  PARTNER_PUBLIC_ORIGIN,
  candidacyAdminNoticeEmail,
  candidacyApprovedEmail,
  candidacyReceivedEmail,
  centerNewRequestEmail,
  isTestCandidacyName,
  partnerSignupUrl,
  requestSizeLabel,
} from "../../lib/centers/pilot-emails";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { getReleaseById } from "../../lib/releases/catalog";
import { isKnownProductEvent } from "../../lib/telemetry/known-events";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");

test.describe("Candidatura dei centri: email (logica pura)", () => {
  test("CP-01 nuova richiesta: attività, quantità e link diretto alle prenotazioni del portale centri", () => {
    const m = centerNewRequestEmail({ activityName: "Ponte (prova)", kids: 2, days: 3, weeks: 0 });
    expect(m.subject).toBe("Nuova richiesta: Ponte (prova)");
    expect(m.html).toContain("3 giorni per 2 bambini");
    expect(m.html).toContain(`${PARTNER_PUBLIC_ORIGIN}/center/prenotazioni`);
    expect(requestSizeLabel(0, 1)).toBe("1 settimana");
    expect(requestSizeLabel(1, 4)).toBe("1 giorno");
    expect(requestSizeLabel(0, 0)).toBe("");
    const unnamed = centerNewRequestEmail({ activityName: null, kids: 0, days: 0, weeks: 0 });
    expect(unnamed.subject).toBe("Nuova richiesta: una vostra attività");
  });

  test("CP-02 i dati scritti dal candidato sono sempre ripuliti (nessun HTML iniettabile)", () => {
    const evil = "<script>x</script>";
    const notice = candidacyAdminNoticeEmail({ centerName: evil, locality: evil, email: "a@b.it", phone: null, description: evil, source: "mail1" });
    expect(notice.html).not.toContain("<script>");
    expect(notice.html).toContain("&lt;script&gt;");
    expect(notice.html).toContain("Arrivata da:</b> mail1");
    expect(notice.html).toContain("https://admin.tramapp.it/admin/center-leads");
    expect(candidacyReceivedEmail({ centerName: evil, statusUrl: null }).html).not.toContain("<script>");
  });

  test("CP-03 conferma al candidato: link allo stato sul portale centri, nessun pulsante se manca", () => {
    const m = candidacyReceivedEmail({ centerName: "Girasole", statusUrl: `${PARTNER_PUBLIC_ORIGIN}/auth/candidati/conferma/abc` });
    expect(m.subject).toBe("Abbiamo ricevuto la vostra candidatura");
    expect(m.html).toContain("/auth/candidati/conferma/abc");
    expect(m.html).toContain("stesso indirizzo");
  });

  test("CP-04 approvazione: 'Crea l'accesso' con l'email già compilata, oppure 'Entra' se l'account c'è già", () => {
    expect(partnerSignupUrl("a+b@x.it")).toBe("https://partner.tramapp.it/auth/login?mode=signup&email=a%2Bb%40x.it");
    const fresh = candidacyApprovedEmail({ centerName: "Girasole", email: "a+b@x.it", alreadyRegistered: false });
    expect(fresh.subject).toBe("Girasole è su TRAMA");
    expect(fresh.html).toContain("Crea l&#39;accesso");
    expect(fresh.html).toContain("mode=signup&amp;email=a%2Bb%40x.it");
    const known = candidacyApprovedEmail({ centerName: "Girasole", email: "a@x.it", alreadyRegistered: true });
    expect(known.html).toContain("Entra nel portale");
    expect(known.html).not.toContain("mode=signup");
  });

  test("CP-05 candidature dei test automatici ([TEST] …) senza email", () => {
    expect(isTestCandidacyName("[TEST] Centro Autocandidatura 1")).toBe(true);
    expect(isTestCandidacyName("  [test] x")).toBe(true);
    expect(isTestCandidacyName("Centro di Prova")).toBe(false);
  });
});

test.describe("Candidatura dei centri: flusso (controlli sul sorgente)", () => {
  test("CP-10 flag, catalogo e release: spento di default, accendibile dalla card Release", () => {
    expect(CENTER_PILOT_FLOW_FLAG).toBe("CENTER_PILOT_FLOW_ENABLED");
    expect(FEATURE_FLAG_REGISTRY.CENTER_PILOT_FLOW_ENABLED.defaultValue).toBe(false);
    const entry = FEATURE_CATALOG.find((e) => e.key === "center_pilot_flow");
    expect(entry?.flagName).toBe("CENTER_PILOT_FLOW_ENABLED");
    expect(entry?.area).toBe("partner");
    expect(entry?.releaseEligible).toBe(true);
    // 27/10/2026: nella stessa release anche i messaggi come conversazione (un solo interruttore)
    expect(getReleaseById("centri-percorso-pilota")?.featureKeys).toEqual(["center_pilot_flow", "inquiry_threads", "partner_v2"]);
  });

  test("CP-11 nuova prenotazione: dopo la push, l'email ai gestori; tutto dentro il try della push (mai blocca la prenotazione)", () => {
    const a = read("app/booking/[id]/actions.ts");
    const push = a.indexOf('title: "Nuova prenotazione"');
    const mail = a.indexOf("await emailCenterAdminsOfNewRequest({");
    const catchAt = a.indexOf("Errore inatteso durante la push al centro");
    expect(push).toBeGreaterThan(0);
    expect(mail).toBeGreaterThan(push);
    expect(catchAt).toBeGreaterThan(mail);
    const n = read("lib/centers/notify-center.ts");
    expect(n).toContain('.eq("role", "center_admin")');
    expect(n).toContain('if (!(await flagOn(admin.id, "center_admin"))) continue;');
  });

  test("CP-12 candidatura: anti-bot, niente doppioni per la stessa email aperta, email solo dopo il salvataggio", () => {
    const a = read("app/actions/center-leads.ts");
    const fn = a.slice(a.indexOf("export async function submitCenterCandidacyAction"), a.indexOf("export async function getCandidacyStatusAction"));
    expect(fn).toContain('if ((input.website ?? "").trim()) return {};');
    expect(fn).toContain('.in("status", ["suggested", "qualified", "contacted"])');
    expect(fn).toContain("if (open && open.length > 0) return { id: open[0].id };");
    expect(fn.indexOf(".insert({")).toBeLessThan(fn.indexOf("await emailCandidacyReceived({"));
    expect(fn).toContain("if (!isTestCandidacyName(input.centerName)) await emailCandidacyReceived({");
    expect(fn).toContain("campaignSource: cleanSource(input.source)");
  });

  test("CP-13 approvazione: email al candidato dopo aver collegato la candidatura; messaggio Admin chiaro se l'account non c'è ancora", () => {
    const a = read("app/actions/center-leads.ts");
    const fn = a.slice(a.indexOf("export async function approveCandidacyAction"));
    expect(fn.indexOf('status: "claimed"')).toBeLessThan(fn.indexOf("await emailCandidacyApproved({"));
    expect(fn).toContain("alreadyRegistered: Boolean(result.assigned)");
    expect(fn).toContain('result.warning?.startsWith("Centro creato, ma nessun utente registrato")');
    // il testo di createCenterAndAssignAction da cui dipende il riconoscimento
    expect(read("app/actions/admin.ts")).toContain('"Centro creato, ma nessun utente registrato trovato con questa email.');
  });

  test("CP-14 pagina di conferma: 'Crea l'accesso' sempre sul portale centri, 'Entra' se l'account è già collegato", () => {
    const p = read("app/auth/candidati/conferma/[id]/page.tsx");
    expect(p).toContain("partnerSignupUrl(candidacy.candidateEmail)");
    expect(p).toContain("candidacy.registered ? (");
    expect(p).not.toContain('href={`/auth/login?mode=signup');
    for (const label of ['label: "In revisione"', "Candidatura non trovata", "Candidati come centro"]) expect(p).toContain(label);
    const d = read("lib/data/center-leads.ts");
    expect(d).toContain('.eq("center_id", data.claimed_center_id)');
  });

  test("CP-15 form: stesse etichette dei test di sempre, email controllata, provenienza passata", () => {
    const f = read("app/auth/candidati/CandidatiForm.tsx");
    for (const label of ["Nome del centro", "Città / zona", "Email di contatto", "Invia candidatura"]) expect(f).toContain(label);
    expect(f).toContain("const check = checkEmail(email);");
    expect(f).toContain("source,");
    expect(f).toContain("website,");
    expect(read("app/auth/candidati/page.tsx")).toContain("source={cleanSource(raw)}");
  });

  test("CP-16 pagina /centri pubblica, nel sitemap, senza invito a installare l'app; link da /benvenuto solo col flag", () => {
    expect(read("proxy.ts")).toContain('!pathname.startsWith("/centri") &&');
    expect(read("app/sitemap.ts")).toContain('url: "https://tramapp.it/centri"');
    expect(read("components/InstallPrompt.tsx")).toContain('pathname?.startsWith("/centri")');
    const page = read("app/centri/page.tsx");
    expect(page).toContain('event_name: "centers_landing_viewed"');
    expect(isKnownProductEvent("centers_landing_viewed")).toBe(true);
    const view = read("components/landing/CentriView.tsx");
    expect(view).toContain("Gratuito per tutto il pilota. Condizioni bloccate anche dopo.");
    expect(view).toContain("In TRAMA non si paga nulla");
    const b = read("components/landing/BenvenutoView.tsx");
    expect(b).toContain("{centersPage && (");
    expect(read("app/benvenuto/page.tsx")).toContain("flagName: CENTER_PILOT_FLOW_FLAG");
  });

  test("CP-17 portale centri: col percorso del pilota niente tour guidato né carosello", () => {
    const l = read("app/center/layout.tsx");
    expect(l).toContain('flagName: "CENTER_PILOT_FLOW_ENABLED"');
    expect(l).toContain("if (enabled && !pilotFlow) {");
  });

  test("CP-18 Admin: candidature dei centri separate dalle segnalazioni delle famiglie, candidature per prime", () => {
    const c = read("app/admin/center-leads/CenterLeadsAdminClient.tsx");
    expect(c).toContain('useState<"candidacy" | "referral" | "all">("candidacy")');
    expect(c).toContain("arrivata da: ${lead.demandContext.campaignSource}");
  });
});

test("CP-22 l'avviso di attivazione nel portale centri non dice più che le attività sono invisibili (il catalogo non legge lo stato)", () => {
  const dash = read("app/center/page.tsx");
  expect(dash).not.toContain("Finché il profilo non è Approvato, la tua attività non è visibile alle famiglie.");
});
