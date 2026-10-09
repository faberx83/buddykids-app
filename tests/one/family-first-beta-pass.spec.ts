import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { ANNOUNCEMENT_CATALOG, getAnnouncementById, isComingSoon } from "../../lib/announcements/catalog";
import { isMissingTableError, nextVote, voteTelemetryDetail } from "../../lib/announcements/votes";
import {
  BETA_FEEDBACK_CATEGORIES,
  betaFeedbackCategoryLabel,
  isBetaFeedbackCategory,
  isMissingColumnError,
  sanitizeBetaFeedbackClientContext,
} from "../../lib/nextgen/beta-feedback-shared";
import { KNOWN_PRODUCT_EVENTS } from "../../lib/telemetry/known-events";
import { NEW_EXTERNAL_ITEM_HREF, wantsNewExternalItem } from "../../lib/planner/new-external-item-link";

// TRAMA — FAMILY-FIRST BETA PASS (07/10/2026). "TRAMA è utile anche se i
// centri della famiglia non sono su TRAMA" + piccolo feedback loop.
// [no browser]: logica pura + lettura statica dei call site reali, stesso
// principio del resto di tests/one. I controlli in browser (feedback,
// Novità, Profilo) sono in tests/nextgen/beta-feedback-sprint5.spec.ts e
// restano "pending local verification".
//
// Comando: npx playwright test tests/one/family-first-beta-pass.spec.ts

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf-8");
}
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

