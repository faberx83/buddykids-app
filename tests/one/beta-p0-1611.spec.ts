// TRAMA — LOTTO P0 BETA READINESS (16/11/2026). Richiesta di Fabrizio:
// "Procediamo con il Lotto P0 — Beta Readiness TRAMA… Badge DEMO…
// Segnalazione problemi pre-login…". Triage:
// claude/TRIAGE_brief_catalogo_feedback_1611.md; iniziativa:
// claude/INIZIATIVA_beta_p0_1611.md. Logica pura + controlli sul sorgente;
// le prove nel browser restano "pending local verification".
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { isDemoActivity, activitySourceBadge, DEMO_BADGE, DEMO_NOTE } from "../../lib/nextgen/demo-label";
import {
  ACCESS_PROBLEM_MIN_FILL_MS,
  checkAccessProblem,
  redactSecrets,
  safeAccessPath,
} from "../../lib/nextgen/access-problem";
import { REAL_DISCOVERY_LEADS, verifiedOnLabel } from "../../lib/discovery/real-dataset";

const ROOT = path.join(__dirname, "../..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");

test.describe("Badge DEMO", () => {
  test("i nomi dei centri di prova visibili oggi in produzione sono tutti DEMO", () => {
    // Elenco letto in sola lettura il 16/11/2026 (centri con is_test_fixture = false).
    for (const center of [
      "Accademia CreArte · centro di prova",
      "Campo Brera · centro di prova",
      "Centro Demo",
      "Centro di Prova",
      "Centro prova candidatura",
      "Centro Sportivo Lido · centro di prova",
      "Scuola di Musica Aria · centro di prova",
      "TechKids Milano · centro di prova",
    ]) {
      expect(isDemoActivity({ center, name: "Campus" }), center).toBe(true);
      expect(activitySourceBadge({ center, name: "Campus" })).toEqual({ label: DEMO_BADGE, demo: true });
    }
  });

  test("un centro vero resta Partner TRAMA (niente falsi positivi su parole comuni)", () => {
    for (const center of ["Leone XIII Sport", "Polisportiva Demolizioni Creative", "Centro Protesto", "Prova d'orchestra APS"]) {
      expect(isDemoActivity({ center, name: "Campus di Natale" }), center).toBe(false);
      expect(activitySourceBadge({ center, name: "Campus di Natale" }).label).toBe("Partner TRAMA");
    }
    expect(isDemoActivity(null)).toBe(false);
    expect(isDemoActivity({ center: "Centro vero", name: "UX DEMO ponte" })).toBe(true);
  });

  test("la nota DEMO dice che non è un'offerta reale e che non si paga", () => {
    expect(DEMO_NOTE).toMatch(/non è un'offerta reale/);
    expect(DEMO_NOTE).toMatch(/non si paga nulla/);
  });

  test("card Scopri, consigli in Home, scheda e riepilogo richiesta usano la stessa regola", () => {
    const card = read("components/nextgen/DiscoverResultCard.tsx");
    expect(card).toContain("activitySourceBadge(activity)");
    expect(card).toContain("{badge.label}");
    expect(card).not.toMatch(/>Partner TRAMA<\/span>/);

    const home = read("app/nextgen/HomeDashboardV2Client.tsx");
    expect(home).toContain("isDemoActivity(r.activity)");

    const detail = read("components/nextgen/ActivityDetailV2.tsx");
    expect(detail).toContain("isDemoActivity(activity)");
    expect(detail).toContain('data-testid="demo-notice"');

    const booking = read("app/booking/[id]/BookingClient.tsx");
    expect(booking).toContain("demo={isDemoActivity(activity)}");
    expect(booking).toContain('data-testid="demo-booking-note"');
  });
});

test.describe("Scoperte: data di verifica", () => {
  test("verifiedOnLabel formatta solo date ISO valide", () => {
    expect(verifiedOnLabel("2026-11-16")).toBe("Verificata il 16/11/2026");
    expect(verifiedOnLabel(null)).toBeNull();
    expect(verifiedOnLabel(undefined)).toBeNull();
    expect(verifiedOnLabel("16/11/2026")).toBeNull();
  });

  test("ogni verifiedOn del dataset è una data ISO non nel futuro", () => {
    const today = "2026-11-16";
    const withDate = REAL_DISCOVERY_LEADS.filter((l) => l.verifiedOn);
    expect(withDate.length).toBeGreaterThan(0);
    for (const l of withDate) {
      expect(l.verifiedOn, l.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(l.verifiedOn! <= today || process.env.TRAMA_ALLOW_FUTURE_VERIFY === "1", l.id).toBe(true);
    }
    expect(REAL_DISCOVERY_LEADS.find((l) => l.id === "milano-leone-xiii-christmas-camp-2026")?.verifiedOn).toBe("2026-11-16");
  });

  test("la card Scoperta mostra la riga solo se c'è la data", () => {
    const src = read("components/nextgen/DiscoveryLeadCard.tsx");
    expect(src).toContain("verifiedOnLabel(lead.verifiedOn) &&");
    expect(src).toContain('data-testid="lead-verified-on"');
  });
});

test.describe("Problemi ad accedere? (senza account)", () => {
  const ok = { kind: "link", message: "Il link dell'invito dice che è scaduto", elapsedMs: 8000 };

  test("una segnalazione valida diventa una riga 'accesso' senza genitore", () => {
    const r = checkAccessProblem({ ...ok, email: "Mario.Rossi@Gmail.com", fromPath: "/auth/login?beta=TRAMABETA26" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.parent_id).toBeNull();
    expect(r.row.app_source).toBe("accesso");
    expect(r.row.status).toBe("nuovo");
    expect(r.row.category).toBe("problema");
    expect(r.row.contact_email).toBe("mario.rossi@gmail.com");
    // Mai il codice beta o altri parametri nella coda Admin.
    expect(r.row.page_path).toBe("/auth/login");
    expect(JSON.stringify(r.row)).not.toContain("TRAMABETA26");
    expect(r.row.message.startsWith("[Il link d'invito")).toBe(true);
  });

  test("anti-programmi: campo nascosto o invio troppo rapido → scartato", () => {
    expect(checkAccessProblem({ ...ok, website: "http://spam" })).toMatchObject({ ok: false, field: "bot" });
    expect(checkAccessProblem({ ...ok, elapsedMs: ACCESS_PROBLEM_MIN_FILL_MS - 1 })).toMatchObject({ ok: false, field: "bot" });
    expect(checkAccessProblem({ ...ok, elapsedMs: undefined })).toMatchObject({ ok: false, field: "bot" });
  });

  test("testo troppo corto o email sbagliata → messaggio chiaro", () => {
    expect(checkAccessProblem({ ...ok, message: "aiuto" })).toMatchObject({ ok: false, field: "message" });
    expect(checkAccessProblem({ ...ok, email: "mario@" })).toMatchObject({ ok: false, field: "email" });
    const noEmail = checkAccessProblem({ ...ok, email: "  " });
    expect(noEmail.ok && noEmail.row.contact_email).toBeNull();
  });

  test("token e link con parametri incollati nel testo vengono tolti", () => {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghij";
    const out = redactSecrets(`ho aperto https://tramapp.it/auth/callback?code=abc123&type=signup e poi ${token}`);
    expect(out).toContain("https://tramapp.it/auth/callback [parametri tolti]");
    expect(out).not.toContain("abc123");
    expect(out).not.toContain(token);
    expect(safeAccessPath("//evil.example/x")).toBe("/auth/login");
    expect(safeAccessPath("https://evil.example")).toBe("/auth/login");
  });

  test("tipo sconosciuto → 'altro'; testo lungo tagliato", () => {
    const r = checkAccessProblem({ ...ok, kind: "<script>", message: "x".repeat(5000) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.client_context.kind).toBe("altro");
    expect(r.row.message.length).toBeLessThan(1600);
  });

  test("link nella pagina di accesso (famiglie e centri, non Admin) e pagina pubblica non indicizzata", () => {
    const login = read("app/auth/login/LoginForm.tsx");
    expect(login).toContain('href="/auth/problemi"');
    expect(login).toContain("Problemi ad accedere?");
    expect(login).toMatch(/\{!isAdmin && \(\s*<Link\s+href="\/auth\/problemi"/);
    const page = read("app/auth/problemi/page.tsx");
    expect(page).toContain("index: false");
    const form = read("app/auth/problemi/AccessProblemForm.tsx");
    expect(form).toContain('name="website"');
    expect(form).toContain("Non scrivere password o codici");
  });

  test("l'azione scrive col client di servizio solo dopo i controlli, con tetto orario e doppioni", () => {
    const src = read("app/actions/access-problem.ts");
    expect(src.indexOf("checkAccessProblem(input)")).toBeLessThan(src.indexOf("createServiceClient()"));
    expect(src).toContain("ACCESS_PROBLEM_HOURLY_CAP");
    expect(src).toContain('.eq("message", row.message)');
    expect(src).toContain("sendEmail(");
    expect(src).not.toMatch(/x-forwarded-for|remoteAddress/i);
  });

  test("migration 62 PREPARATA, additiva, con vincolo parent_id solo per 'accesso'", () => {
    const sql = read("supabase/migration_62_segnalazioni_accesso.sql");
    expect(sql.split("\n")[1]).toBe("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toContain("alter column parent_id drop not null");
    expect(sql).toContain("check (app_source in ('genitori', 'gestore', 'accesso'))");
    expect(sql).toContain("check (parent_id is not null or app_source = 'accesso')");
    expect(sql).toContain("add column if not exists contact_email");
    expect(sql).not.toMatch(/^\s*(drop table|delete from|truncate)/im);
  });

  test("la coda Admin riconosce 'accesso' e mostra l'email di risposta", () => {
    const admin = read("app/admin/segnalazioni-beta/SegnalazioniBetaAdminClient.tsx");
    expect(admin).toContain('accesso: { label: "Accesso (senza account)"');
    expect(admin).toContain("item.contactEmail");
    const data = read("lib/data/beta-feedback.ts");
    expect(data).toContain("contact_email");
    expect(data).toContain("isMissingColumnError(error)");
  });
});
