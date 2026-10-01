import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  buildFamilyPreviewHref,
  canUseFamilyPreview,
  isFamilyPreviewRequested,
  pickFamilyPreviewSlug,
  resolveFamilyPreview,
  FAMILY_PREVIEW_RETURN_HREF,
} from "../../lib/center/family-preview";

// TRAMA PARTNER — LIVE MOBILE BUGFIX (01/10/2026). "Vedi come ti vedono le
// famiglie" (Il mio centro): header card mobile + anteprima famiglia.
// [no browser]: logica pura + lettura statica dei call site reali, stesso
// principio del resto di tests/one. I controlli in browser (360/390/430px,
// click, ritorno) sono in tests/gestore/profilo-centro-mobile.spec.ts.
//
// Comando: npx playwright test tests/one/partner-family-preview.spec.ts

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf-8");
}

const PROFILE_PAGE = readSource("../../app/center/profile/page.tsx");
const ACTIVITY_PAGE = readSource("../../app/activity/[id]/page.tsx");
const DETAIL_CLIENT = readSource("../../app/activity/[id]/DetailClient.tsx");
const PREVIEW_BAR = readSource("../../app/activity/[id]/FamilyPreviewBar.tsx");
const PROXY = readSource("../../proxy.ts");
const ACTIVITIES_DATA = readSource("../../lib/data/activities.ts");

test.describe("TRAMA Partner — anteprima famiglia: logica [no browser]", () => {
  test("PFP-01: href = route pubblica esistente /activity/<slug> + ?anteprima=partner", () => {
    expect(buildFamilyPreviewHref("prova-fp")).toBe("/activity/prova-fp?anteprima=partner");
    // slug con caratteri speciali → codificato, mai un path rotto
    expect(buildFamilyPreviewHref("a b/c")).toBe("/activity/a%20b%2Fc?anteprima=partner");
  });

  test("PFP-02: prima attività con slug valido; nessuna → null (stato B)", () => {
    expect(pickFamilyPreviewSlug([{ id: "prima" }, { id: "seconda" }])).toBe("prima");
    expect(pickFamilyPreviewSlug([{ id: "" }, { id: "seconda" }])).toBe("seconda");
    expect(pickFamilyPreviewSlug([])).toBeNull();
    expect(pickFamilyPreviewSlug([{ id: null }, { id: undefined }])).toBeNull();
  });

  test("PFP-03: parametro riconosciuto solo col valore esatto", () => {
    expect(isFamilyPreviewRequested("partner")).toBe(true);
    expect(isFamilyPreviewRequested(["partner"])).toBe(true);
    expect(isFamilyPreviewRequested("1")).toBe(false);
    expect(isFamilyPreviewRequested(undefined)).toBe(false);
    expect(isFamilyPreviewRequested(null)).toBe(false);
  });

  test("PFP-04: gestore del centro dell'attività → anteprima consentita", () => {
    expect(
      canUseFamilyPreview({
        requested: true,
        viewerCenterDbId: "c-1",
        viewerCenterSlug: "centro-a",
        activityCenterDbId: "c-1",
        activityCenterSlug: "centro-a",
        supabaseConfigured: true,
      })
    ).toBe(true);
  });

  test("PFP-05: gestore di UN ALTRO centro → nessuna anteprima", () => {
    expect(
      canUseFamilyPreview({
        requested: true,
        viewerCenterDbId: "c-1",
        viewerCenterSlug: "centro-a",
        activityCenterDbId: "c-2",
        activityCenterSlug: "centro-b",
        supabaseConfigured: true,
      })
    ).toBe(false);
  });

  test("PFP-06: genitore / anonimo (nessun center_id) → nessuna anteprima", () => {
    for (const viewerCenterDbId of [null, ""]) {
      expect(
        canUseFamilyPreview({
          requested: true,
          viewerCenterDbId,
          viewerCenterSlug: null,
          activityCenterDbId: "c-1",
          activityCenterSlug: "centro-a",
          supabaseConfigured: true,
        })
      ).toBe(false);
    }
  });

  test("PFP-07: con Supabase conta SOLO l'uuid, non lo slug (slug uguale ma uuid diverso → no)", () => {
    expect(
      canUseFamilyPreview({
        requested: true,
        viewerCenterDbId: "c-1",
        viewerCenterSlug: "centro-a",
        activityCenterDbId: "c-2",
        activityCenterSlug: "centro-a",
        supabaseConfigured: true,
      })
    ).toBe(false);
  });

  test("PFP-08: senza parametro → mai anteprima, anche per il proprio centro", () => {
    expect(
      canUseFamilyPreview({
        requested: false,
        viewerCenterDbId: "c-1",
        viewerCenterSlug: "centro-a",
        activityCenterDbId: "c-1",
        activityCenterSlug: "centro-a",
        supabaseConfigured: true,
      })
    ).toBe(false);
  });

  test("PFP-09: ritorno = 'Il mio centro' (pagina della CTA)", () => {
    expect(FAMILY_PREVIEW_RETURN_HREF).toBe("/center/profile");
  });
});

