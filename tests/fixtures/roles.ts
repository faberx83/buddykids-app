import { test as base, type Page } from "@playwright/test";

/**
 * Ruoli demo di BuddyKids (vedi components/DemoRoleProvider.tsx).
 * In modalita' mock (Supabase non configurato) basta scrivere questa chiave
 * in localStorage prima di navigare: nessun login necessario.
 *
 * Contro un deploy con Supabase configurato, il RoleSwitcher sparisce
 * (isSupabaseConfigured === true) e serve invece un login reale con un
 * account gia' promosso al ruolo giusto (vedi README, sezione "Promuovere un
 * utente"). In quel caso imposta le env TEST_PARENT_EMAIL/PASSWORD,
 * TEST_CENTER_ADMIN_EMAIL/PASSWORD, TEST_PLATFORM_ADMIN_EMAIL/PASSWORD e
 * usa loginAs() invece di setDemoRole().
 */
export type Role = "parent" | "center_admin" | "platform_admin";

const ROLE_HOME: Record<Role, string> = {
  parent: "/",
  center_admin: "/center",
  platform_admin: "/admin",
};

export async function setDemoRole(page: Page, role: Role) {
  await page.addInitScript((r) => {
    window.localStorage.setItem("buddykids-demo-role", r);
  }, role);
}

export async function gotoAsRole(page: Page, role: Role, path?: string) {
  await setDemoRole(page, role);
  await page.goto(path ?? ROLE_HOME[role]);
}

const CREDENTIALS: Record<Role, { email?: string; password?: string }> = {
  parent: { email: process.env.TEST_PARENT_EMAIL, password: process.env.TEST_PARENT_PASSWORD },
  center_admin: {
    email: process.env.TEST_CENTER_ADMIN_EMAIL,
    password: process.env.TEST_CENTER_ADMIN_PASSWORD,
  },
  platform_admin: {
    email: process.env.TEST_PLATFORM_ADMIN_EMAIL,
    password: process.env.TEST_PLATFORM_ADMIN_PASSWORD,
  },
};

/** Login reale via /auth/login. Usare contro un deploy con Supabase configurato. */
export async function loginAs(page: Page, role: Role) {
  const creds = CREDENTIALS[role];
  if (!creds.email || !creds.password) {
    throw new Error(
      `Credenziali di test mancanti per il ruolo "${role}". Imposta le variabili d'ambiente corrispondenti (vedi tests/fixtures/roles.ts).`
    );
  }
  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/password/i).fill(creds.password);
  await page.getByRole("button", { name: /accedi|login/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"));
}

export const test = base;
export { expect } from "@playwright/test";
