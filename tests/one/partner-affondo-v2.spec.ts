// Portale centri V2 — affondo del 29/10/2026. Fabrizio: "fai un affondo perchè
// ci sono ancora un pò di cose vecchio stile es. come vi vedono le famiglie
// credo punti al vecchio layout..il logo userei quello navy e non colorato..
// le segnalazioni facciamole come lato genitori..anche la sezione attività è
// vecchio stile ed anche la sezione profilo..", poi "mancano i pulsanti per
// tornare indietro". Logica pura + controlli sul sorgente; i controlli in
// browser restano a Fabrizio (pending local verification).
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  buildFamilyPreviewHref,
  familyPreviewReturnHref,
  FAMILY_PREVIEW_RETURN_HREF,
} from "../../lib/center/family-preview";
import { partnerBackLink } from "../../lib/centers/partner-shell";
import { sanitizeBetaFeedbackClientContext } from "../../lib/nextgen/beta-feedback-shared";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
/** Solo codice, senza commenti (per i controlli "non contiene"). */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

test.describe("Affondo V2 — anteprima famiglia sulla scheda V2", () => {
  test("PA-01 l'anteprima torna alla sezione di partenza; valori ignoti → profilo", () => {
    expect(buildFamilyPreviewHref("pomeriggi")).toBe("/activity/pomeriggi?anteprima=partner");
    expect(buildFamilyPreviewHref("pomeriggi", "centro")).toBe("/activity/pomeriggi?anteprima=partner&da=centro");
    expect(buildFamilyPreviewHref("pomeriggi", "attivita")).toBe("/activity/pomeriggi?anteprima=partner&da=attivita");
    expect(familyPreviewReturnHref("centro")).toBe("/center/centro");
    expect(familyPreviewReturnHref(["attivita"])).toBe("/center/activities");
    expect(familyPreviewReturnHref("https://altro.sito")).toBe(FAMILY_PREVIEW_RETURN_HREF);
    expect(familyPreviewReturnHref(undefined)).toBe(FAMILY_PREVIEW_RETURN_HREF);
  });

  test("PA-02 col guscio l'anteprima è la scheda V2, solo per il gestore proprietario", () => {
    const page = read("app/activity/[id]/page.tsx");
    expect(page).toContain("const previewV2 = partnerPreview ? await partnerShellEnabledForCurrentUser() : false;");
    expect(page).toContain("previewV2={previewV2}");
    const detail = read("app/activity/[id]/DetailClient.tsx");
    expect(detail).toContain("preview={partnerPreview ? { returnHref: previewReturnHref } : null}");
    // in anteprima niente preferiti e Indietro deterministico
    expect(detail).toContain("if (partnerPreview) return;");
    expect(detail).toContain("if (partnerPreview) router.push(previewReturnHref);");
  });

  test("PA-03 scheda V2 in anteprima: barra, Prenota spento, niente Salva e Contatta", () => {
    const v2 = read("components/nextgen/ActivityDetailV2.tsx");
    expect(v2).toContain('data-testid="family-preview-bar"');
    expect(v2).toContain("Anteprima: così vi vedono le famiglie");
    expect(v2).toContain('data-testid="family-preview-back"');
    expect(v2).toContain('data-testid="family-preview-booking-disabled"');
    expect(v2).toContain("{!preview && (");
    expect(v2).toContain('aria-label={preview ? "Torna al portale" : "Indietro"}');
  });

  test("PA-04 i link all'anteprima del portale V2 dicono da dove partono", () => {
    expect(read("components/center/ActivitiesV2.tsx")).toContain('buildFamilyPreviewHref(a.slug, "attivita")');
    expect(read("app/center/centro/page.tsx")).toContain('buildFamilyPreviewHref(previewSlug, "centro")');
    expect(read("app/center/activities/[id]/ActivityEditForm.tsx")).toContain('buildFamilyPreviewHref(activity.id, "attivita")');
  });
});

