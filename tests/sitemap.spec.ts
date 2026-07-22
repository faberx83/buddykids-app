import { test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

type AppTarget = "parent" | "partner" | "admin";
type PageKind = "nextgen" | "legacy" | "partner" | "admin";

type Credentials = {
  email?: string;
  password?: string;
};

type TargetConfig = {
  id: AppTarget;
  label: string;
  baseUrl: string;
  startPath: string;
  loginPaths: string[];
  credentials: Credentials;
  scopePrefixes: string[];
  maximumPages: number;
};

type SitemapNode = {
  url: string;
  pathname: string;
  title: string;
  heading: string;
  kind: PageKind;
  calledBy: string[];
};

type SitemapEdge = {
  from: string;
  to: string;
};

type SitemapError = {
  url: string;
  message: string;
};

type TargetResult = {
  config: TargetConfig;
  nodes: SitemapNode[];
  edges: SitemapEdge[];
  errors: SitemapError[];
  graphFile: string;
  jsonFile: string;
  mermaidFile: string;
};

const DEFAULT_BASE_URL = "https://buddykids-app.vercel.app";
const DEFAULT_PARTNER_URL = "https://buddykids-partner.vercel.app";
const DEFAULT_ADMIN_URL = "https://buddykids-admin.vercel.app";

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }

  return undefined;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeStartPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function sameOrigin(first: string, second: string): boolean {
  try {
    return new URL(first).origin === new URL(second).origin;
  } catch {
    return false;
  }
}

function targetIdsFromEnvironment(): AppTarget[] {
  const raw = (
    process.env.SITEMAP_TARGET ||
    process.env.APP_TARGET ||
    "all"
  )
    .trim()
    .toLowerCase();

  if (raw === "all") {
    return ["parent", "partner", "admin"];
  }

  const aliases: Record<string, AppTarget> = {
    parent: "parent",
    genitore: "parent",
    parents: "parent",
    partner: "partner",
    gestore: "partner",
    gestori: "partner",
    center: "partner",
    centro: "partner",
    admin: "admin",
    platform_admin: "admin",
    platform: "admin",
  };

  const parsed: AppTarget[] = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => aliases[item])
    .filter((item): item is AppTarget => Boolean(item));

  const unique = Array.from(new Set(parsed));

  if (unique.length === 0) {
    throw new Error(
      [
        `SITEMAP_TARGET non valido: "${raw}".`,
        "Valori ammessi: parent, partner, admin, all",
        "oppure una lista separata da virgole, ad esempio partner,admin.",
      ].join(" ")
    );
  }

  return unique;
}

