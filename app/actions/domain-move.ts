"use server";

// TRAMA — TRASLOCO SU tramapp.it (16/10/2026). Ultimo passo del trasloco,
// sul NUOVO indirizzo: controlla firma e scadenza del passaggio arrivato
// dal vecchio indirizzo e apre la sessione qui (cookie del nuovo dominio).
// Vedi lib/domain-move.ts per il giro completo.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { decodeHandoff, readHandoffFragment } from "@/lib/domain-move";
import { domainMoveSigner } from "@/lib/domain-move-server";

export interface CompleteDomainMoveResult {
  next: string;
  ok: boolean;
}

export async function completeDomainMoveAction(hash: string): Promise<CompleteDomainMoveResult> {
  const fail = (next = "/"): CompleteDomainMoveResult => ({ ok: false, next });
  if (!isSupabaseConfigured) return fail();
  const signer = domainMoveSigner();
  const parts = readHandoffFragment(hash ?? "");
  if (!signer || !parts) return fail();

  const check = decodeHandoff(parts.p, parts.s, signer, Math.floor(Date.now() / 1000));
  if (!check.ok) return fail();

  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({
    access_token: check.payload.at,
    refresh_token: check.payload.rt,
  });
  if (error) return fail(check.payload.n);
  return { ok: true, next: check.payload.n };
}
