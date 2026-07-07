// Bambini del genitore loggato — da Supabase (tabella kids) quando collegato.
// A differenza delle attività (contenuto pubblico), qui NON si torna ai dati
// mock di "Sofia Ferretti" quando Supabase è configurato: un utente reale
// senza bambini ancora inseriti deve vedere una lista vuota, non quella finta.

import { Kid } from "@/lib/types";
import { kids as mockKids } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const PALETTE = ["#E3F9F5", "#FFF0EA", "#F0EEFF", "#E8F6FD", "#E8F9EE", "#FFF8E7"];

export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function ageFromBirthDate(birthDate: string | null): number {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate + "T00:00:00Z");
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return Math.max(age, 0);
}

interface RawKidRow {
  id: string;
  name: string;
  birth_date: string | null;
  gender: string | null;
  avatar_emoji: string | null;
  interests: string[] | null;
}

function mapRow(row: RawKidRow): Kid {
  return {
    id: row.id,
    name: row.name,
    age: ageFromBirthDate(row.birth_date),
    birthDate: row.birth_date ?? undefined,
    gender: (row.gender as Kid["gender"]) ?? undefined,
    emoji: row.avatar_emoji || "🙂",
    color: colorForName(row.name),
    note: "",
    interests: row.interests ?? undefined,
  };
}

export async function getKidsForUser(): Promise<Kid[]> {
  if (!isSupabaseConfigured) return mockKids;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("kids")
    .select("id, name, birth_date, gender, avatar_emoji, interests")
    .eq("parent_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return (data as RawKidRow[]).map(mapRow);
}