function buildTargetConfig(target: AppTarget): TargetConfig {
  const sharedBase = firstEnv("TEST_BASE_URL", "SITEMAP_BASE_URL");
  const maximumPages = Number(
    firstEnv("SITEMAP_MAX_PAGES") || "250"
  );

  if (!Number.isFinite(maximumPages) || maximumPages < 1) {
    throw new Error(
      "SITEMAP_MAX_PAGES deve essere un numero intero maggiore di zero."
    );
  }

  if (target === "parent") {
    const baseUrl = normalizeBaseUrl(
      firstEnv(
        "SITEMAP_PARENT_BASE_URL",
        "TEST_PARENT_BASE_URL"
      ) ||
        sharedBase ||
        DEFAULT_BASE_URL
    );

    const startPath = normalizeStartPath(
      firstEnv("SITEMAP_PARENT_START_PATH") || "/nextgen"
    );

    return {
      id: "parent",
      label: "Genitore",
      baseUrl,
      startPath,
      loginPaths: buildLoginPaths("parent", startPath),
      credentials: {
        email: firstEnv(
          "TEST_PARENT_EMAIL",
          "PARENT_EMAIL",
          "TEST_EMAIL"
        ),
        password: firstEnv(
          "TEST_PARENT_PASSWORD",
          "PARENT_PASSWORD",
          "TEST_PASSWORD"
        ),
      },
      scopePrefixes: ["/nextgen"],
      maximumPages: Math.floor(maximumPages),
    };
  }

  if (target === "partner") {
    const configuredBase = firstEnv(
      "SITEMAP_PARTNER_BASE_URL",
      "TEST_PARTNER_BASE_URL",
      "TEST_CENTER_BASE_URL"
    );

    const baseUrl = normalizeBaseUrl(
      configuredBase || sharedBase || DEFAULT_PARTNER_URL
    );

    const defaultStartPath =
      !sharedBase &&
      !sameOrigin(baseUrl, DEFAULT_BASE_URL) &&
      /partner/i.test(new URL(baseUrl).hostname)
        ? "/"
        : "/center";

    const startPath = normalizeStartPath(
      firstEnv("SITEMAP_PARTNER_START_PATH") || defaultStartPath
    );

    return {
      id: "partner",
      label: "Partner / Gestori",
      baseUrl,
      startPath,
      loginPaths: buildLoginPaths("partner", startPath),
      credentials: {
        email: firstEnv(
          "TEST_CENTER_ADMIN_EMAIL",
          "TEST_PARTNER_EMAIL",
          "CENTER_ADMIN_EMAIL",
          "PARTNER_EMAIL"
        ),
        password: firstEnv(
          "TEST_CENTER_ADMIN_PASSWORD",
          "TEST_PARTNER_PASSWORD",
          "CENTER_ADMIN_PASSWORD",
          "PARTNER_PASSWORD"
        ),
      },
      scopePrefixes: scopePrefixesFromStartPath(startPath),
      maximumPages: Math.floor(maximumPages),
    };
  }

  const configuredBase = firstEnv(
    "SITEMAP_ADMIN_BASE_URL",
    "TEST_ADMIN_BASE_URL",
    "TEST_PLATFORM_ADMIN_BASE_URL"
  );

  const baseUrl = normalizeBaseUrl(
    configuredBase || sharedBase || DEFAULT_ADMIN_URL
  );

  const defaultStartPath =
    !sharedBase &&
    !sameOrigin(baseUrl, DEFAULT_BASE_URL) &&
    /admin/i.test(new URL(baseUrl).hostname)
      ? "/"
      : "/admin";

  const startPath = normalizeStartPath(
    firstEnv("SITEMAP_ADMIN_START_PATH") || defaultStartPath
  );

  return {
    id: "admin",
    label: "Admin",
    baseUrl,
    startPath,
    loginPaths: buildLoginPaths("admin", startPath),
    credentials: {
      email: firstEnv(
        "TEST_PLATFORM_ADMIN_EMAIL",
        "TEST_ADMIN_EMAIL",
        "PLATFORM_ADMIN_EMAIL",
        "ADMIN_EMAIL"
      ),
      password: firstEnv(
        "TEST_PLATFORM_ADMIN_PASSWORD",
        "TEST_ADMIN_PASSWORD",
        "PLATFORM_ADMIN_PASSWORD",
        "ADMIN_PASSWORD"
      ),
    },
    scopePrefixes: scopePrefixesFromStartPath(startPath),
    maximumPages: Math.floor(maximumPages),
  };
}

function buildLoginPaths(
  target: AppTarget,
  startPath: string
): string[] {
  const explicit = firstEnv(
    `SITEMAP_${target.toUpperCase()}_LOGIN_PATH`
  );

  const next = encodeURIComponent(startPath);
  const candidates = [
    explicit,
    `/auth/login?next=${next}`,
    `/login?next=${next}`,
    "/auth/login",
    "/login",
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(candidates.map(normalizeStartPath)));
}

function scopePrefixesFromStartPath(startPath: string): string[] {
  if (startPath === "/") return ["/"];

  const firstSegment = startPath.split("/").filter(Boolean)[0];
  return firstSegment ? [`/${firstSegment}`] : ["/"];
}

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeJsonForHtml(value: string): string {
  return value
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function safeFilename(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "sitemap"
  );
}

function structuralQueryParameters(): Set<string> {
  const defaults = ["mode", "tab", "view", "section"];
  const configured = (process.env.SITEMAP_KEEP_QUERY_PARAMS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return new Set([...defaults, ...configured]);
}

function normalizeUrl(
  rawUrl: string,
  currentUrl: string,
  config: TargetConfig
): string | null {
  try {
    const url = new URL(rawUrl, currentUrl);
    const base = new URL(config.baseUrl);

    if (url.origin !== base.origin) return null;

    url.hash = "";

    const pathnameLower = url.pathname.toLowerCase();

    const blockedPathFragments = [
      "/api/",
      "/_next/",
      "/auth/callback",
      "/auth/confirm",
      "/logout",
      "/signout",
      "/delete-account",
      "/cancella-account",
    ];

    if (
      blockedPathFragments.some((fragment) =>
        pathnameLower.includes(fragment)
      )
    ) {
      return null;
    }

    const blockedExactPaths = new Set([
      "/auth/login",
      "/login",
      "/logout",
      "/signout",
    ]);

    if (blockedExactPaths.has(pathnameLower)) return null;

    const ignoredExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".svg",
      ".webp",
      ".pdf",
      ".zip",
      ".css",
      ".js",
      ".json",
      ".xml",
      ".ico",
      ".woff",
      ".woff2",
      ".ttf",
      ".map",
    ];

    if (
      ignoredExtensions.some((extension) =>
        pathnameLower.endsWith(extension)
      )
    ) {
      return null;
    }

    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    const parametersToKeep = structuralQueryParameters();

    for (const key of Array.from(url.searchParams.keys())) {
      if (!parametersToKeep.has(key)) {
        url.searchParams.delete(key);
      }
    }

    url.searchParams.sort();

    return url.toString();
  } catch {
    return null;
  }
}

