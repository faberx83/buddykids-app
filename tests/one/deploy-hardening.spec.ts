import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026), hardening
// deploy.sh §24 del report (TRAMA_DARK_RELEASE_MODEL_REPORT.md). Test
// STATICO sul contenuto dello script — stesso principio già usato in
// tests/one/push-notifications.spec.ts (PUSH-P01: legge il file sorgente e
// verifica il contenuto atteso) invece di eseguire realmente deploy.sh
// (richiederebbe un repository git reale, credenziali Vercel e un push
// effettivo — fuori scope per un test automatico, e comunque Claude non
// esegue mai deploy in prima persona, per governance). Questo test verifica
// che il MECCANISMO sia presente nel file, non che un vero deploy si
// comporti correttamente — limite dichiarato esplicitamente, non nascosto.
//
// Comando: npx playwright test tests/one/deploy-hardening.spec.ts

test.describe("TRAMA — deploy.sh: guardia HEAD-vs-push [no browser, static]", () => {
  const deployScript = fs.readFileSync(path.join(__dirname, "../../deploy.sh"), "utf-8");

  test("12. cattura PUSHED_SHA subito dopo il push", () => {
    expect(deployScript).toContain('PUSHED_SHA="$(git rev-parse HEAD)"');
  });

  test("12b. ri-verifica HEAD immediatamente prima di 'vercel --prod', non altrove", () => {
    const pushedShaIndex = deployScript.indexOf('PUSHED_SHA="$(git rev-parse HEAD)"');
    const currentHeadCheckIndex = deployScript.indexOf('CURRENT_HEAD_BEFORE_DEPLOY="$(git rev-parse HEAD)"');
    const vercelProdIndex = deployScript.indexOf("npx vercel --prod");

    expect(pushedShaIndex).toBeGreaterThan(-1);
    expect(currentHeadCheckIndex).toBeGreaterThan(-1);
    expect(vercelProdIndex).toBeGreaterThan(-1);
    // Ordine testuale nel file: cattura del push, poi la ri-verifica, poi
    // (solo se combacia) la pubblicazione vera e propria.
    expect(pushedShaIndex).toBeLessThan(currentHeadCheckIndex);
    expect(currentHeadCheckIndex).toBeLessThan(vercelProdIndex);
  });

  test("12c. blocca (exit 1) su mismatch, salvo override esplicito ALLOW_HEAD_DRIFT=1 — stesso stile dei 3 guardrail preesistenti", () => {
    expect(deployScript).toContain('if [ "$CURRENT_HEAD_BEFORE_DEPLOY" != "$PUSHED_SHA" ]; then');
    expect(deployScript).toContain("ALLOW_HEAD_DRIFT");
    // Il blocco di mismatch deve contenere un "exit 1" nel ramo SENZA
    // override — non basta stampare un warning e continuare.
    const mismatchBlockStart = deployScript.indexOf('if [ "$CURRENT_HEAD_BEFORE_DEPLOY" != "$PUSHED_SHA" ]; then');
    const mismatchBlockEnd = deployScript.indexOf("\nfi\n", mismatchBlockStart);
    const mismatchBlock = deployScript.slice(mismatchBlockStart, mismatchBlockEnd);
    expect(mismatchBlock).toContain("exit 1");
  });

  test("12d. i 3 guardrail preesistenti (branch/dirty-tree/push-failure) restano intatti — hardening additivo, non un indebolimento", () => {
    expect(deployScript).toContain("ALLOW_PROD_FROM_NON_MAIN");
    expect(deployScript).toContain("ALLOW_DIRTY_PROD");
    expect(deployScript).toContain("ALLOW_PUSH_FAILURES");
    expect(deployScript).toContain('if [ "$CURRENT_BRANCH" != "main" ]; then');
    expect(deployScript).toContain('if [ "$TREE_STATUS" = "dirty" ]; then');
  });
});
