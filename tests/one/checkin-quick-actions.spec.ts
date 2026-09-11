import fs from "fs";
import path from "path";
import { createHmac } from "crypto";
import { test, expect } from "@playwright/test";
import {
  signCheckinActionToken,
  verifyCheckinActionTokenWithSecret,
  isCheckinActionTokenError,
  CheckinActionTokenPayload,
} from "../../lib/checkin/action-token-core";

// NOTA: questi test importano lib/checkin/action-token-core.ts (pura,
// nessun "server-only") invece di lib/checkin/action-token.ts (il wrapper
// server-only che legge davvero process.env.CHECKIN_ACTION_SECRET) — stesso
// principio già seguito da questo codebase per evaluate.ts/resolve.ts:
// "server-only" fa fallire SEMPRE l'import diretto in un test Playwright
// ("This module cannot be imported from a Client Component module"),
// indipendentemente dal contesto reale. Il segreto qui è quindi un
// parametro esplicito passato dal test, mai letto da una vera variabile
// d'ambiente — la logica di lettura/fail-safe di process.env è nel wrapper
// (action-token.ts), verificata separatamente sotto via lettura del
// sorgente.
const TTL_SECONDS = 36 * 3600;
function generate(secret: string, input: Omit<CheckinActionTokenPayload, "exp">): string {
  return signCheckinActionToken(secret, { ...input, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS });
}
function verify(secret: string, token: string) {
  return verifyCheckinActionTokenWithSecret(secret, token);
}

// TRAMA — Push check-in: azioni rapide (11/09/2026, richiesta di Fabrizio:
// stesse opzioni "Sì / In ritardo / No" già in app, direttamente come
// bottoni della notifica push, SOLO quando il genitore ha esattamente un
// bambino pendente oggi — vedi lib/checkin/action-token.ts per il perché
// (nessuna sessione browser disponibile dal service worker che riceve il
// tap, quindi un token firmato invece della Server Action esistente
// parentCheckinAction).
//
// Nessun "page" fixture: sia i test sul token (funzioni pure lato server, un
// solo giro di import) sia i test sul sorgente (fs.readFileSync, stesso
// pattern già usato per InternalPreviewBadge/deploy.sh in questa sessione)
// girano senza browser.
//
// Comando: npx playwright test tests/one/checkin-quick-actions.spec.ts

const TEST_SECRET = "test-checkin-action-secret-non-usato-in-produzione";
const OTHER_SECRET = "un-secondo-segreto-diverso-per-il-test-di-manomissione";

