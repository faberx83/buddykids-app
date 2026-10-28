// Portale centri V2, fase 1: attivazione del centro (27/10/2026).
// Decisioni di Fabrizio: timeline + % profilo, attività visibili solo dopo
// l'approvazione, identità confermata da TRAMA (niente documenti).
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  PARTNER_V2_FLAG,
  activationView,
  adminBucket,
  canApprove,
  daysWaiting,
  profileChecks,
  type ActivationFacts,
  type CenterProfileFacts,
} from "../../lib/centers/activation";
import { activationApprovedEmail, activationChangesEmail, activationSubmittedNoticeEmail } from "../../lib/centers/pilot-emails";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");

const fullProfile: CenterProfileFacts = {
  name: "Centro prova",
  city: "Milano",
  contactEmail: "info@centro.it",
  contactPhone: null,
  description: "Laboratori creativi e sport per bambini dai 6 agli 11 anni.",
  address: "Via Roma 1",
  cancellationWindowDays: 3,
  cancellationConfirmed: true,
  activitiesWithFutureDates: 2,
};
const facts = (over: Partial<ActivationFacts> = {}, profile: Partial<CenterProfileFacts> = {}): ActivationFacts => ({
  status: "CLAIMED",
  profile: { ...fullProfile, ...profile },
  referentConfirmed: false,
  activitiesChecked: false,
  changesNote: null,
  submittedAt: null,
  ...over,
});

test.describe("Attivazione: logica pura", () => {
  test("AC-01 i 5 controlli del profilo si calcolano dai dati", () => {
    expect(profileChecks(fullProfile).every((c) => c.done)).toBe(true);
    const empty = profileChecks({
      ...fullProfile,
      contactEmail: null,
      contactPhone: " ",
      description: "Breve",
      address: "",
      cancellationConfirmed: false,
      activitiesWithFutureDates: 0,
    });
    expect(empty.map((c) => [c.key, c.done])).toEqual([
      ["contacts", false],
      ["description", false],
      ["address", false],
      ["cancellation", false],
      ["activity", false],
    ]);
    expect(empty.find((c) => c.key === "cancellation")?.hint).toBe("Si annulla senza costi fino a 3 giorni prima");
  });

  test("AC-02 percentuale, passo e chi deve agire mentre il centro compila", () => {
    const v = activationView(facts({ status: "LEAD" }, { address: null, cancellationConfirmed: false }));
    expect(v.percent).toBe(60);
    expect(v.current).toBe("profilo");
    expect(v.actor).toBe("centro");
    expect(v.steps.map((s) => s.state)).toEqual(["done", "done", "current", "todo", "todo"]);
    expect(v.canSubmit).toBe(false);
    expect(v.needsClaim).toBe(true);
    expect(v.headline).toBe("Ancora 2 cose e potete inviare il profilo a TRAMA.");
  });

  test("AC-03 profilo completo → si può inviare; inviato → tocca a TRAMA", () => {
    expect(activationView(facts()).canSubmit).toBe(true);
    const sent = activationView(facts({ status: "SUBMITTED", submittedAt: "2026-10-28T09:00:00Z" }));
    expect(sent.current).toBe("verifica");
    expect(sent.actor).toBe("trama");
    expect(sent.canSubmit).toBe(false);
    expect(sent.submittedAt).toBe("2026-10-28T09:00:00Z");
  });

  test("AC-04 modifica richiesta: si torna al profilo con la nota, reinviabile", () => {
    const v = activationView(facts({ status: "CHANGES_REQUESTED", changesNote: "Manca l'orario di uscita" }));
    expect(v.current).toBe("profilo");
    expect(v.changesNote).toBe("Manca l'orario di uscita");
    expect(v.canSubmit).toBe(true);
  });

  test("AC-05 attivo (o centro senza stato) e sospeso", () => {
    expect(activationView(facts({ status: "APPROVED" })).active).toBe(true);
    expect(activationView(facts({ status: null })).active).toBe(true);
    const s = activationView(facts({ status: "SUSPENDED" }));
    expect(s.active).toBe(false);
    expect(s.suspended).toBe(true);
    expect(s.actor).toBe("trama");
  });

  test("AC-06 Admin: gruppi, Approva solo da inviato con le due verifiche, giorni di attesa", () => {
    expect(adminBucket("SUBMITTED")).toBe("trama");
    expect(adminBucket("CLAIMED")).toBe("centro");
    expect(adminBucket("CHANGES_REQUESTED")).toBe("centro");
    expect(adminBucket("APPROVED")).toBe("attivi");
    expect(adminBucket(null)).toBe("attivi");
    expect(canApprove({ status: "SUBMITTED", referentConfirmed: true, activitiesChecked: true })).toBe(true);
    expect(canApprove({ status: "SUBMITTED", referentConfirmed: true, activitiesChecked: false })).toBe(false);
    expect(canApprove({ status: "CLAIMED", referentConfirmed: true, activitiesChecked: true })).toBe(false);
    expect(daysWaiting("2026-10-25T10:00:00Z", new Date("2026-10-28T09:00:00Z"))).toBe(2);
    expect(daysWaiting(null)).toBe(null);
  });

  test("AC-07 email: testo del centro e nota ripuliti, link giusti", () => {
    const c = activationChangesEmail({ centerName: "<b>X</b>", note: "Manca <script>" });
    expect(c.html).not.toContain("<script>");
    expect(c.html).toContain("https://partner.tramapp.it/center");
    expect(activationApprovedEmail({ centerName: "Girasole" }).subject).toBe("Girasole è attivo su TRAMA");
    expect(activationSubmittedNoticeEmail({ centerName: "Girasole", city: "Milano" }).html).toContain(
      "https://admin.tramapp.it/admin/centri-attivazione"
    );
  });
});

