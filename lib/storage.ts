"use client";

// Upload immagini (foto profilo genitore/bambino, copertina/galleria
// attività, logo centro/fornitore) verso Supabase Storage, bucket pubblico
// "buddykids-images" (creato dalla migrazione SQL — vedi
// supabase/migrations/2026xxxx_images.sql). Nessuna dipendenza nuova: usa il
// client browser già esistente.

import { createClient } from "@/lib/supabase/client";

export const IMAGES_BUCKET = "buddykids-images";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export interface UploadResult {
  url: string | null;
  error: string | null;
}

// `folder` distingue lo scopo (es. "avatars", "kids", "activities",
// "centers", "suppliers") — utile sia per organizzare il bucket sia perché
// le policy di storage potrebbero in futuro diventare specifiche per cartella.
export async function uploadImage(folder: string, file: File): Promise<UploadResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { url: null, error: "Formato non supportato — usa JPG, PNG, WEBP o GIF." };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { url: null, error: "Immagine troppo grande — massimo 5MB." };
  }

  const supabase = createClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(IMAGES_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// Documento di supporto per una richiesta di Certificazione servizio (vedi
// app/actions/certifications.ts) — a differenza delle foto sopra, va su un
// bucket PRIVATO ("buddykids-certifications", vedi supabase/schema.sql) e
// non ritorna un URL pubblico ma solo il path interno: la visualizzazione
// richiede un link firmato temporaneo generato lato server
// (getCertificationDocumentUrlAction), rispettando le stesse RLS di
// storage.objects (solo il centro proprietario o l'admin possono generarlo).
export const CERTIFICATIONS_BUCKET = "buddykids-certifications";

const CERT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const CERT_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export interface CertificationUploadResult {
  path: string | null;
  error: string | null;
}

// `centerId` è il PRIMO segmento del path (richiesto dalle policy RLS dello
// storage, che verificano storage.foldername(name)[1] = centro dell'utente).
export async function uploadCertificationDocument(
  centerId: string,
  file: File
): Promise<CertificationUploadResult> {
  if (!CERT_ALLOWED_TYPES.includes(file.type)) {
    return { path: null, error: "Formato non supportato — usa PDF, JPG, PNG o WEBP." };
  }
  if (file.size > CERT_MAX_SIZE_BYTES) {
    return { path: null, error: "File troppo grande — massimo 10MB." };
  }

  const supabase = createClient();
  const ext = file.name.split(".").pop() || "pdf";
  const path = `${centerId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(CERTIFICATIONS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) return { path: null, error: error.message };
  return { path, error: null };
}
