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
