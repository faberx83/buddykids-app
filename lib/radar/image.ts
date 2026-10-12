// TRAMA — RADAR (12/10/2026). Controlli sulle immagini caricate, PURI.
// Il tipo si decide dai primi byte del file (magic bytes), mai dal nome o
// dal Content-Type dichiarato dal browser. Il file non viene mai salvato:
// resta in memoria il tempo dell'analisi (decisione di Fabrizio, 12/10).

export const RADAR_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type RadarImageMime = "image/jpeg" | "image/png" | "image/webp";

export function detectImageMime(bytes: Uint8Array): RadarImageMime | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export type ImageCheck = { ok: true; mime: RadarImageMime } | { ok: false; error: string };

export function checkImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length === 0) return { ok: false, error: "Il file è vuoto." };
  if (bytes.length > RADAR_MAX_IMAGE_BYTES) return { ok: false, error: "L'immagine è troppo grande: massimo 8 MB." };
  const mime = detectImageMime(bytes);
  if (!mime) return { ok: false, error: "Formato non supportato: usa una foto JPG, PNG o WEBP." };
  return { ok: true, mime };
}
