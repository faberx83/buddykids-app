// TRAMA — PAGINA DI BENVENUTO E LISTA D'ATTESA (20/10/2026, Fabrizio: "una
// landing che spiega cos'è TRAMA"; "solo su invito, ma la pagina vorrei fosse
// accessibile e se qualcuno ci arriva mi interessa"). [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { checkWaitlist, cleanSource } from "../../lib/landing/waitlist";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { getReleaseById } from "../../lib/releases/catalog";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { isKnownProductEvent } from "../../lib/telemetry/known-events";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

test.describe("TRAMA — Pagina di benvenuto [no browser]", () => {
  test("BV-01 modulo: email controllata, campi facoltativi puliti, trappola per i programmi; nessuna casella di consenso", () => {
    const ok = checkWaitlist({ email: " Giulia.R@Gmail.com ", comune: "  Milano  ", kidsCount: "2", note: " centri   estivi ", source: "WhatsApp!" });
    expect(ok).toEqual({
      ok: true,
      row: { email: "giulia.r@gmail.com", comune: "Milano", kids_count: 2, note: "centri estivi", source: "whatsapp", contact_consent: true },
    });
    expect(checkWaitlist({ email: "giulia@gmail" })).toMatchObject({ ok: false, field: "email" });
    expect(checkWaitlist({ email: "giulia@gmail.con" })).toMatchObject({ ok: false, field: "email", suggestion: "giulia@gmail.com" });
    expect(checkWaitlist({ email: "giulia@gmail.com", website: "http://spam" })).toMatchObject({ ok: false, field: "bot" });
    // 20/10/2026 (Fabrizio): chiedere l'invito basta, niente casella in più; l'informativa breve resta sotto il pulsante
    const form = read("components/landing/WaitlistForm.tsx");
    expect(form).not.toContain('type="checkbox"');
    expect(form).toContain("ci autorizzi a scriverti a questa email, solo per l&apos;invito");
    expect(form).toContain('href="/privacy"');
    const r = checkWaitlist({ email: "a@b.it", kidsCount: "12", note: "x".repeat(900) });
    expect(r.ok && r.row.kids_count).toBeNull();
    expect(r.ok && r.row.note?.length).toBe(500);
    expect(cleanSource("<script>")).toBe("script");
    expect(cleanSource("")).toBeNull();
  });

  test("BV-02 salvataggio solo dal server, dopo i controlli; email già in lista non duplicata; avviso facoltativo a Fabrizio", () => {
    const a = read("app/actions/waitlist.ts");
    expect(a).toContain("const check = checkWaitlist(input);");
    expect(a).toContain('.upsert(check.row, { onConflict: "email", ignoreDuplicates: true })');
    expect(a).toContain("const notifyTo = process.env.WAITLIST_NOTIFY_EMAIL;");
    expect(a).toContain("escapeHtml(r.email)");
    // programma automatico: risposta uguale, niente salvato
    expect(a).toContain('if (check.field === "bot") return { ok: true, already: false };');
  });

  test("BV-03 migrazione additiva: RLS attiva, nessun inserimento per i visitatori, lettura solo Admin", () => {
    const m = read("supabase/migration_44_beta_waitlist.sql");
    expect(m).toContain("-- STATO: PREPARATA, NON APPLICATA");
    expect(m).toContain("create table if not exists public.beta_waitlist");
    expect(m).toContain("alter table public.beta_waitlist enable row level security;");
    expect(m).toContain("using (public.is_platform_admin());");
    expect(m).not.toMatch(/for insert/i);
    expect(m).toContain("drop table if exists public.beta_waitlist;"); // rollback documentato
  });

  test("BV-04 pagina pubblica: fuori dal controllo di accesso, niente 'installa' né cambio versione, visite senza IP", () => {
    expect(read("proxy.ts")).toContain('!pathname.startsWith("/benvenuto") &&');
    expect(read("components/InstallPrompt.tsx")).toContain('pathname?.startsWith("/benvenuto")');
    expect(read("components/VersionToggle.tsx")).toContain('"/benvenuto"]');
    const page = read("app/benvenuto/page.tsx");
    expect(page).toContain('event_name: "landing_viewed", detail: source ?? "diretto"');
    expect(page).toContain("if (!ua || BOT_UA.test(ua) || !isSupabaseConfigured) return;");
    expect(isKnownProductEvent("landing_viewed")).toBe(true);
    expect(isKnownProductEvent("landing_waitlist_joined")).toBe(true);
  });

  test("BV-05 promesse coerenti col prodotto e schermate riusate dal carosello", () => {
    const v = read("components/landing/BenvenutoView.tsx");
    expect(v).toContain("<FeatureSlider />");
    expect(read("components/landing/FeatureSlider.tsx")).toContain("ONBOARDING_SLIDES.map(");
    expect(v).toContain("In TRAMA non si paga nulla");
    expect(v).not.toMatch(/verificat/i);
    expect(v).toContain('href="#invito"');
    expect(read("components/landing/LandingPhone.tsx")).toContain('import { PhoneScreen } from "@/components/nextgen/OnboardingCarousel";');
    expect(read("components/landing/WaitlistForm.tsx")).toContain("la cancelliamo entro 12 mesi");
  });

  test("BV-08 'Cosa fa TRAMA' scorre da solo come un video, con pausa, frecce, dito; fermo con 'riduci movimento'", () => {
    const f = read("components/landing/FeatureSlider.tsx");
    expect(f).toContain("export const SLIDE_MS = 6000;");
    // 20/10/2026: si ferma anche a fine giro (finished), vedi BV-10
    expect(f).toContain("const playing = !userPaused && !finished && !touching && visible && !reduced;");
    expect(f).toContain('animation: i === index && !reduced ? `trama-slider-fill ${SLIDE_MS}ms linear forwards` : undefined,');
    expect(f).toContain('userPaused ? "Riprendi lo scorrimento" : "Metti in pausa lo scorrimento"}');
    expect(f).toContain("if (end - start < -40) go(index + 1);");
    expect(read("app/globals.css")).toContain("@keyframes trama-slider-fill {");
  });

  test("BV-10 ultima schermata: si ferma lì con 'Chiedi un invito', 'Riguarda' riparte; 'chi ritira' come nell'app", () => {
    const f = read("components/landing/FeatureSlider.tsx");
    expect(f).toContain("if (isLast) setFinished(true);");
    expect(f).toContain("const playing = !userPaused && !finished && !touching && visible && !reduced;");
    expect(f).toContain('data-testid="slider-cta"');
    expect(f).toContain('aria-label={finished ? "Riguarda da capo"');
    expect(read("lib/nextgen/onboarding-slides.ts")).toContain('titleHighlight: "chi ritira.",');
  });

  test("BV-11 ingresso per i centri staccato dal piè di pagina", () => {
    const v = read("components/landing/BenvenutoView.tsx");
    expect(v).toContain('<section aria-labelledby="centri-h" className="bg-trama-primary">');
    expect(v.indexOf('aria-labelledby="centri-h"')).toBeLessThan(v.indexOf("<footer"));
    expect(v).toContain("Candidati come partner");
  });

  test("BV-06 release: senza account si arriva qui solo con la release a tutti; 'Registrati' diventa 'Chiedi un invito'", () => {
    expect(FEATURE_FLAG_REGISTRY.LANDING_PUBLIC_ENABLED.defaultValue).toBe(false);
    const entry = FEATURE_CATALOG.find((e) => e.key === "landing_benvenuto");
    expect(entry?.flagName).toBe("LANDING_PUBLIC_ENABLED");
    expect(entry?.releaseEligible).toBe(true);
    expect(getReleaseById("pagina-benvenuto")?.featureKeys).toEqual(["landing_benvenuto"]);
    const login = read("app/auth/login/page.tsx");
    expect(login).toContain('if (landingEnabled && nextParam === "/" && !betaCode && !params.invite && !params.mode) redirect("/benvenuto");');
    expect(login).toContain("inviteOnly={landingEnabled}");
    const form = read("app/auth/login/LoginForm.tsx");
    expect(form).toContain('isFamily && inviteOnly && mode === "login" && !inviteParam && !betaParam ? (');
    expect(form).toContain('href="/benvenuto#invito"');
  });

  test("BV-07 Admin → Lista d'attesa: visite, richieste, email d'invito pronta col codice beta attivo", () => {
    expect(read("app/admin/layout.tsx")).toContain('{ href: "/admin/lista-attesa", label: "Lista d\'attesa", icon: "ti-mail-heart" }');
    expect(read("app/admin/lista-attesa/page.tsx")).toContain('codes.find((c) => c.state === "redeemable")?.code ?? null');
    const c = read("app/admin/lista-attesa/ListaAttesaAdminClient.tsx");
    expect(c).toContain("https://tramapp.it/auth/login?beta=${inviteCode}");
    expect(read("app/actions/waitlist-admin.ts")).toContain('if (!data || data.length === 0) return { error: "Solo l\'Admin piattaforma può farlo" };');
  });
});

test.describe("TRAMA — Pagina di benvenuto leggibile dai lettori automatici [no browser]", () => {
  test("BV-09 robots.txt e sitemap: su tramapp.it solo le pagine pubbliche, l'app no; fuori dal controllo di accesso", () => {
    const r = read("app/robots.ts");
    // 27/10/2026: si aggiunge solo la pagina pubblica per i centri; l'app resta vietata.
    expect(r).toContain('allow: ["/benvenuto", "/centri", "/privacy", "/terms", "/brand/", "/og/"], disallow: "/"');
    expect(r).toContain('if (!publicSite) return { rules: [{ userAgent: "*", disallow: "/" }] };');
    expect(read("app/sitemap.ts")).toContain('url: "https://tramapp.it/benvenuto"');
    const proxy = read("proxy.ts");
    expect(proxy).toContain('pathname !== "/robots.txt" &&');
    expect(proxy).toContain('pathname === "/robots.txt" ||');
    // lo slider mostra tutte le schermate anche a chi non esegue la pagina
    expect(read("components/landing/FeatureSlider.tsx")).toContain("<noscript>");
  });
});