function isLoginUrl(value: string): boolean {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    return pathname.includes("/auth/login") || pathname === "/login";
  } catch {
    return false;
  }
}

function pathIsWithinPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return true;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isWithinTargetScope(
  urlValue: string,
  config: TargetConfig
): boolean {
  const pathname = new URL(urlValue).pathname;

  if (config.id === "parent") {
    return pathname.startsWith("/nextgen");
  }

  return config.scopePrefixes.some((prefix) =>
    pathIsWithinPrefix(pathname, prefix)
  );
}

function classifyPage(urlValue: string, config: TargetConfig): PageKind {
  if (config.id === "partner") return "partner";
  if (config.id === "admin") return "admin";

  return new URL(urlValue).pathname.startsWith("/nextgen")
    ? "nextgen"
    : "legacy";
}

function shouldQueueLink(
  sourceUrl: string,
  targetUrl: string,
  config: TargetConfig
): boolean {
  if (config.id !== "parent") {
    return isWithinTargetScope(targetUrl, config);
  }

  const sourceKind = classifyPage(sourceUrl, config);
  const targetKind = classifyPage(targetUrl, config);

  if (targetKind === "nextgen") return true;

  /*
   * Regola Genitore:
   * - si parte esclusivamente dalla Next Gen;
   * - si analizzano le pagine Legacy richiamate direttamente dalla Next Gen;
   * - non si espande ulteriormente la navigazione Legacy -> Legacy.
   */
  return sourceKind === "nextgen" && targetKind === "legacy";
}

// Fabrizio (2026-07-22): le pagine di dettaglio dinamiche (una per ogni
// attività/centro/community reali su Supabase) affollavano il grafo senza
// aggiungere informazione strutturale — la sitemap serve a vedere le SEZIONI
// dell'app, non ogni singola riga di dati. Le famiglie di route sotto vengono
// "collassate": solo la prima istanza incontrata durante il crawl diventa un
// nodo nel grafo; le istanze successive della stessa famiglia vengono
// ricondotte a quel nodo (l'edge resta visibile, non si perde il collegamento
// — semplicemente non si apre un nodo/pagina in più per ciascuna).
// Le route statiche che assomigliano a un segmento dinamico (es. "new") sono
// escluse esplicitamente per non essere fuse per errore con le pagine dati.
const DYNAMIC_ROUTE_PATTERNS: Array<{
  regex: RegExp;
  family: string;
  excludedSegments?: string[];
}> = [
  { regex: /^\/activity\/([^/]+)$/, family: "/activity/:slug" },
  {
    regex: /^\/center\/activities\/([^/]+)\/calendar$/,
    family: "/center/activities/:slug/calendar",
    excludedSegments: ["new"],
  },
  {
    regex: /^\/center\/activities\/([^/]+)$/,
    family: "/center/activities/:slug",
    excludedSegments: ["new"],
  },
  { regex: /^\/admin\/centers\/([^/]+)$/, family: "/admin/centers/:slug" },
  {
    regex: /^\/nextgen\/community\/([^/]+)$/,
    family: "/nextgen/community/:id",
  },
];

function dynamicRouteFamily(urlValue: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(urlValue).pathname;
  } catch {
    return null;
  }

  for (const pattern of DYNAMIC_ROUTE_PATTERNS) {
    const match = pathname.match(pattern.regex);
    if (!match) continue;
    if (pattern.excludedSegments?.includes(match[1])) return null;
    return pattern.family;
  }

  return null;
}

function collapseDynamicRoute(
  link: string,
  familyRepresentative: Map<string, string>
): string {
  const family = dynamicRouteFamily(link);
  if (!family) return link;

  const existing = familyRepresentative.get(family);
  if (existing) return existing;

  familyRepresentative.set(family, link);
  return link;
}