test.describe("Affondo V2 — segnalazioni come lato famiglie", () => {
  test("PA-05 nel guscio niente pulsante flottante: pannello delle famiglie aperto da Oggi e Centro", () => {
    expect(read("app/center/layout.tsx")).toContain('<BetaFeedbackButton appSource="gestore" partnerV2 hideFab />');
    const card = read("components/center/PartnerFeedbackCard.tsx");
    expect(card).toContain("openBetaFeedback(source)");
    expect(read("components/center/OggiV2.tsx")).toContain('<PartnerFeedbackCard source="oggi" />');
    expect(read("app/center/centro/page.tsx")).toContain('<PartnerFeedbackCard source="centro" />');
  });

  test("PA-06 pannello: stesso del lato famiglie (tipo, dettatura, contesto, conferma), colori del portale centri", () => {
    const b = read("components/nextgen/BetaFeedbackButton.tsx");
    expect(b).toContain('const richPanel = isFamily || (appSource === "gestore" && partnerV2);');
    expect(b).toContain("if (!richPanel) return;");
    expect(b).toContain("const result = richPanel");
    expect(b).toContain("const PARTNER_COPY = {");
    expect(b).toContain('solid: "bg-partner-primary"');
    // il segnale di prodotto "feedback_opened" resta solo per le famiglie (tenant family)
    expect(b).toContain('if (isFamily) void recordBetaSignalAction("feedback_opened", source);');
  });

  test("PA-07 origine dell'apertura dal portale centri salvata nel contesto, valori ignoti scartati", () => {
    expect(sanitizeBetaFeedbackClientContext({ source: "centro" })).toEqual({ source: "centro" });
    expect(sanitizeBetaFeedbackClientContext({ source: "oggi" })).toEqual({ source: "oggi" });
    expect(sanitizeBetaFeedbackClientContext({ source: "dashboard" })).toEqual({});
  });
});

test.describe("Affondo V2 — Attività e Profilo", () => {
  test("PA-08 scheda attività V2: titolo del portale, campi nuovi, parole senza 'Giorni spot'", () => {
    const f = read("app/center/activities/[id]/ActivityEditForm.tsx");
    expect(f).toContain("const ui = v2 ? V2_UI : LEGACY_UI;");
    expect(f).toContain("<PartnerPageHeader");
    expect(f).toContain("const bookingModeLabelsV2");
    const v2Labels = f.slice(f.indexOf("const bookingModeLabelsV2"), f.indexOf("// Diete/intolleranze"));
    expect(v2Labels).not.toMatch(/Giorni spot/);
    expect(v2Labels).toContain("Solo giorni singoli");
    // senza guscio le parole e le classi di prima
    expect(f).toContain('label: "Settimana e Giorni spot"');
    expect(f).toContain('input: "w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"');
    expect(read("app/center/activities/[id]/page.tsx")).toContain("v2={v2} placeSearch={v2}");
  });

  test("PA-09 indirizzo attività con i suggerimenti, coordinate dal luogo scelto; salvato → elenco con conferma", () => {
    const f = read("app/center/activities/[id]/ActivityEditForm.tsx");
    expect(f).toContain("<PlaceAutocomplete");
    expect(f).toContain('update("lat", Number(place.lat.toFixed(5)));');
    expect(f).toContain("enabled={placeSearch}");
    expect(f).toContain('showToast("Attività salvata");');
    expect(f).toContain('router.push("/center/activities");');
    expect(f).toContain('data-testid="activity-save-bar"');
  });

  test("PA-10 ricerca luoghi aperta ai gestori col guscio, per le famiglie decide sempre la release", () => {
    const r = read("app/api/places/search/route.ts");
    expect(r).toContain("if (!on && !(await partnerCanSearchPlaces(supabase, user.id))) return empty;");
    expect(r).toMatch(/role !== "center_admin" && role !== "platform_admin"\) return false;/);
    expect(r).toContain("flagName: PARTNER_SHELL_FLAG,");
    expect(r.match(/^export /gm)).toHaveLength(1);
  });

  test("PA-11 profilo V2: riquadri con le ancore di Centro, indirizzo suggerito, ritorno a Oggi invariato", () => {
    const c = read("app/center/profile/CenterProfileClient.tsx");
    for (const id of ["contatti", "indirizzo", "descrizione", "accessibilita", "social", "sconti", "cancellazioni"]) {
      expect(c, id).toContain(`id="${id}"`);
    }
    expect(c).toContain("<PlaceAutocomplete");
    expect(c).toContain('if (place.city) update("city", place.city);');
    expect(c).toContain('router.push("/center?salvato=profilo");');
    expect(c).toContain('data-testid="profile-save-bar"');
    const p = read("app/center/profile/page.tsx");
    expect(p).toContain("partnerShellEnabledForCurrentUser()");
    expect(p).toContain('testId="center-profile-header"');
    expect(p).toContain('titleTestId="center-profile-name"');
    expect(p).toContain("<CenterProfileClient center={center} dbId={dbId} v2 placeSearch />");
    // il profilo di prima resta per chi non ha il guscio
    expect(p).toContain("<CenterProfileClient center={center} dbId={dbId} />");
  });

  test("PA-12 Date e posti e Nuova attività col titolo del portale", () => {
    const cal = read("app/center/activities/[id]/calendar/page.tsx");
    expect(cal).toContain('title="Date e posti"');
    expect(cal).toContain("<AvailabilityCalendar");
    const nf = read("app/center/activities/new/NewActivityForm.tsx");
    expect(nf).toContain('title="Nuova attività"');
    expect(read("app/center/activities/new/page.tsx")).toContain("<NewActivityForm centerReady={!!centerDbId} v2={shell} />");
  });
});

