import { test, expect } from "../fixtures/roles";
import { isVersionToggleTestAccount } from "../../lib/dev/test-accounts";

// Richiesta di Fabrizio (27/08): il toggle LEGACY/NEXTGEN (components/
// VersionToggle.tsx) deve restare visibile solo per le sue utenze di test
// ("faberx83@gmail.com e tutte le sue formule derivate"). Questi test [no
// browser] verificano direttamente la funzione pura di pattern matching,
// senza bisogno di un browser reale né di account Supabase veri.
test.describe("isVersionToggleTestAccount [no browser]", () => {
  test("indirizzo base esatto -> true", () => {
    expect(isVersionToggleTestAccount("faberx83@gmail.com")).toBe(true);
  });

  test("varianti Gmail '+' -> true", () => {
    expect(isVersionToggleTestAccount("faberx83+newparent@gmail.com")).toBe(true);
    expect(isVersionToggleTestAccount("faberx83+centro-demo@gmail.com")).toBe(true);
    expect(isVersionToggleTestAccount("faberx83+test123@gmail.com")).toBe(true);
  });

  test("case-insensitive", () => {
    expect(isVersionToggleTestAccount("Faberx83@Gmail.com")).toBe(true);
    expect(isVersionToggleTestAccount("FABERX83+QA@GMAIL.COM")).toBe(true);
  });

  test("account esterni/beta tester -> false", () => {
    expect(isVersionToggleTestAccount("mario.rossi@gmail.com")).toBe(false);
    expect(isVersionToggleTestAccount("fabrizio.pirulli@eolo.it")).toBe(false);
  });

  test("prefisso simile ma non plus-address valido -> false", () => {
    expect(isVersionToggleTestAccount("faberx83.altro@gmail.com")).toBe(false);
    expect(isVersionToggleTestAccount("notfaberx83@gmail.com")).toBe(false);
    expect(isVersionToggleTestAccount("faberx83@gmail.com.evil.com")).toBe(false);
  });

  test("null/undefined/stringa vuota -> false", () => {
    expect(isVersionToggleTestAccount(null)).toBe(false);
    expect(isVersionToggleTestAccount(undefined)).toBe(false);
    expect(isVersionToggleTestAccount("")).toBe(false);
  });
});