function isMutatingOrUnsafeText(value: string): boolean {
  const normalized = cleanText(value).toLowerCase();

  return [
    "elimina",
    "cancella",
    "approva",
    "rifiuta",
    "sospendi",
    "pubblica",
    "salva",
    "conferma",
    "rimborsa",
    "invia",
    "reset",
    "disattiva",
    "revoca",
  ].some((term) => normalized.includes(term));
}

async function clearAuthentication(page: Page, baseUrl: string): Promise<void> {
  await page.context().clearCookies();

  await page
    .goto(baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    })
    .catch(() => undefined);

  await page
    .evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    })
    .catch(() => undefined);

  await page.context().clearCookies();
}

async function login(page: Page, config: TargetConfig): Promise<void> {
  const { email, password } = config.credentials;

  if (!email || !password) {
    const expected =
      config.id === "parent"
        ? "TEST_PARENT_EMAIL / TEST_PARENT_PASSWORD"
        : config.id === "partner"
          ? "TEST_CENTER_ADMIN_EMAIL / TEST_CENTER_ADMIN_PASSWORD"
          : "TEST_PLATFORM_ADMIN_EMAIL / TEST_PLATFORM_ADMIN_PASSWORD";

    throw new Error(
      `Credenziali mancanti per ${config.label}. Attese: ${expected}.`
    );
  }

  await clearAuthentication(page, config.baseUrl);

  let lastError = "Form di login non trovato.";

  for (const loginPath of config.loginPaths) {
    const loginUrl = new URL(loginPath, config.baseUrl).toString();

    console.log(`🔐 [${config.label}] ${loginUrl}`);

    try {
      await page.goto(loginUrl, {
        waitUntil: "domcontentloaded",
        timeout: 25_000,
      });

      await page.waitForTimeout(500);

      const emailInput = page
        .locator(
          [
            'input[type="email"]',
            'input[name="email"]',
            'input[autocomplete="email"]',
            'input[placeholder*="email" i]',
          ].join(", ")
        )
        .first();

      const passwordInput = page
        .locator(
          [
            'input[type="password"]',
            'input[name="password"]',
            'input[autocomplete="current-password"]',
          ].join(", ")
        )
        .first();

      const submitButton = page
        .locator(
          [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Accedi")',
            'button:has-text("Login")',
          ].join(", ")
        )
        .first();

      if (
        (await emailInput.count()) === 0 ||
        (await passwordInput.count()) === 0 ||
        (await submitButton.count()) === 0
      ) {
        lastError = `Form non trovato su ${loginUrl}`;
        continue;
      }

      await emailInput.fill(email);
      await passwordInput.fill(password);
      await submitButton.click();

      await page.waitForTimeout(1_200);

      const startUrl = new URL(config.startPath, config.baseUrl).toString();

      await page.goto(startUrl, {
        waitUntil: "domcontentloaded",
        timeout: 25_000,
      });

      await page.waitForTimeout(700);

      if (!isLoginUrl(page.url())) {
        console.log(`✅ [${config.label}] Login completato`);
        console.log(`➡️  ${page.url()}`);
        return;
      }

      const visibleError = cleanText(
        await page
          .locator(
            [
              '[role="alert"]',
              '[data-testid*="error"]',
              ".error",
              ".text-red-500",
              ".text-red-600",
            ].join(", ")
          )
          .first()
          .textContent()
          .catch(() => "")
      );

      lastError = visibleError
        ? `Login non riuscito: ${visibleError}`
        : `Redirect al login dopo l'accesso a ${startUrl}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(`[${config.label}] ${lastError}`);
}

// Una riga sola per pagina visitata invece di un blocco di 8 righe — la
// versione precedente, moltiplicata per ogni pagina/portale/browser,
// produceva centinaia di righe nell'output di deploy.sh. Nessuna
// informazione persa: gli stessi contatori restano tutti sulla riga, il
// riepilogo completo per portale (funzione a parte, non toccata) resta
// invariato a fine crawl.
function printProgress(
  config: TargetConfig,
  projectName: string,
  currentUrl: string,
  visited: number,
  queued: number,
  saved: number,
  errors: number
): void {
  const errorFlag = errors > 0 ? ` ⚠️${errors}` : "";
  console.log(
    `🗺️  ${config.label}/${projectName}  ${visited} analizzate · ${queued} in coda · ${saved} salvate${errorFlag}  →  ${currentUrl}`
  );
}

async function extractInternalLinks(
  page: Page,
  actualUrl: string,
  config: TargetConfig
): Promise<string[]> {
  const candidates = await page
    .locator(
      [
        "a[href]",
        "[data-href]",
        "[data-url]",
        "[data-route]",
        "[data-path]",
      ].join(", ")
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const anchor = element as HTMLAnchorElement;

        return {
          tagName: element.tagName,
          raw:
            element.getAttribute("href") ||
            element.getAttribute("data-href") ||
            element.getAttribute("data-url") ||
            element.getAttribute("data-route") ||
            element.getAttribute("data-path") ||
            anchor.href ||
            "",
          text:
            element.textContent ||
            element.getAttribute("aria-label") ||
            element.getAttribute("title") ||
            "",
        };
      })
    )
    .catch(
      () => [] as Array<{ tagName: string; raw: string; text: string }>
    );

  const links = candidates
    .filter(
      (candidate) =>
        candidate.tagName === "A" ||
        !isMutatingOrUnsafeText(candidate.text)
    )
    .map((candidate) => normalizeUrl(candidate.raw, actualUrl, config))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(links));
}

async function scanTarget(
  page: Page,
  config: TargetConfig,
  projectName: string
): Promise<TargetResult> {
  const outputDirectory = path.resolve(
    "sitemap-output",
    projectName,
    config.id
  );

  const graphFile = path.join(outputDirectory, "graph.html");
  const jsonFile = path.join(outputDirectory, "sitemap.json");
  const mermaidFile = path.join(outputDirectory, "sitemap.mmd");

  await fs.rm(outputDirectory, { recursive: true, force: true });
  await fs.mkdir(outputDirectory, { recursive: true });

  await login(page, config);

  const requestedStartUrl = new URL(
    config.startPath,
    config.baseUrl
  ).toString();

  const normalizedStartUrl =
    normalizeUrl(page.url(), requestedStartUrl, config) ||
    normalizeUrl(requestedStartUrl, config.baseUrl, config);

  if (!normalizedStartUrl) {
    throw new Error(
      `[${config.label}] Start URL non valida: ${requestedStartUrl}`
    );
  }

  const queue: Array<{ url: string; calledBy?: string }> = [
    { url: normalizedStartUrl },
  ];

  const queued = new Set<string>([normalizedStartUrl]);
  const visited = new Set<string>();
  const nodes = new Map<string, SitemapNode>();
  const edges = new Map<string, SitemapEdge>();
  const calledByByUrl = new Map<string, Set<string>>();
  const familyRepresentative = new Map<string, string>();
  const errors: SitemapError[] = [];

  while (queue.length > 0 && visited.size < config.maximumPages) {
    const item = queue.shift();
    if (!item || visited.has(item.url)) continue;

    visited.add(item.url);

    printProgress(
      config,
      projectName,
      item.url,
      visited.size,
      queue.length,
      nodes.size,
      errors.length
    );

    try {
      await page.goto(item.url, {
        waitUntil: "domcontentloaded",
        timeout: 25_000,
      });

      await page.waitForTimeout(750);

      await page
        .evaluate(() => {
          window.stop();
        })
        .catch(() => undefined);

      if (isLoginUrl(page.url())) {
        errors.push({
          url: item.url,
          message: "Pagina non accessibile: redirect al login.",
        });
        continue;
      }

      const actualUrl = normalizeUrl(page.url(), item.url, config) || item.url;
      visited.add(actualUrl);

      const title = cleanText(await page.title().catch(() => ""));
      const heading = cleanText(
        await page
          .locator("h1:visible, h2:visible")
          .first()
          .textContent({ timeout: 4_000 })
          .catch(() => "")
      );

      const parsed = new URL(actualUrl);
      const existing = nodes.get(actualUrl);
      const calledBy = calledByByUrl.get(actualUrl) || new Set<string>();
      for (const source of existing?.calledBy || []) calledBy.add(source);
      if (item.calledBy) calledBy.add(item.calledBy);
      calledByByUrl.set(actualUrl, calledBy);

      nodes.set(actualUrl, {
        url: actualUrl,
        pathname: `${parsed.pathname}${parsed.search}`,
        title,
        heading,
        kind: classifyPage(actualUrl, config),
        calledBy: Array.from(calledBy).sort(),
      });

      const links = await extractInternalLinks(page, actualUrl, config);

      for (const rawLink of links) {
        if (!shouldQueueLink(actualUrl, rawLink, config)) continue;

        const link = collapseDynamicRoute(rawLink, familyRepresentative);

        const edgeKey = `${actualUrl} -> ${link}`;
        edges.set(edgeKey, { from: actualUrl, to: link });

        const linkSources = calledByByUrl.get(link) || new Set<string>();
        linkSources.add(actualUrl);
        calledByByUrl.set(link, linkSources);

        if (!visited.has(link) && !queued.has(link)) {
          queue.push({ url: link, calledBy: actualUrl });
          queued.add(link);
        } else if (nodes.has(link)) {
          const targetNode = nodes.get(link)!;
          if (!targetNode.calledBy.includes(actualUrl)) {
            targetNode.calledBy.push(actualUrl);
            targetNode.calledBy.sort();
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ url: item.url, message });
      console.log(`⚠️ Errore su ${item.url}`);
      console.log(message);
    }
  }

  if (visited.size >= config.maximumPages && queue.length > 0) {
    errors.push({
      url: normalizedStartUrl,
      message:
        `Limite di ${config.maximumPages} pagine raggiunto. ` +
        `Restano ${queue.length} URL non analizzate.`,
    });
  }

  const sortedNodes = Array.from(nodes.values()).sort((first, second) =>
    first.pathname.localeCompare(second.pathname)
  );

  const nodeUrls = new Set(sortedNodes.map((node) => node.url));

  const sortedEdges = Array.from(edges.values())
    .filter((edge) => nodeUrls.has(edge.from) && nodeUrls.has(edge.to))
    .sort((first, second) =>
      `${first.from}-${first.to}`.localeCompare(`${second.from}-${second.to}`)
    );

  const mermaid = buildMermaid(config, sortedNodes, sortedEdges);
  const graphHtml = buildGraphHtml(
    config,
    projectName,
    sortedNodes,
    sortedEdges,
    errors,
    mermaid
  );

  await fs.writeFile(
    jsonFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        target: config.id,
        label: config.label,
        project: projectName,
        baseUrl: config.baseUrl,
        startPath: config.startPath,
        pages: sortedNodes,
        edges: sortedEdges,
        errors,
      },
      null,
      2
    ),
    "utf8"
  );

  await fs.writeFile(mermaidFile, mermaid, "utf8");
  await fs.writeFile(graphFile, graphHtml, "utf8");

  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ MAPPA ${config.label.toUpperCase()} COMPLETATA`);
  console.log(`📄 Pagine: ${sortedNodes.length}`);
  console.log(`🔗 Collegamenti: ${sortedEdges.length}`);
  console.log(`⚠️  Errori: ${errors.length}`);
  console.log(`🌐 ${graphFile}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return {
    config,
    nodes: sortedNodes,
    edges: sortedEdges,
    errors,
    graphFile,
    jsonFile,
    mermaidFile,
  };
}

function buildMermaid(
  config: TargetConfig,
  nodes: SitemapNode[],
  edges: SitemapEdge[]
): string {
  const nodeIdByUrl = new Map<string, string>();

  nodes.forEach((node, index) => {
    nodeIdByUrl.set(node.url, `N${index}`);
  });

  const lines: string[] = ["flowchart LR"];

  for (const node of nodes) {
    const nodeId = nodeIdByUrl.get(node.url)!;
    const mainLabel = node.heading || node.title || node.pathname || "Pagina";
    const compactLabel = cleanText(mainLabel).slice(0, 70);
    const label =
      `<b>${escapeHtml(compactLabel)}</b>` +
      `<br/><span style='font-size:12px'>${escapeHtml(node.pathname)}</span>`;

    lines.push(`  ${nodeId}["${label}"]:::${node.kind}`);
  }

  for (const edge of edges) {
    const from = nodeIdByUrl.get(edge.from);
    const to = nodeIdByUrl.get(edge.to);

    if (from && to && from !== to) {
      lines.push(`  ${from} --> ${to}`);
    }
  }

  for (const node of nodes) {
    const nodeId = nodeIdByUrl.get(node.url)!;
    const safeUrl = node.url.replaceAll('"', "%22");
    lines.push(`  click ${nodeId} "${safeUrl}" "Apri pagina" _blank`);
  }

  lines.push("");
  lines.push(
    "  classDef nextgen fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#14532d;"
  );
  lines.push(
    "  classDef legacy fill:#ffedd5,stroke:#ea580c,stroke-width:2px,color:#7c2d12;"
  );
  lines.push(
    "  classDef partner fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#1e3a8a;"
  );
  lines.push(
    "  classDef admin fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,color:#581c87;"
  );

  if (config.id === "parent") {
    lines.push("  %% Verde = Next Gen; arancione = Legacy richiamata");
  }

  return lines.join("\n");
}

function legendForTarget(config: TargetConfig): string {
  if (config.id === "parent") {
    return `
      <div class="legend-item"><span class="dot nextgen"></span>Next Gen</div>
      <div class="legend-item"><span class="dot legacy"></span>Legacy richiamata</div>
    `;
  }

  const cssClass = config.id === "partner" ? "partner" : "admin";

  return `
    <div class="legend-item"><span class="dot ${cssClass}"></span>${escapeHtml(
      config.label
    )}</div>
  `;
}

function buildGraphHtml(
  config: TargetConfig,
  projectName: string,
  nodes: SitemapNode[],
  edges: SitemapEdge[],
  errors: SitemapError[],
  mermaid: string
): string {
  const payload = escapeJsonForHtml(
    JSON.stringify({
      target: config.id,
      project: projectName,
      pageCount: nodes.length,
      edgeCount: edges.length,
      errorCount: errors.length,
    })
  );

  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TRAMA - Mappa ${escapeHtml(config.label)}</title>

  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

    mermaid.initialize({
      startOnLoad: true,
      theme: "base",
      securityLevel: "loose",
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: "basis",
        nodeSpacing: 45,
        rankSpacing: 70
      }
    });
  </script>

  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f4f6f8;
      color: #172033;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding: 16px 22px;
      border-bottom: 1px solid #e2e8f0;
      background: rgba(255,255,255,.96);
      backdrop-filter: blur(10px);
    }
    h1 { margin: 0 0 4px; font-size: 22px; }
    header p { margin: 0; color: #64748b; }
    .legend, .toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot.nextgen { background: #22c55e; }
    .dot.legacy { background: #f97316; }
    .dot.partner { background: #3b82f6; }
    .dot.admin { background: #a855f7; }
    .toolbar button, .toolbar a {
      border: 0;
      border-radius: 9px;
      padding: 9px 12px;
      background: #172033;
      color: white;
      font-weight: 750;
      text-decoration: none;
      cursor: pointer;
    }
    .graph-wrapper { min-height: calc(100vh - 85px); padding: 28px; overflow: auto; }
    .graph-board {
      width: max-content;
      min-width: 100%;
      min-height: 680px;
      padding: 38px;
      border-radius: 22px;
      background: white;
      box-shadow: 0 10px 40px rgba(15, 23, 42, .08);
      transform-origin: top left;
    }
    .mermaid { display: flex; justify-content: center; }
    .mermaid svg { max-width: none !important; height: auto; }
    .status {
      position: fixed;
      right: 20px;
      bottom: 18px;
      z-index: 30;
      padding: 8px 11px;
      border-radius: 999px;
      background: rgba(23,32,51,.92);
      color: white;
      font-size: 12px;
      font-weight: 700;
    }
    @media (max-width: 900px) {
      header { display: block; }
      .legend, .toolbar { margin-top: 10px; }
      .graph-wrapper { padding: 14px; }
      .graph-board { padding: 18px; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>TRAMA - Mappa ${escapeHtml(config.label)}</h1>
      <p>${escapeHtml(projectName)} · ${nodes.length} pagine · ${
        edges.length
      } collegamenti · ${errors.length} errori</p>
    </div>

    <div class="legend">${legendForTarget(config)}</div>

    <div class="toolbar">
      <button id="zoom-out" type="button">−</button>
      <button id="zoom-reset" type="button">Adatta</button>
      <button id="zoom-in" type="button">+</button>
      <a href="sitemap.json" target="_blank" rel="noreferrer">JSON</a>
    </div>
  </header>

  <main id="graph-wrapper" class="graph-wrapper">
    <section id="graph-board" class="graph-board">
      <pre class="mermaid">${escapeHtml(mermaid)}</pre>
    </section>
  </main>

  <div id="status" class="status">Zoom 100%</div>

  <script>
    const metadata = JSON.parse("${payload.replaceAll('"', '\\"')}");
    const wrapper = document.getElementById("graph-wrapper");
    const board = document.getElementById("graph-board");
    const status = document.getElementById("status");
    let scale = 1;

    function applyScale() {
      board.style.transform = "scale(" + scale + ")";
      status.textContent = "Zoom " + Math.round(scale * 100) + "%";
    }

    function fitGraph() {
      const svg = board.querySelector("svg");
      if (!svg) return;

      const svgWidth = svg.getBoundingClientRect().width / scale;
      const availableWidth = Math.max(wrapper.clientWidth - 90, 320);
      scale = Math.max(0.15, Math.min(1, availableWidth / svgWidth));
      applyScale();
    }

    document.getElementById("zoom-in").addEventListener("click", () => {
      scale = Math.min(2, scale + 0.1);
      applyScale();
    });

    document.getElementById("zoom-out").addEventListener("click", () => {
      scale = Math.max(0.1, scale - 0.1);
      applyScale();
    });

    document.getElementById("zoom-reset").addEventListener("click", fitGraph);

    const observer = new MutationObserver(() => {
      if (board.querySelector("svg")) {
        observer.disconnect();
        window.setTimeout(fitGraph, 150);
      }
    });

    observer.observe(board, { childList: true, subtree: true });
    window.addEventListener("resize", () => window.setTimeout(fitGraph, 100));
    console.info("TRAMA sitemap", metadata);
  </script>
</body>
</html>`;
}

function buildDashboardHtml(
  projectName: string,
  results: TargetResult[]
): string {
  const cards = results
    .map(
      (result) => `
      <a class="card ${result.config.id}" href="${result.config.id}/graph.html">
        <span class="eyebrow">${escapeHtml(result.config.label)}</span>
        <strong>${result.nodes.length} pagine</strong>
        <small>${result.edges.length} collegamenti · ${result.errors.length} errori</small>
        <span class="cta">Apri mappa →</span>
      </a>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TRAMA - Mappe applicative ${escapeHtml(projectName)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f4f6f8;
      color: #172033;
    }
    main { width: min(1040px, 100%); }
    h1 { margin: 0 0 8px; font-size: clamp(30px, 5vw, 52px); }
    .intro { margin: 0 0 28px; color: #64748b; font-size: 17px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
    .card {
      min-height: 240px;
      display: flex;
      flex-direction: column;
      padding: 24px;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      background: white;
      color: inherit;
      text-decoration: none;
      box-shadow: 0 8px 28px rgba(15,23,42,.07);
      transition: transform .18s ease, box-shadow .18s ease;
    }
    .card:hover { transform: translateY(-4px); box-shadow: 0 14px 35px rgba(15,23,42,.12); }
    .card.parent { border-top: 6px solid #22c55e; }
    .card.partner { border-top: 6px solid #3b82f6; }
    .card.admin { border-top: 6px solid #a855f7; }
    .eyebrow { color: #64748b; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    strong { display: block; margin-top: 20px; font-size: 32px; }
    small { display: block; margin-top: 7px; color: #64748b; }
    .cta { margin-top: auto; font-weight: 850; }
    @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } .card { min-height: 190px; } }
  </style>
</head>
<body>
  <main>
    <h1>TRAMA - Mappe applicative</h1>
    <p class="intro">Progetto Playwright: ${escapeHtml(projectName)}</p>
    <section class="grid">${cards}</section>
  </main>
</body>
</html>`;
}

function openHtmlInBrowser(filePath: string): void {
  if (process.env.CI === "true" || process.env.CI === "1") return;
  if (process.env.SITEMAP_OPEN_BROWSER === "0") return;

  try {
    let command: string;
    let args: string[];

    if (process.platform === "darwin") {
      command = "open";
      args = [filePath];
    } else if (process.platform === "win32") {
      command = "cmd";
      args = ["/c", "start", "", filePath];
    } else {
      command = "xdg-open";
      args = [filePath];
    }

    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });

    child.unref();
  } catch {
    console.log(`⚠️ Apri manualmente: ${filePath}`);
  }
}

test("genera mappe visuali TRAMA", async ({ page }, testInfo) => {
  test.setTimeout(30 * 60 * 1000);

  const projectName = safeFilename(testInfo.project.name || "playwright");
  const targets = targetIdsFromEnvironment();
  const results: TargetResult[] = [];

  for (const target of targets) {
    const config = buildTargetConfig(target);
    results.push(await scanTarget(page, config, projectName));
  }

  const projectOutputDirectory = path.resolve(
    "sitemap-output",
    projectName
  );

  await fs.mkdir(projectOutputDirectory, { recursive: true });

  const dashboardFile = path.join(projectOutputDirectory, "index.html");
  await fs.writeFile(
    dashboardFile,
    buildDashboardHtml(projectName, results),
    "utf8"
  );

  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ MAPPE VISUALI TRAMA COMPLETATE");
  console.log(`🌐 ${dashboardFile}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  openHtmlInBrowser(dashboardFile);
});