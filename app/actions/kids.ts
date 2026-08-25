"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { colorForName, ageFromBirthDate } from "@/lib/data/kids";
import { Kid, KidGender } from "@/lib/types";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { recordParentalDeclaration } from "@/lib/legal/gate";
import { CURRENT_PARENTAL_DECLARATION_VERSION } from "@/lib/legal/consent";

// Stesso bucket di lib/storage.ts#uploadKidAvatar — stringa duplicata
// apposta invece di importarla (stesso pattern già usato da
// app/actions/certifications.ts per "buddykids-certifications": lib/storage.ts
// è "use client", meglio non farlo attraversare il confine server/client).
const KIDS_AVATARS_BUCKET = "buddykids-kids-avatars";

// PRE-MICRO-PILOT CLOSURE GATE (task #570, 25/08/2026) — parentalDeclarationAccepted
// è letto SOLO se LEGAL_TERMS_GATE risolve true per QUESTO utente (mai fidato
// da solo: il client non decide se il gate è attivo, vedi
// isParentalDeclarationGateEnabledAction in app/actions/legal.ts, che
// AddKidForm.tsx chiama per decidere se mostrare il checkbox). Con
// legalGateEnabled=false (ogni utente reale oggi) questo parametro è
// ininfluente e il comportamento resta IDENTICO a prima di questo task.
export async function addKidAction(
  name: string,
  birthDate: string,
  gender?: KidGender,
  interests?: string[],
  parentalDeclarationAccepted?: boolean
): Promise<{ kid?: Kid; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!name.trim()) return { error: "Inserisci un nome" };
  if (!birthDate) return { error: "Inserisci la data di nascita" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  // Risolto qui, server-side, autoritativo — mai un booleano "il gate è
  // attivo" fornito dal client. Fail-closed: se il gate è attivo e la
  // dichiarazione non è stata spuntata, il bambino non viene creato.
  const legalGateEnabled = await resolveFeatureFlag({ flagName: "LEGAL_TERMS_GATE", userId: user.id });
  if (legalGateEnabled && !parentalDeclarationAccepted) {
    return { error: "Devi confermare la dichiarazione di responsabilità genitoriale" };
  }

  const { data, error } = await supabase
    .from("kids")
    .insert({
      parent_id: user.id,
      name: name.trim(),
      birth_date: birthDate,
      gender: gender ?? null,
      interests: interests ?? [],
    })
    .select("id, name, birth_date, gender, avatar_emoji, interests")
    .single();

  if (error || !data) return { error: error?.message || "Errore nel salvataggio" };

  if (legalGateEnabled) {
    // Idempotente (UNIQUE(parent_user_id, kid_id, declaration_version) —
    // vedi recordParentalDeclaration): un doppio submit non duplica righe.
    // Un fallimento qui non viene disfatto sul bambino già creato — stesso
    // fail-soft già accettato per il bootstrap di signup, accettabile
    // perché oggi riguarda solo account di test/coorte interna (il gate è
    // OFF per ogni utente reale).
    await recordParentalDeclaration(supabase, user.id, data.id, CURRENT_PARENTAL_DECLARATION_VERSION);
  }

  return {
    kid: {
      id: data.id,
      name: data.name,
      age: ageFromBirthDate(data.birth_date),
      birthDate: data.birth_date ?? undefined,
      gender: (data.gender as KidGender) ?? undefined,
      emoji: data.avatar_emoji || "🙂",
      color: colorForName(data.name),
      note: "",
      interests: data.interests ?? undefined,
    },
  };
}

// Aggiorna solo gli interessi di un bambino già esistente (usato dal profilo
// genitore per completare/correggere le preferenze dopo la creazione).
export async function updateKidInterestsAction(
  kidId: string,
  interests: string[]
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("kids")
    .update({ interests })
    .eq("id", kidId)
    .eq("parent_id", user.id);

  if (error) return { error: error.message };
  return {};
}

// Salva la foto profilo caricata su Storage (vedi lib/storage.ts) — l'upload
// del file avviene lato client.
//
// Fix privacy 06/08/2026: AvatarUploadButton.tsx per folder="kids" carica
// ora su un bucket PRIVATO (uploadKidAvatar) e passa qui un URL FIRMATO
// temporaneo (1h, serve solo per la preview immediata dopo l'upload) — MAI
// salvato cosi com'è, altrimenti l'immagine smetterebbe di funzionare dopo
// un'ora. Si estrae il solo path dell'oggetto dall'URL firmato e si
// persiste quello: lib/data/kids.ts#getKidsForUser rigenera un nuovo URL
// firmato fresco ad ogni lettura dal path salvato (stesso principio di
// getIdentityVerificationDocumentUrlAction, solo fatto al momento della
// lettura invece che on-demand). Se invece arriva un URL "normale" (inizia
// per "http", caso avatars/centers/partner-offers sul vecchio bucket
// pubblico — o una foto bambino caricata PRIMA di questa migrazione) viene
// salvato cosi com'è, invariato.
function extractStoragePath(avatarUrlOrPath: string, bucket: string): string {
  if (!avatarUrlOrPath.startsWith("http")) return avatarUrlOrPath;
  try {
    const { pathname } = new URL(avatarUrlOrPath);
    const marker = `/object/sign/${bucket}/`;
    const idx = pathname.indexOf(marker);
    if (idx === -1) return avatarUrlOrPath;
    return decodeURIComponent(pathname.slice(idx + marker.length));
  } catch {
    return avatarUrlOrPath;
  }
}

export async function updateKidAvatarAction(
  kidId: string,
  avatarUrl: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const storedValue = extractStoragePath(avatarUrl, KIDS_AVATARS_BUCKET);

  const { error } = await supabase
    .from("kids")
    .update({ avatar_url: storedValue })
    .eq("id", kidId)
    .eq("parent_id", user.id);

  if (error) return { error: error.message };
  return {};
}
