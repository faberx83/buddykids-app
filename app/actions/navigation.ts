"use server";

// Wrapper server action per LoginForm.tsx (Client Component): resolveFeatureFlag()
// e la lettura di profiles.role devono restare server-side (vedi
// lib/auth/default-landing.ts). Usata SOLO quando non è stata richiesta
// esplicitamente un'altra destinazione (?next=...) dopo un login normale —
// vedi commento su resolveDefaultLandingPath per il bug che questo risolve
// (beta tester esterni intrappolati su Legacy senza modo di raggiungere
// NextGen).
import { createClient } from "@/lib/supabase/server";
import { resolveDefaultLandingPath } from "@/lib/auth/default-landing";

export async function getPostLoginDestinationAction(userId: string): Promise<"/" | "/nextgen"> {
  const supabase = await createClient();
  return resolveDefaultLandingPath(supabase, userId);
}