test.describe("Novità — Disponibile vs In arrivo [no browser]", () => {
  test("FFB-01: le due voci In arrivo decise da Fabrizio esistono, senza flag né superficie contestuale", () => {
    for (const id of ["accompagnamento-ritiro", "deleghe-smart"]) {
      const entry = getAnnouncementById(id);
      expect(entry, id).toBeDefined();
      expect(isComingSoon(entry!)).toBe(true);
      expect(entry!.deepLink).toBe(`/nextgen/novita#${id}`);
      expect(entry!.requiredFeatureFlag).toBeUndefined();
      expect(entry!.contextualSurface).toBeUndefined();
      expect(entry!.announceToUsers).toBe(true);
    }
  });

  test("FFB-02: le voci già rilasciate restano 'Disponibile' (default) con CTA alla funzione", () => {
    for (const id of ["real-discovery-pilot", "school-calendar-intelligence", "curated-favorites"]) {
      const entry = getAnnouncementById(id)!;
      expect(isComingSoon(entry)).toBe(false);
      expect(entry.deepLink.startsWith("/nextgen/novita")).toBe(false);
    }
  });

  test("FFB-03: nessuna voce In arrivo promette date o tempi nel testo", () => {
    for (const a of ANNOUNCEMENT_CATALOG.filter(isComingSoon)) {
      const text = `${a.userTitle} ${a.userBody}`.toLowerCase();
      for (const forbidden of [/\bgennaio\b/, /\bfebbraio\b/, /\bmarzo\b/, /\bentro (il|la|fine|\d)/, /\b20\d\d\b/, /settimana prossima/, /a breve/]) {
        expect(text, `${a.id}: ${forbidden}`).not.toMatch(forbidden);
      }
    }
  });

  test("FFB-04: la pagina Novità separa le sezioni, non mostra CTA né date per le voci In arrivo", () => {
    const page = read("../../app/nextgen/novita/page.tsx");
    expect(page).toContain('id="novita-in-arrivo"');
    expect(page).toContain('id="novita-disponibili"');
    const comingSoonBlock = page.slice(page.indexOf('data-testid="novita-coming-soon"'), page.indexOf('id="novita-disponibili"'));
    expect(comingSoonBlock).not.toContain("deepLink");
    expect(comingSoonBlock).not.toContain("releasedAt");
    expect(comingSoonBlock).toContain("In arrivo");
    const availableBlock = page.slice(page.indexOf('data-testid="novita-available"'));
    expect(availableBlock).toContain("href={a.deepLink}");
    expect(availableBlock).toContain("Disponibile");
  });

  test("FFB-05: badge — aprire Novità segna come lette le voci visibili (solo seen_at, mai dismissed_at)", () => {
    const page = read("../../app/nextgen/novita/page.tsx");
    expect(page).toContain("<NovitaSeenMarker unseenIds={unseenIds} />");
    expect(page).toContain(".filter((a) => !a.isSeen)");
    const actions = read("../../app/actions/announcements.ts");
    const fn = actions.slice(actions.indexOf("export async function markAnnouncementsSeenFromNovitaAction"));
    const body = fn.slice(0, fn.indexOf("export async function setAnnouncementVoteAction"));
    expect(body).toContain("seen_at: now");
    expect(body).not.toContain("dismissed_at");
    expect(body).toContain("announcement_version: e.version");
  });

  test("FFB-06: nella campanella una voce In arrivo è etichettata come tale", () => {
    const source = read("../../lib/data/notifications.ts");
    expect(source).toContain('a.availability === "coming_soon" ? `In arrivo: ${a.userTitle}` : a.userTitle');
  });

  test("FFB-07: 👍/👎 — tap sullo stesso pollice ritira il voto, sull'altro lo cambia", () => {
    expect(nextVote(0, 1)).toBe(1);
    expect(nextVote(1, 1)).toBe(0);
    expect(nextVote(1, -1)).toBe(-1);
    expect(nextVote(-1, -1)).toBe(0);
    expect(voteTelemetryDetail("deleghe-smart", 1)).toBe("deleghe-smart:up");
    expect(voteTelemetryDetail("deleghe-smart", -1)).toBe("deleghe-smart:down");
    expect(voteTelemetryDetail("deleghe-smart", 0)).toBe("deleghe-smart:none");
  });

  test("FFB-08: i pulsanti di voto compaiono solo se la tabella esiste (mai un controllo che non salva)", () => {
    expect(isMissingTableError({ code: "42P01" })).toBe(true);
    expect(isMissingTableError({ code: "PGRST205", message: "Could not find the table 'public.announcement_votes'" })).toBe(true);
    expect(isMissingTableError({ code: "23505" })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
    const page = read("../../app/nextgen/novita/page.tsx");
    expect(page).toContain("{votesAvailable && <AnnouncementVoteButtons");
  });

  test("FFB-09: il voto server-side è accettato solo per voci In arrivo del catalogo", () => {
    const actions = read("../../app/actions/announcements.ts");
    expect(actions).toContain('if (!entry || !isComingSoon(entry)) return { error: "Voce non votabile" };');
  });
});

test.describe("Feedback beta — famiglie [no browser]", () => {
  test("FFB-10: quattro tipi (Idea, Problema, Cosa manca, Altro), validati lato server", () => {
    expect(BETA_FEEDBACK_CATEGORIES.map((c) => c.label)).toEqual(["Idea", "Problema", "Cosa manca", "Altro"]);
    for (const c of BETA_FEEDBACK_CATEGORIES) expect(isBetaFeedbackCategory(c.value)).toBe(true);
    expect(isBetaFeedbackCategory("spam")).toBe(false);
    expect(isBetaFeedbackCategory(undefined)).toBe(false);
    expect(betaFeedbackCategoryLabel("manca")).toBe("Cosa manca");
    expect(betaFeedbackCategoryLabel(null)).toBeNull();
  });

  test("FFB-11: contesto automatico — solo chiavi note, lunghezze limitate, nessun campo arbitrario", () => {
    const ctx = sanitizeBetaFeedbackClientContext({
      route: "/nextgen/planner",
      source: "profilo",
      viewport: "390x844",
      standalone: true,
      language: "it-IT",
      userAgent: "x".repeat(500),
      email: "qualcuno@example.com",
      position: { lat: 45, lng: 9 },
    });
    expect(ctx).toEqual({
      route: "/nextgen/planner",
      source: "profilo",
      viewport: "390x844",
      standalone: true,
      language: "it-IT",
      userAgent: "x".repeat(200),
    });
    expect(sanitizeBetaFeedbackClientContext(null)).toEqual({});
    expect(sanitizeBetaFeedbackClientContext({ source: "altro" })).toEqual({});
  });

  test("FFB-12: senza migration 40 il feedback si salva comunque (fallback sulle colonne storiche)", () => {
    expect(isMissingColumnError({ code: "PGRST204", message: "Could not find the 'category' column of 'beta_feedback'" })).toBe(true);
    expect(isMissingColumnError({ code: "42703" })).toBe(true);
    expect(isMissingColumnError({ code: "23514" })).toBe(false);
    const action = read("../../app/actions/beta-feedback.ts");
    expect(action).toContain("if (error && extra && isMissingColumnError(error)) {");
    expect(action).toContain('({ error } = await supabase.from("beta_feedback").insert(base));');
    // Regressione build Vercel 09/10/2026 (TS2345): mai un oggetto unione
    // dentro insert() — due chiamate distinte, una per forma di riga.
    expect(action).not.toMatch(/\.insert\(\s*extra\s*\?/);
    expect(action).toContain(
      'await supabase.from("beta_feedback").insert({ ...base, category, client_context: clientContext })'
    );
  });

  test("FFB-13: pannello famiglie — titolo, tipi, suggerimento dettatura, conferma nel pannello, input 16px", () => {
    const source = read("../../components/nextgen/BetaFeedbackButton.tsx");
    expect(source).toContain('title: "Aiutaci a migliorare TRAMA"');
    expect(source).toContain('dictationHint: "Scrivi oppure usa il microfono della tastiera per dettare."');
    expect(source).toContain("BETA_FEEDBACK_CATEGORIES.map");
    expect(source).toContain("aria-pressed={category === c.value}");
    expect(source).toContain('data-testid="beta-feedback-success"');
    expect(source).toContain("text-[16px]");
    // nessuna registrazione audio / permesso microfono
    const code = codeOnly(source);
    expect(code).not.toContain("getUserMedia");
    expect(code).not.toContain("MediaRecorder");
    expect(code).not.toContain("SpeechRecognition");
  });

  test("FFB-14: pannello Partner invariato (testi storici)", () => {
    const source = read("../../components/nextgen/BetaFeedbackButton.tsx");
    expect(source).toContain('isFamily ? FAMILY_COPY.title : "Segnala un problema"');
    expect(source).toContain('placeholder="Cosa non funziona o cosa miglioreresti?"');
    expect(source).toContain('"Invia segnalazione"');
    expect(source).toContain("Segnalazione inviata, grazie!");
  });

  test("FFB-15: accessi permanenti — Profilo e Novità aprono lo stesso pannello (nessun secondo form)", () => {
    expect(read("../../app/nextgen/profile/ProfileNextgenClient.tsx")).toContain('openBetaFeedback("profilo")');
    expect(read("../../components/nextgen/NovitaClientParts.tsx")).toContain('openBetaFeedback("novita")');
    const button = read("../../components/nextgen/BetaFeedbackButton.tsx");
    expect(button).toContain("window.addEventListener(OPEN_BETA_FEEDBACK_EVENT, onOpen)");
  });

  test("FFB-16: migration 40 additiva, con RLS sulla nuova tabella e rollback documentato", () => {
    const sql = read("../../supabase/migration_40_beta_feedback_context_and_announcement_votes.sql");
    const statements = sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(statements).toContain("add column if not exists category text");
    expect(statements).toContain("add column if not exists client_context jsonb");
    expect(statements).toContain("check (category is null or category in ('idea', 'problema', 'manca', 'altro'))");
    expect(statements).toContain("create table if not exists public.announcement_votes");
    expect(statements).toContain("unique (parent_id, announcement_id)");
    expect(statements).toContain("enable row level security");
    expect((statements.match(/create policy/g) ?? []).length).toBe(2);
    expect(statements).not.toMatch(/drop table|drop column|delete from|update public\./i);
    expect(sql).toContain("ROLLBACK");
  });
});

test.describe("Scopri, Planner, Home — family-first [no browser]", () => {
  test("FFB-17: Scoperta TRAMA — con il Planner disponibile 'Aggiungi al Planner' è la PRIMARY, 'Proponi invito' resta secondaria", () => {
    const source = read("../../components/nextgen/DiscoveryLeadCard.tsx");
    expect(source).toContain("const canAddToPlanner = plannerEnabled && planState !== \"done\" && kids.length > 0;");
    const invitableRow = source.slice(source.indexOf("{invitable && proposeState !== \"confirm\""), source.indexOf('{/* §14 "SOURCE-ONLY RECORDS"'));
    expect(invitableRow.indexOf("Aggiungi al Planner")).toBeGreaterThan(-1);
    expect(invitableRow.indexOf("Aggiungi al Planner")).toBeLessThan(invitableRow.indexOf("Proponi invito"));
    expect(codeOnly(source)).not.toContain("Prenota");
  });

  test("FFB-18: la microcopy delle Scoperte non suona più come un difetto", () => {
    for (const file of ["../../components/nextgen/DiscoveryLeadCard.tsx", "../../components/nextgen/DiscoveryMapPopupCard.tsx"]) {
      const source = read(file);
      expect(source).not.toContain("Gestore non ancora identificato");
      expect(source).toContain("Il centro non è ancora su TRAMA: puoi comunque salvarla e organizzarla.");
    }
  });

  test("FFB-19: le attività Partner in Scopri hanno la pillola 'Su TRAMA'; altrove ActivityCard resta invariata", () => {
    const card = read("../../components/ActivityCard.tsx");
    expect(card).toContain("managedOnTrama = false,");
    expect(card).toContain("Su TRAMA");
    expect(read("../../app/nextgen/search/SearchDiscoveryClient.tsx")).toContain("managedOnTrama\n");
    expect(read("../../app/nextgen/HomeDashboardClient.tsx")).not.toContain("managedOnTrama");
  });

  test("FFB-20: Scopri senza risultati — 'Aggiungilo al Planner' solo con gli impegni esterni attivi, poi 'Suggerisci un centro'", () => {
    const source = read("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    const empty = source.slice(source.indexOf("Nessuna attività corrisponde ai filtri scelti."), source.indexOf("<SuggestCenterCard"));
    expect(empty).toContain("{externalPlannerItemsEnabled && (");
    expect(empty).toContain("href={NEW_EXTERNAL_ITEM_HREF}");
    expect(empty).toContain("Aggiungilo al Planner");
  });

  test("FFB-21: il link 'nuovo impegno' apre il modulo già aperto nel Planner", () => {
    expect(NEW_EXTERNAL_ITEM_HREF).toBe("/nextgen/planner?nuovo=impegno#impegni");
    expect(wantsNewExternalItem("?nuovo=impegno")).toBe(true);
    expect(wantsNewExternalItem("?nuovo=altro")).toBe(false);
    expect(wantsNewExternalItem("")).toBe(false);
    const section = read("../../components/nextgen/ExternalPlannerItemsSection.tsx");
    expect(section).toContain("if (!wantsNewExternalItem(window.location.search)) return;");
    expect(section).toContain('id="impegni"');
  });

  test("FFB-22: Home — niente più 'La tua estate'; scorciatoia impegni solo con il flag attivo", () => {
    const home = read("../../app/nextgen/HomeDashboardClient.tsx");
    expect(home).not.toContain(">La tua estate<");
    expect(home).toContain("Le attività dei tuoi figli");
    expect(home).toContain("{externalPlannerItemsEnabled && (");
    expect(read("../../app/nextgen/page.tsx")).toContain('flagName: "EXTERNAL_PLANNER_ITEMS_ENABLED"');
  });

  test("FFB-23: PWA in beta — nessun testo da app store nel codice", () => {
    const roots = ["../../app", "../../components", "../../lib"];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(__dirname, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel);
        else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
          const code = codeOnly(read(rel)).toLowerCase();
          for (const bad of ["app store", "google play", "play store", "scarica l'app", "scarica l’app"]) {
            if (code.includes(bad)) offenders.push(`${rel}: ${bad}`);
          }
        }
      }
    };
    roots.forEach(walk);
    expect(offenders).toEqual([]);
    expect(read("../../components/InstallPrompt.tsx")).toContain("alla schermata Home");
  });
});

