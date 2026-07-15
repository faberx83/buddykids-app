// SPRINT 5.3 (NEXTGEN) — tipi/costanti "Indirizzi di famiglia" estratti da
// lib/data/addresses.ts in un modulo SENZA alcun import server-only (niente
// lib/supabase/server, quindi niente next/headers): serve perché
// IndirizziClient.tsx ("use client") importava ADDRESS_KIND_LABELS
// direttamente da lib/data/addresses.ts, e qualunque import — anche solo per
// una singola costante — trascina l'intero modulo (incluso l'import di
// next/headers) nel bundle client, facendo fallire la build Next.js
// ("You're importing a module that depends on next/headers... but you are
// using it in the Pages Router"). lib/data/addresses.ts ora importa da qui
// e ri-esporta, cosi il codice server-side resta invariato.

export type AddressKind = "casa" | "lavoro_genitore1" | "lavoro_genitore2" | "altro";

export interface ParentAddress {
  kind: AddressKind;
  // SPRINT 4 correttivo — non più riservato a kind="altro": qualunque slot
  // può avere un nome personalizzato (es. rinominare "Lavoro Genitore 2" in
  // "Casa della nonna"). Per "altro" resta obbligatorio (nessun default
  // sensato); per gli altri kind, se null/vuoto la UI mostra l'etichetta
  // fissa di ADDRESS_KIND_LABELS.
  label: string | null;
  address: string; // vuoto se non ancora impostato
}

export const ADDRESS_KINDS: AddressKind[] = ["casa", "lavoro_genitore1", "lavoro_genitore2", "altro"];

export const ADDRESS_KIND_LABELS: Record<AddressKind, string> = {
  casa: "Casa",
  lavoro_genitore1: "Lavoro Genitore 1",
  lavoro_genitore2: "Lavoro Genitore 2",
  altro: "Altro",
};
