import "server-only";

import { createHmac } from "node:crypto";
import type { Signer } from "@/lib/domain-move";

// TRAMA — TRASLOCO SU tramapp.it (16/10/2026). Firma del passaggio di
// sessione: chiave DERIVATA dalla service_role key già presente su Vercel
// (nessuna nuova variabile d'ambiente da creare a mano), con un'etichetta
// dedicata così la chiave non coincide con nessun altro uso.
// Senza la service_role key (anteprima/locale) non c'è firma → il trasloco
// non parte e tutto resta com'era.

export function domainMoveSigner(): Signer | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  const key = createHmac("sha256", secret).update("trama-domain-move-v1").digest();
  return (data: string) => createHmac("sha256", key).update(data).digest("base64url");
}