test.describe("TRAMA — Push check-in: algoritmo di firma/verifica del token [no browser]", () => {
  const basePayload = {
    kidId: "kid-1",
    activityId: "activity-1",
    weekId: "week-1",
    activityDayId: null,
    date: "2026-09-11",
    status: "presente" as const,
  };

  test("genera e verifica un token valido: il payload verificato è identico a quello firmato (stesso kid/attività/settimana/giorno/data/stato)", () => {
    const token = generate(TEST_SECRET, basePayload);
    const verified = verify(TEST_SECRET, token);
    expect(isCheckinActionTokenError(verified)).toBe(false);
    if (!isCheckinActionTokenError(verified)) {
      expect(verified.kidId).toBe(basePayload.kidId);
      expect(verified.activityId).toBe(basePayload.activityId);
      expect(verified.weekId).toBe(basePayload.weekId);
      expect(verified.activityDayId).toBe(basePayload.activityDayId);
      expect(verified.date).toBe(basePayload.date);
      expect(verified.status).toBe(basePayload.status);
    }
  });

  test("un token per lo stato 'in_ritardo' non può essere confuso con uno per 'presente': stati diversi producono token diversi e ciascuno verifica solo il proprio stato", () => {
    const tokenPresente = generate(TEST_SECRET, { ...basePayload, status: "presente" });
    const tokenInRitardo = generate(TEST_SECRET, { ...basePayload, status: "in_ritardo" });
    expect(tokenPresente).not.toBe(tokenInRitardo);

    const verifiedPresente = verify(TEST_SECRET, tokenPresente);
    const verifiedInRitardo = verify(TEST_SECRET, tokenInRitardo);
    if (!isCheckinActionTokenError(verifiedPresente)) expect(verifiedPresente.status).toBe("presente");
    if (!isCheckinActionTokenError(verifiedInRitardo)) expect(verifiedInRitardo.status).toBe("in_ritardo");
  });

  test("un token firmato con un segreto diverso viene rifiutato per firma non valida — non basta conoscere l'algoritmo, serve il segreto giusto", () => {
    const token = generate(OTHER_SECRET, basePayload);
    const verified = verify(TEST_SECRET, token);
    expect(isCheckinActionTokenError(verified)).toBe(true);
    if (isCheckinActionTokenError(verified)) expect(verified.error).toContain("non valida");
  });

  test("token manomesso (un carattere del payload cambiato) viene rifiutato per firma non valida", () => {
    const token = generate(TEST_SECRET, basePayload);
    const [encoded, signature] = token.split(".");
    // Cambia un carattere nel payload codificato senza toccare la firma:
    // la firma calcolata sul payload manomesso non corrisponderà più.
    const tampered = `${encoded.slice(0, -1)}${encoded.slice(-1) === "a" ? "b" : "a"}.${signature}`;
    const verified = verify(TEST_SECRET, tampered);
    expect(isCheckinActionTokenError(verified)).toBe(true);
    if (isCheckinActionTokenError(verified)) expect(verified.error).toContain("non valida");
  });

  test("token scaduto viene rifiutato con 'Token scaduto' (payload con exp nel passato, stessa firma valida)", () => {
    const expiredPayload = { ...basePayload, exp: Math.floor(Date.now() / 1000) - 3600 };
    const encoded = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
    const signature = createHmac("sha256", TEST_SECRET).update(encoded).digest("base64url");
    const expiredToken = `${encoded}.${signature}`;
    const verified = verify(TEST_SECRET, expiredToken);
    expect(isCheckinActionTokenError(verified)).toBe(true);
    if (isCheckinActionTokenError(verified)) expect(verified.error).toBe("Token scaduto");
  });

  test("token malformato (senza il separatore '.') viene rifiutato esplicitamente", () => {
    const verified = verify(TEST_SECRET, "questo-non-e-un-token-valido");
    expect(isCheckinActionTokenError(verified)).toBe(true);
  });
});