test.describe("TRAMA Partner — header card e CTA: call site [no browser]", () => {
  test("PFP-10: CTA nella stessa scheda (niente target=_blank, causa del tap 'morto' da PWA)", () => {
    expect(PROFILE_PAGE).toContain("buildFamilyPreviewHref(previewActivitySlug)");
    expect(PROFILE_PAGE).not.toMatch(/target=["']_blank["']/);
  });

  test("PFP-11: CTA è un <Link> semantico con touch target ≥44px e focus visibile (niente div cliccabile)", () => {
    const cta = PROFILE_PAGE.slice(PROFILE_PAGE.indexOf("<Link\n            href={buildFamilyPreviewHref"));
    const ctaTag = cta.slice(0, cta.indexOf(">"));
    expect(ctaTag).toContain("min-h-[44px]");
    expect(ctaTag).toContain("focus-visible:outline");
    expect(PROFILE_PAGE).not.toMatch(/<div[^>]*onClick/);
  });

  test("PFP-12: mobile impilato, desktop in riga (sm:flex-row); nowrap SOLO da sm", () => {
    expect(PROFILE_PAGE).toContain("flex flex-col gap-3");
    expect(PROFILE_PAGE).toContain("sm:flex-row sm:items-center");
    expect(PROFILE_PAGE).toContain("w-full");
    expect(PROFILE_PAGE).toContain("sm:w-auto sm:flex-shrink-0 sm:whitespace-nowrap");
    // la vecchia combinazione che schiacciava il titolo a 0px su mobile
    expect(PROFILE_PAGE).not.toContain('className="flex-shrink-0 whitespace-nowrap rounded-lg');
  });

  test("PFP-13: nome e città vanno a capo (break-words), il font NON è stato ridotto", () => {
    expect(PROFILE_PAGE).toMatch(/data-testid="center-profile-name" className="break-words text-lg font-bold/);
  });

  test("PFP-14: stato B esplicito senza attività (testo, non un pulsante morto)", () => {
    expect(PROFILE_PAGE).toContain('data-testid="family-preview-unavailable"');
    expect(PROFILE_PAGE).toContain("Anteprima famiglia disponibile dopo aver creato la prima attività.");
  });
});

test.describe("TRAMA Partner — scheda attività in anteprima: call site [no browser]", () => {
  test("PFP-15: page.tsx verifica la proprietà del centro server-side prima di attivare l'anteprima", () => {
    expect(ACTIVITY_PAGE).toContain("loadViewer: getCenterContext,");
    expect(ACTIVITY_PAGE).toContain("resolveFamilyPreview({");
    expect(ACTIVITY_PAGE).toContain("activityCenterDbId: activity.centerDbId");
    expect(ACTIVITY_PAGE).toContain("partnerPreview={partnerPreview}");
  });

  test("PFP-16: nessuna seconda scheda centro: stessa DetailClient con un flag", () => {
    expect(DETAIL_CLIENT).toContain("partnerPreview = false,");
    expect(DETAIL_CLIENT).toContain("{partnerPreview && <FamilyPreviewBar />}");
  });

  test("PFP-17: in anteprima Prenota disattivato, Preferiti e Contatta nascosti (nessun dato finto)", () => {
    expect(DETAIL_CLIENT).toContain('data-testid="family-preview-booking-disabled"');
    expect(DETAIL_CLIENT).toMatch(/\{!partnerPreview && \(\s*<button/);
    expect(DETAIL_CLIENT).toMatch(/\{!partnerPreview && \(\s*<div className="mb-3">\s*<ContactCenterButton/);
  });

  test("PFP-18: freccia Indietro in anteprima → 'Il mio centro' (deterministica), altrimenti router.back() invariato", () => {
    expect(DETAIL_CLIENT).toContain("if (partnerPreview) router.push(FAMILY_PREVIEW_RETURN_HREF);");
    expect(DETAIL_CLIENT).toContain("else router.back();");
  });

  test("PFP-19: barra di anteprima con link reale di ritorno (≥44px)", () => {
    expect(PREVIEW_BAR).toContain("href={FAMILY_PREVIEW_RETURN_HREF}");
    expect(PREVIEW_BAR).toContain("Torna al tuo centro");
    expect(PREVIEW_BAR).toContain("min-h-[44px]");
  });

  test("PFP-20: proxy.ts NON toccato da questo fix (nessuna eccezione /activity per host partner./admin.)", () => {
    // PRE-APPLY REVIEW: in produzione esiste un solo dominio
    // (buddykids-app.vercel.app, tenant famiglia) e nessuna env
    // NEXT_PUBLIC_PARTNER_HOSTS/ADMIN_HOSTS — l'eccezione era latente,
    // rimandata a quando esisteranno i sottodomini.
    const rule3 = PROXY.slice(PROXY.indexOf("// 3) Percorsi condivisi"), PROXY.indexOf("// 4) Sottodomini protetti"));
    expect(rule3).not.toContain('pathname.startsWith("/activity")');
    expect(PROXY).not.toContain("LIVE MOBILE BUGFIX");
  });
});

// PRE-APPLY REVIEW (01/10/2026) — comportamento lato server della pagina
// /activity/<slug>?anteprima=partner per i diversi viewer. resolveFamilyPreview
// è esattamente la funzione chiamata da app/activity/[id]/page.tsx con
// loadViewer = getCenterContext; qui il loader restituisce gli stessi valori
// che getCenterContext produce in produzione per ciascun viewer (verificati in
// sola lettura su Supabase con RLS attiva, simulando le sessioni):
//   - anonimo: auth.getUser() → null → { centerDbId: null, centerSlug: null }
//   - genitore: riga profiles propria, center_id null
//   - gestore di altro centro: center_id del proprio centro (≠)
//   - gestore proprietario: center_id = activities.center_id
// I test HTTP reali (senza cookie e con login) sono in
// tests/gestore/profilo-centro-mobile.spec.ts (PCM-07..09).
const ACTIVITY_CENTER = { activityCenterDbId: "f572aa29", activityCenterSlug: "centro-estivo-prova-candidatura" };

test.describe("TRAMA Partner — resolveFamilyPreview (server, non-throwing) [no browser]", () => {
  test("PFP-21: anonimo → false, pagina pubblica", async () => {
    const r = await resolveFamilyPreview({
      requestedParam: "partner",
      ...ACTIVITY_CENTER,
      supabaseConfigured: true,
      loadViewer: async () => ({ centerDbId: null, centerSlug: null }),
    });
    expect(r).toBe(false);
  });

  test("PFP-22: genitore autenticato (center_id null) → false", async () => {
    const r = await resolveFamilyPreview({
      requestedParam: "partner",
      ...ACTIVITY_CENTER,
      supabaseConfigured: true,
      loadViewer: async () => ({ centerDbId: null, centerSlug: null }),
    });
    expect(r).toBe(false);
  });

  test("PFP-23: gestore di altro centro → false", async () => {
    const r = await resolveFamilyPreview({
      requestedParam: "partner",
      ...ACTIVITY_CENTER,
      supabaseConfigured: true,
      loadViewer: async () => ({ centerDbId: "40a64d60", centerSlug: "centro-test-buddykids" }),
    });
    expect(r).toBe(false);
  });

  test("PFP-24: gestore proprietario → true", async () => {
    const r = await resolveFamilyPreview({
      requestedParam: "partner",
      ...ACTIVITY_CENTER,
      supabaseConfigured: true,
      loadViewer: async () => ({ centerDbId: "f572aa29", centerSlug: "centro-estivo-prova-candidatura" }),
    });
    expect(r).toBe(true);
  });

  test("PFP-25: loader che lancia/rigetta → false, nessuna eccezione propagata (la pagina non si rompe)", async () => {
    const errors: unknown[] = [];
    const r = await resolveFamilyPreview({
      requestedParam: "partner",
      ...ACTIVITY_CENTER,
      supabaseConfigured: true,
      loadViewer: async () => {
        throw new Error("rete giù");
      },
      onError: (e) => errors.push(e),
    });
    expect(r).toBe(false);
    expect(errors).toHaveLength(1);
  });

  test("PFP-26: senza ?anteprima=partner il contesto viewer NON viene nemmeno letto", async () => {
    let calls = 0;
    const r = await resolveFamilyPreview({
      requestedParam: undefined,
      ...ACTIVITY_CENTER,
      supabaseConfigured: true,
      loadViewer: async () => {
        calls++;
        return { centerDbId: "f572aa29", centerSlug: null };
      },
    });
    expect(r).toBe(false);
    expect(calls).toBe(0);
  });

  test("PFP-27: page.tsx usa il resolver non-throwing con getCenterContext come loader", () => {
    expect(ACTIVITY_PAGE).toContain("await resolveFamilyPreview({");
    expect(ACTIVITY_PAGE).toContain("loadViewer: getCenterContext,");
    // nessuna chiamata diretta non protetta
    expect(ACTIVITY_PAGE).not.toMatch(/await getCenterContext\(\)/);
  });
});

test.describe("TRAMA Partner — criterio 'visibile alle famiglie' [no browser]", () => {
  test("PFP-28: la superficie famiglie (getActivities) non filtra per pubblicazione → ogni attività del centro è family-visible", () => {
    // Se questo test fallisce, è stato introdotto un filtro di
    // pubblicazione/visibilità nella lista famiglie: va applicato anche a
    // pickFamilyPreviewSlug (lib/center/family-preview.ts), altrimenti la
    // CTA potrebbe mostrare un'attività che le famiglie non vedono.
    const start = ACTIVITIES_DATA.indexOf("export async function getActivities(): Promise<Activity[]>");
    const body = ACTIVITIES_DATA.slice(start, ACTIVITIES_DATA.indexOf("\n}\n", start));
    expect(start).toBeGreaterThan(-1);
    expect(body).not.toMatch(/\.(eq|neq|is|not|filter|in|match)\(/);
    expect(body).not.toMatch(/published|visibility|status|draft|archived/);
  });

  test("PFP-29: getActivityBySlug (scheda /activity) filtra solo per slug", () => {
    const start = ACTIVITIES_DATA.indexOf("export async function getActivityBySlug(");
    const body = ACTIVITIES_DATA.slice(start, ACTIVITIES_DATA.indexOf("\n}\n", start));
    const filters = body.match(/\.(eq|neq|is|not|filter|in|match)\([^)]*\)/g) ?? [];
    expect(filters.every((f) => f.startsWith('.eq("slug"'))).toBe(true);
  });
});
