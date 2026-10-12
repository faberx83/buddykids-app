import "server-only";

// TRAMA — RADAR (12/10/2026). Lettura di rete dei metadati di un link, con
// protezione SSRF completa:
//  - solo https sulla porta 443, niente credenziali nell'URL;
//  - risoluzione DNS e blocco di ogni indirizzo privato/interno, ripetuto a
//    ogni redirect (massimo 3, gestiti a mano);
//  - timeout 5 s, massimo 1 MB letto, solo contenuti HTML;
//  - nessun cookie, nessun login: se la pagina chiede l'accesso, si usa solo
//    quello che è pubblico (di solito niente) e l'esito sarà UNCERTAIN.
// Limite noto: tra la verifica DNS e la connessione c'è una finestra teorica
// di DNS rebinding; il rischio è contenuto (solo GET, solo metadati, nessun
// dato restituito oltre a titolo/descrizione) e documentato.

import { lookup } from "node:dns/promises";
import {
  isBlockedIp,
  isFetchableUrl,
  isGenericSocialMetadata,
  isSocialHost,
  normalizeUrl,
  parsePageMetadata,
} from "@/lib/radar/url";
import type { UrlMetadata } from "@/lib/radar/types";

const TIMEOUT_MS = 5_000;
const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.length > 0 && records.every((r: { address: string }) => !isBlockedIp(r.address));
  } catch {
    return false;
  }
}

async function readLimited(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const merged = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const c of chunks) {
    const slice = c.subarray(0, Math.min(c.byteLength, merged.byteLength - offset));
    merged.set(slice, offset);
    offset += slice.byteLength;
    if (offset >= merged.byteLength) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export async function fetchUrlMetadata(rawUrl: string): Promise<UrlMetadata | null> {
  const normalizedUrl = normalizeUrl(rawUrl);
  if (!normalizedUrl) return null;
  const host = new URL(normalizedUrl).hostname;
  const base: UrlMetadata = {
    url: normalizedUrl,
    normalizedUrl,
    host,
    title: null,
    description: null,
    siteName: null,
    isSocialHost: isSocialHost(host),
    unreadable: true,
  };

  let current = normalizedUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isFetchableUrl(current)) return base;
      if (!(await resolvesToPublicAddress(new URL(current).hostname))) return base;
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "TRAMA-Radar/1.0 (+metadati pubblici)", accept: "text/html,application/xhtml+xml" },
        cache: "no-store",
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return base;
        current = new URL(location, current).toString();
        continue;
      }
      if (!res.ok) return base;
      const type = res.headers.get("content-type") ?? "";
      if (!/text\/html|application\/xhtml/i.test(type)) return base;
      const meta = parsePageMetadata(await readLimited(res));
      const generic = base.isSocialHost && isGenericSocialMetadata(meta);
      return {
        ...base,
        title: meta.title,
        description: meta.description,
        siteName: meta.siteName,
        unreadable: generic || (!meta.title && !meta.description),
      };
    }
    return base;
  } catch {
    return base;
  } finally {
    clearTimeout(timer);
  }
}
