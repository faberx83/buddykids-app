// TRAMA — formato email in accesso e registrazione (16/10/2026, Fabrizio:
// "dobbiamo aggiungere check su formato mail quando si fa login"). [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { checkEmail, normalizeEmail } from "../../lib/auth/email-check";

test.describe("TRAMA — Controllo email [no browser]", () => {
  test("EM-01 valide: spazi e maiuscole sistemati", () => {
    expect(checkEmail("  Faberx83+TestParent@Gmail.com ")).toEqual({ ok: true, email: "faberx83+testparent@gmail.com" });
    expect(checkEmail("nome.cognome@scuola.edu.it").ok).toBe(true);
    expect(normalizeEmail(" A@B.IT ")).toBe("a@b.it");
  });

  test("EM-02 non valide: senza @, senza dominio completo, spazi, punti doppi", () => {
    for (const bad of ["", "nome", "nome@", "@gmail.com", "nome@gmail", "nome@gmail.", "nome@.com", "no me@gmail.com", "nome..x@gmail.com", "a@b@c.it"]) {
      expect(checkEmail(bad).ok, bad).toBe(false);
    }
    const r = checkEmail("nome@gmail");
    expect(r.ok === false && r.message).toContain("dopo la @");
  });

  test("EM-03 errori di battitura comuni: suggerimento con un tocco", () => {
    const r = checkEmail("dekia2@gmail.con");
    expect(r).toEqual({ ok: false, message: "Forse intendevi dekia2@gmail.com?", suggestion: "dekia2@gmail.com" });
    expect(checkEmail("x@hotmial.com").ok).toBe(false);
  });

  test("EM-04 collegato al modulo di accesso: controllo prima di Supabase in login, registrazione e recupero", () => {
    const f = fs.readFileSync(path.join(__dirname, "../../app/auth/login/LoginForm.tsx"), "utf-8");
    expect(f).toContain("const emailCheck = checkEmail(email);");
    expect(f).toContain("signInWithPassword({ email: cleanEmail, password })");
    expect(f).toContain("resetPasswordForEmail(cleanEmail,");
    expect(f).toContain("email: cleanEmail,");
    expect(f).toContain("Usa {emailSuggestion}");
    expect(f).toContain('autoCapitalize="none"');
  });
});