test.describe("Attivazione: flusso (controlli sul sorgente)", () => {
  test("AC-10 flag e catalogo", () => {
    expect(PARTNER_V2_FLAG).toBe("PARTNER_V2_ENABLED");
    expect(FEATURE_FLAG_REGISTRY.PARTNER_V2_ENABLED.defaultValue).toBe(false);
    const e = FEATURE_CATALOG.find((x) => x.key === "partner_v2");
    expect(e?.flagName).toBe("PARTNER_V2_ENABLED");
    expect(e?.releaseEligible).toBe(true);
  });

  test("AC-11 migration 55: additiva, solo Admin, Approva solo da SUBMITTED con le due verifiche", () => {
    const sql = read("supabase/migration_55_attivazione_centro.sql");
    expect(sql.split("\n")[1]).toBe("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toContain("add column if not exists referent_confirmed_at timestamptz");
    expect(sql).toContain("if v_row.center_id is null or v_row.status <> 'SUBMITTED' then");
    expect(sql).toContain("if v_row.referent_confirmed_at is null or v_row.activities_checked_at is null then");
    expect((sql.match(/if not public\.is_platform_admin\(\) then/g) ?? []).length).toBe(2);
    expect(sql).toContain("revoke execute on function public.admin_approve_center_activation(uuid, text) from public, anon;");
  });

  test("AC-12 'Invia a TRAMA' ricalcola i controlli lato server e fa il claim se serve", () => {
    const a = read("app/actions/center-activation.ts");
    const fn = a.slice(a.indexOf("export async function submitActivationAction"), a.indexOf("// ─── Admin"));
    expect(fn).toContain("const view = activationView(mine.facts);");
    expect(fn).toContain("if (!view.canSubmit) {");
    expect(fn.indexOf('rpc("center_claim_onboarding"')).toBeLessThan(fn.indexOf('rpc("center_submit_onboarding"'));
    expect(a).toContain('p_decision: "request_changes"');
    expect(a).toContain('if (!text) return { error: "Scrivi cosa va modificato');
  });

  test("AC-13 Oggi: card di attivazione col flag, niente rimando a TRAMA ONE; senza flag come prima", () => {
    const p = read("app/center/page.tsx");
    expect(p).toContain("if (!partnerV2) await maybeRedirectToOnboarding();");
    expect(p).toContain("{activationState && !activationState.active && <ActivationCard view={activationState} />}");
    expect(p).toContain("{onboardingIncomplete && !isMockCenter && !activationState && (");
    expect(p).not.toContain("Finché il profilo non è Approvato, la tua attività non è visibile alle famiglie.");
  });

  test("AC-14 catalogo famiglie: centri non attivi fuori da Scopri, Home e gruppi (solo col flag; l'Admin vede tutto)", () => {
    const d = read("lib/data/center-activation.ts");
    expect(d).toContain('if (!isSupabaseConfigured || role === "platform_admin") return new Set();');
    expect(d).toContain('.neq("status", "APPROVED")');
    expect(d).toContain("flagName: PARTNER_V2_FLAG");
    for (const f of ["app/nextgen/search/page.tsx", "app/nextgen/home-v2-data.ts", "app/nextgen/groups/[id]/page.tsx"]) {
      expect(read(f), f).toContain("getInactiveCenterIdsForViewer(");
    }
  });

  test("AC-15 Admin: pagina e voce di menu", () => {
    expect(read("app/admin/layout.tsx")).toContain('{ href: "/admin/centri-attivazione", label: "Centri da attivare"');
    const c = read("app/admin/centri-attivazione/ActivationAdminClient.tsx");
    expect(c).toContain("disabled={!selected.canApprove || busy !== null}");
    expect(c).toContain("Referente e telefono confermati con la telefonata");
  });

  test("AC-16 salvare il profilo conferma le regole di cancellazione (best-effort)", () => {
    const a = read("app/actions/center.ts");
    expect(a).toContain('item_key: "cancellation_policy_set"');
  });
});
