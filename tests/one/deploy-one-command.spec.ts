import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

// TRAMA — deploy.sh "un solo comando" (richiesta di Fabrizio, 09/10/2026:
// "tutti i comandi da terminale con l'unico lancio del bash" e "senza
// download": modifiche dai rami GitHub claude/* o da .trama-inbox/).
// [no browser]: lettura statica di deploy.sh. Il comportamento end-to-end
// (patch da ~/Downloads, npm install, tsc, SQL con APPLICA, deploy) è stato
// provato il 09/10 in una copia del repo con npm/npx/psql simulati; la prova
// reale sul Mac resta "pending local verification".
//
// Comando: npx playwright test tests/one/deploy-one-command.spec.ts

const sh = fs.readFileSync(path.join(__dirname, "../../deploy.sh"), "utf-8");

function pos(fragment: string): number {
  const i = sh.indexOf(fragment);
  expect(i, fragment).toBeGreaterThan(-1);
  return i;
}

test.describe("deploy.sh — [0/5] un solo comando [no browser]", () => {
  test("DOC-01: patch dalle cartelle .trama-inbox/ (nel repo) e ~/Downloads, dalla più vecchia, poi archiviate", () => {
    expect(sh).toContain('PATCH_INBOX="${PATCH_INBOX:-$HOME/Downloads}"');
    expect(sh).toContain('REPO_INBOX="$(git rev-parse --show-toplevel)/.trama-inbox"');
    expect(sh).toContain('for inbox_dir in "$REPO_INBOX" "$PATCH_INBOX"; do');
    expect(sh).toContain('ls -1tr "$inbox_dir"/trama-*.patch');
    expect(sh).toContain('archive_dir="$(dirname "$1")/trama-patch-applicate"');
    // .trama-inbox/ è gitignored, quindi non sporca il working tree.
    const gitignore = fs.readFileSync(path.join(__dirname, "../../.gitignore"), "utf-8");
    expect(gitignore).toMatch(/^\.trama-inbox\/$/m);
  });

  test("DOC-01b: commit di Claude dai rami GitHub claude/* (qualsiasi sessione, qualsiasi dispositivo), con conferma", () => {
    expect(sh).toContain('INBOX_BRANCH="${INBOX_BRANCH:-claude/*}"');
    expect(sh).toContain('git ls-remote --heads origin "refs/heads/$INBOX_BRANCH"');
    expect(sh).toContain("git for-each-ref --sort=committerdate");
    expect(sh).toContain('git cherry HEAD "$ref"');
    expect(sh).toContain('git merge -q --ff-only "$ref"');
    expect(sh).toContain("git cherry-pick --abort");
    expect(sh).toContain("Scrivi s per sì, n per saltarle");
    // I rami si leggono prima delle cartelle, e tutto prima di SQL e deploy.
    expect(pos('git ls-remote --heads origin "refs/heads/$INBOX_BRANCH"')).toBeLessThan(pos('for inbox_dir in "$REPO_INBOX" "$PATCH_INBOX"; do'));
    expect(pos('git merge -q --ff-only "$ref"')).toBeLessThan(pos("# 0d) SQL in produzione"));
  });

  test("DOC-01c: i rami claude/* non generano deploy Vercel (né main: si deploya solo da deploy.sh)", () => {
    const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, "../../vercel.json"), "utf-8"));
    expect(vercel.git.deploymentEnabled["claude/*"]).toBe(false);
    expect(vercel.git.deploymentEnabled.main).toBe(false);
  });

  test("DOC-02: una patch già nella storia (stesso contenuto) viene solo archiviata, mai riapplicata", () => {
    expect(sh).toContain("git patch-id --stable");
    expect(sh).toContain("già applicata in passato, archiviata.");
    expect(sh).toContain("applicata solo in parte");
  });

  test("DOC-03: git am solo su main con working tree pulito; in caso di errore, abort e stop", () => {
    expect(sh).toContain('require_main_and_clean "Patch non applicata"');
    expect(sh).toContain('git am --3way "$patch_abs"');
    expect(sh).toContain("git am --abort");
    expect(sh).toContain("La patch è dentro il repository");
  });

  test("DOC-04: se una patch cambia deploy.sh, lo script si rilancia con la versione nuova (stesso log)", () => {
    expect(sh).toContain('git diff --quiet "$HEAD_BEFORE_PATCHES" HEAD -- deploy.sh');
    expect(sh).toContain("exec env TRAMA_DEPLOY_REEXEC=1");
    expect(sh).toContain("NO_LOG_FILE=1");
  });

  test("DOC-05: npm install quando cambiano le dipendenze; il lockfile si committa da solo, altro mai", () => {
    expect(sh).toContain("npm install --no-audit --no-fund");
    expect(sh).toContain("git add package-lock.json");
    expect(sh).toContain("npm install ha modificato anche altri file, non li committo da solo");
  });

  test("DOC-06: controllo tipi prima di SQL, push e deploy", () => {
    expect(sh).toContain("if npx tsc --noEmit; then");
    expect(pos("if npx tsc --noEmit; then")).toBeLessThan(pos("# 0d) SQL in produzione"));
  });

  test("DOC-07: SQL in attesa = marcati PREPARATA, NON APPLICATA e non nel registro di questo Mac", () => {
    expect(sh).toContain("grep -q '^-- STATO: PREPARATA, NON APPLICATA' \"$f\"");
    expect(sh).toContain('SQL_LEDGER="$DEPLOY_STATE_DIR/sql-applicati.log"');
    expect(sh).toContain('>> "$SQL_LEDGER"');
  });

  test("DOC-08: ogni SQL resta dietro la conferma scritta APPLICA, in transazione unica, stop al primo errore", () => {
    expect(sh).toContain('if [ "$SQL_CONFIRM" != "APPLICA" ]; then');
    expect(sh).toContain('psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$f"');
    expect(sh).toContain("Stop: nessun file successivo, nessun deploy.");
  });

  test("DOC-09: tutto il blocco [0/5] gira prima dei preflight, del push e di vercel --prod", () => {
    const sqlStep = pos("# 0d) SQL in produzione");
    expect(sqlStep).toBeLessThan(pos('echo "[1/5] 🔎 Verifica di sicurezza'));
    expect(sqlStep).toBeLessThan(pos('echo "[2/5] 📤 Pubblico su GitHub'));
    expect(sqlStep).toBeLessThan(pos("npx --yes vercel --prod"));
  });

  test("DOC-10: override espliciti documentati e ONLY_SITEMAP intercettato prima di tutto", () => {
    for (const flag of ["NO_PATCH_INBOX", "SKIP_NPM", "SKIP_CHECKS", "SKIP_SQL", "SQL_ONLY", "APPLY_SQL", "ASSUME_YES"]) {
      expect(sh, flag).toContain(flag);
    }
    expect(pos('if [ -n "$ONLY_SITEMAP" ]; then')).toBeLessThan(pos("# 0d) SQL in produzione"));
  });

  test("DOC-11: la migration 40 (già applicata) non è più marcata come in attesa", () => {
    const m40 = fs.readFileSync(
      path.join(__dirname, "../../supabase/migration_40_beta_feedback_context_and_announcement_votes.sql"),
      "utf-8"
    );
    expect(m40).not.toMatch(/^-- STATO: PREPARATA, NON APPLICATA/m);
    expect(m40).toContain("STATO: APPLICATA in produzione il 09/10/2026");
  });
});

test.describe("deploy.sh — Vercel senza domande nascoste (15/10/2026)", () => {
  test("DOC-VY-01: ogni chiamata a Vercel usa npx --yes (niente 'Ok to proceed?' invisibile)", () => {
    const script = fs.readFileSync(path.join(__dirname, "../..", "deploy.sh"), "utf-8");
    const code = script
      .split("\n")
      .filter((l) => !l.trim().startsWith("#") && !l.includes("echo "))
      .join("\n");
    expect(code).not.toMatch(/npx vercel /);
    expect(code).toContain("npx --yes vercel whoami");
    expect(code).toContain("npx --yes vercel --prod");
    expect(script).toContain("Controllo l'accesso a Vercel");
  });
});