test.describe("Telemetria beta, flag e deploy da shell [no browser]", () => {
  test("FFB-24: i segnali beta sono registrati come eventi noti (stessa product_events)", () => {
    for (const e of [
      "discovery_opened",
      "novita_opened",
      "announcement_read",
      "announcement_voted",
      "feedback_opened",
      "feedback_submitted",
      // già esistenti e riusati
      "favorite_added",
      "curated_added_to_planner",
      "curated_listing_invite_proposed",
      "external_planner_item_created",
    ]) {
      expect(KNOWN_PRODUCT_EVENTS as readonly string[], e).toContain(e);
    }
    const signals = read("../../app/actions/beta-signals.ts");
    expect(signals).toContain('const CLIENT_SIGNALS = ["feedback_opened", "novita_opened"] as const;');
  });

  test("FFB-25: script flag — solo i 2 flag, solo la coorte beta", () => {
    const sql = read("../../supabase/script_family_first_flags_cohort_beta.sql");
    const statements = sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(statements).toContain("('EXTERNAL_PLANNER_ITEMS_ENABLED', 'cohort', 'trama-one-controlled-beta', true");
    expect(statements).toContain("('REAL_DISCOVERY_DATASET_ENABLED', 'cohort', 'trama-one-controlled-beta', true");
    expect(statements).not.toMatch(/'global'\s*,\s*null|scope_type\s*=\s*'global'.*enabled\s*=\s*true/i);
    expect((statements.match(/insert into/gi) ?? []).length).toBe(1);
  });

  test("FFB-26: deploy.sh — PATCH e APPLY_SQL da shell, con conferma, transazione unica e stop al primo errore", () => {
    const sh = read("../../deploy.sh");
    expect(sh).toContain('if [ -n "$PATCH" ]; then');
    expect(sh).toContain('git am --3way "$PATCH_ABS"');
    expect(sh).toContain("La patch è dentro il repository");
    expect(sh).toContain('if [ -n "$APPLY_SQL" ]; then');
    expect(sh).toContain('psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$f"');
    expect(sh).toContain('if [ "$SQL_CONFIRM" != "APPLICA" ]; then');
    expect(sh).toContain('if [ -n "$SQL_ONLY" ]; then');
    // Il blocco [0/5] gira PRIMA dei preflight e del push.
    expect(sh.indexOf('if [ -n "$APPLY_SQL" ]; then')).toBeLessThan(sh.indexOf('echo "[2/5] 📤 Pubblico su GitHub'));
  });
});
