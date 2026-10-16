import "server-only";
import { createHash } from "node:crypto";

/** Impronta sha256 (esadecimale) del testo, la stessa registrata in legal_documents.sha256. */
export function legalTextSha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
