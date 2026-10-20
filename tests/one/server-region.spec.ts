import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

// TRAMA — funzioni Vercel nella stessa città del database (20/10/2026).
// Il database Supabase è a Parigi (eu-west-3): le funzioni girano in cdg1
// (Parigi) invece che in iad1 (USA), per latenza e trattamento dati in UE.
// Comando: npx playwright test tests/one/server-region.spec.ts

test("REG-01: vercel.json fissa le funzioni a Parigi (cdg1)", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, "../../vercel.json"), "utf-8"));
  expect(vercel.regions).toEqual(["cdg1"]);
});