// Il wrapper server-only (lib/checkin/action-token.ts, che legge davvero
// process.env.CHECKIN_ACTION_SECRET) non è importabile qui — verificato
// invece leggendo il sorgente, stesso pattern già usato per
// InternalPreviewBadge/deploy.sh in questa sessione.
test.describe("TRAMA — Push check-in: wrapper server-only, fail-safe senza segreto [no browser]", () => {
  const wrapperSource = fs.readFileSync(path.join(__dirname, "../../lib/checkin/action-token.ts"), "utf-8");

  test("generateCheckinActionToken ritorna null se CHECKIN_ACTION_SECRET non è configurato, PRIMA di firmare qualunque payload", () => {
    const guardIndex = wrapperSource.indexOf("if (!secret) return null;");
    const signIndex = wrapperSource.indexOf("return signCheckinActionToken(secret, payload);");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(signIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(signIndex);
  });

  test("verifyCheckinActionToken rifiuta con un errore esplicito se CHECKIN_ACTION_SECRET non è configurato, mai un crash", () => {
    expect(wrapperSource).toContain('if (!secret) return { error: "Azioni rapide non configurate" };');
  });

  test("il wrapper ha 'server-only' come prima riga — non può finire in un bundle client per costruzione", () => {
    expect(wrapperSource.trimStart().startsWith('import "server-only";')).toBe(true);
  });
});

test.describe("TRAMA — Push check-in: azioni rapide solo con un bambino pendente [no browser]", () => {
  const cronSource = fs.readFileSync(
    path.join(__dirname, "../../app/api/cron/checkin-reminders/route.ts"),
    "utf-8"
  );

  test("le azioni rapide vengono costruite SOLO quando items.length === 1 (mai con 2+ bambini pendenti, dove la push resta cumulativa senza sapere a chi riferire un tap)", () => {
    expect(cronSource).toContain('items.length === 1 ? buildQuickActionsForSingleItem(items[0]) : {}');
  });

  test("i 3 id di azione nel cron ('checkin_presente'/'checkin_in_ritardo'/'checkin_assente') sono esattamente quelli gestiti dal service worker in notificationclick", () => {
    const swSource = fs.readFileSync(path.join(__dirname, "../../public/sw.js"), "utf-8");
    for (const actionId of ["checkin_presente", "checkin_in_ritardo", "checkin_assente"]) {
      expect(cronSource).toContain(`"${actionId}"`);
    }
    // Il service worker non elenca gli id uno per uno (li legge da
    // notificationData.actionUrls[event.action], generico) — verifichiamo
    // invece che la lettura generica esista davvero.
    expect(swSource).toContain("notificationData.actionUrls[clickedAction]");
  });

  test("le etichette dei 3 bottoni sono identiche a quelle già in app oggi (Sì / In ritardo / No — CheckinPrompt.tsx, NextgenCheckinCard.tsx)", () => {
    expect(cronSource).toContain('title: "Sì"');
    expect(cronSource).toContain('title: "In ritardo"');
    expect(cronSource).toContain('title: "No"');
  });
});

test.describe("TRAMA — Push check-in: service worker [no browser]", () => {
  const swSource = fs.readFileSync(path.join(__dirname, "../../public/sw.js"), "utf-8");

  test("showNotification riceve 'actions' solo se il payload push le include (nessun bottone quando assenti, comportamento invariato)", () => {
    expect(swSource).toContain('if (Array.isArray(data.actions) && data.actions.length > 0)');
    expect(swSource).toContain("options.actions = data.actions;");
  });

  test("notificationclick su un bottone azione chiama fetch(...) in POST verso l'URL firmato, PRIMA di qualunque apertura di finestra", () => {
    const fetchIndex = swSource.indexOf('fetch(actionUrl, { method: "POST" })');
    const openWindowFallbackIndex = swSource.indexOf("Tap sul corpo della notifica");
    expect(fetchIndex).toBeGreaterThan(-1);
    expect(openWindowFallbackIndex).toBeGreaterThan(-1);
    expect(fetchIndex).toBeLessThan(openWindowFallbackIndex);
  });

  test("un fetch fallito (rete assente/token scaduto) ripiega sull'apertura dell'app — il genitore non resta mai senza un modo di completare il check-in", () => {
    const actionBlockStart = swSource.indexOf('if (clickedAction && notificationData.actionUrls');
    const actionBlockEnd = swSource.indexOf("// Tap sul corpo della notifica");
    const actionBlock = swSource.slice(actionBlockStart, actionBlockEnd);
    expect(actionBlock).toContain(".catch(() => {");
    expect(actionBlock).toContain("self.clients.openWindow(fallbackUrl)");
  });
});

test.describe("TRAMA — Push check-in: endpoint azione rapida [no browser]", () => {
  const routeSource = fs.readFileSync(
    path.join(__dirname, "../../app/api/checkin/quick-action/route.ts"),
    "utf-8"
  );

  test("l'endpoint accetta solo POST (mai GET: un'azione che scrive dati non deve rispondere a un prefetch/crawler)", () => {
    expect(routeSource).toContain("export async function POST(");
    expect(routeSource).not.toContain("export async function GET(");
  });

  test("il token viene verificato PRIMA di qualunque scrittura su attendance_records", () => {
    const verifyIndex = routeSource.indexOf("verifyCheckinActionToken(token)");
    const upsertIndex = routeSource.indexOf('.from("attendance_records").upsert(');
    expect(verifyIndex).toBeGreaterThan(-1);
    expect(upsertIndex).toBeGreaterThan(-1);
    expect(verifyIndex).toBeLessThan(upsertIndex);
  });

  test("un token non valido interrompe la richiesta con 401 prima di usare il service client (nessuna query eseguita con un token rifiutato)", () => {
    const guardIndex = routeSource.indexOf("isCheckinActionTokenError(verified)");
    const serviceClientIndex = routeSource.indexOf("createServiceClient()");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(serviceClientIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(serviceClientIndex);
  });
});