test.describe("Affondo V2 — tornare indietro", () => {
  test("PA-13 ogni pagina interna ha '‹ provenienza', le sezioni no, niente doppioni", () => {
    expect(partnerBackLink("/center")).toBeNull();
    expect(partnerBackLink("/center/prenotazioni")).toBeNull();
    expect(partnerBackLink("/center/activities")).toBeNull();
    expect(partnerBackLink("/center/centro/")).toBeNull();
    // già con il loro "indietro" nella pagina
    expect(partnerBackLink("/center/profile")).toBeNull();
    expect(partnerBackLink("/center/activities/pomeriggi")).toBeNull();
    expect(partnerBackLink("/center/activities/pomeriggi/calendar")).toBeNull();
    expect(partnerBackLink("/center/activities/new")).toBeNull();
    expect(partnerBackLink("/center/account/sicurezza")).toBeNull();
    // pagine aperte dalle righe
    expect(partnerBackLink("/center/attendance")).toEqual({ href: "/center", label: "Oggi" });
    expect(partnerBackLink("/center/report-presenze")).toEqual({ href: "/center/centro", label: "Centro" });
    expect(partnerBackLink("/center/invites")).toEqual({ href: "/center/centro", label: "Centro" });
    expect(partnerBackLink("/center/servizi-consigliati")).toEqual({ href: "/center/centro", label: "Centro" });
    expect(partnerBackLink("/center/account")).toEqual({ href: "/center/centro", label: "Centro" });
    expect(partnerBackLink("/center/promotions")).toEqual({ href: "/center/activities", label: "Attività" });
    expect(partnerBackLink("/center/richieste/abc")).toEqual({ href: "/center/prenotazioni?tipo=messaggi", label: "Richieste" });
  });

  test("PA-14 il guscio mostra il link, con destinazione fissa (mai la cronologia)", () => {
    const shell = read("components/center/PartnerShellV2.tsx");
    expect(shell).toContain("const back = partnerBackLink(pathname);");
    expect(shell).toContain('data-testid="partner-back"');
    expect(code(read("lib/centers/partner-shell.ts"))).not.toContain("history");
  });
});
