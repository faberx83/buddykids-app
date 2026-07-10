import Link from "next/link";
import HomeFeed from "@/components/HomeFeed";
import HomeProfilePrompt from "@/components/HomeProfilePrompt";
import CheckinPrompt from "@/components/CheckinPrompt";
import { categories } from "@/lib/mock-data";
import { getActivities, getActivityAvailabilityByWeek } from "@/lib/data/activities";
import { getKidsForUser } from "@/lib/data/kids";
import { getPlannerData } from "@/lib/data/planner";
import { getBookingsByKid } from "@/lib/data/kid-bookings";
import { isParentProfileIncomplete } from "@/lib/data/profile";
import { getTodayCheckinsForParent } from "@/lib/data/checkin";
import { getSeasonYear } from "@/lib/data/season-year";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

async function getDisplayIdentity() {
  if (!isSupabaseConfigured) {
    return { displayName: "Sofia", initials: "SF", avatarUrl: null as string | null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { displayName: "Sofia", initials: "SF", avatarUrl: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_url")
    .eq("id", user.id)
    .single();

  const emailLocalPart: string = (profile?.email || user.email || "").split("@")[0];
  const fullName: string = profile?.full_name?.trim() || "";
  const displayName = fullName || emailLocalPart || "👋";
  const nameForInitials: string = fullName || emailLocalPart || "?";
  const initials =
    nameForInitials
      .split(/\s+/)
      .map((part: string) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return { displayName, initials, avatarUrl: (profile?.avatar_url as string | null) ?? null };
}

export default async function HomePage() {
  const [
    activities,
    { displayName, initials, avatarUrl },
    kids,
    planner,
    profileIncomplete,
    bookingsByKidMap,
    todayCheckins,
    seasonYear,
  ] = await Promise.all([
    getActivities(),
    getDisplayIdentity(),
    getKidsForUser(),
    getPlannerData(),
    isParentProfileIncomplete(),
    getBookingsByKid(),
    getTodayCheckinsForParent(),
    getSeasonYear(),
  ]);
  // I Server Component possono passare ai Client Component solo dati
  // serializzabili: una Map non lo è, la convertiamo in un oggetto piano.
  const bookingsByKid = Object.fromEntries(bookingsByKidMap);
  // Disponibilità reale per settimana (per i suggerimenti "Per riempire la
  // settimana N" del Planner) — richiede seasonYear, quindi in una seconda
  // query dopo, non nel Promise.all sopra.
  const availabilityByWeek = await getActivityAvailabilityByWeek(seasonYear);

  return (
    <div className="animate-fade-in">
      <div
        className="px-5 pb-5 pt-4"
        style={{
          background: "linear-gradient(135deg,#E8F6FD 0%,#E3F9F5 100%)",
        }}
      >
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Ciao, {displayName}! 👋</h2>
            <p className="mt-0.5 text-[13px] text-ink-2">
              Cosa facciamo questa estate?
            </p>
          </div>
          {/* Badge avatar: porta al profilo. Il pallino rosso NON è decorativo:
              compare solo se il profilo è incompleto (nome/ruolo mancanti,
              vedi isParentProfileIncomplete in lib/data/profile.ts), come
              promemoria a completarlo — sparisce da solo una volta fatto. */}
          <Link
            href="/profile"
            aria-label="Vai al profilo"
            className="relative flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-mid text-[15px] font-bold text-orange"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage, non ottimizzabile senza config extra
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
            {profileIncomplete && (
              <div className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#FF6B6B]" />
            )}
          </Link>
        </div>
        <Link
          href="/search"
          className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.07)]"
        >
          <i className="ti ti-search text-lg text-ink-3" />
          <span className="text-sm text-ink-3">Cerca attività...</span>
          <div className="ml-auto flex items-center gap-1 whitespace-nowrap rounded-full bg-sky-light px-2.5 py-1 text-xs font-medium text-sky">
            <i className="ti ti-map-pin text-[11px]" />
            Milano
          </div>
        </Link>
      </div>

      <HomeProfilePrompt profileIncomplete={profileIncomplete} hasKids={kids.length > 0} />
      <CheckinPrompt items={todayCheckins} />

      <HomeFeed
        activities={activities}
        categories={categories}
        kids={kids}
        planner={planner}
        bookingsByKid={bookingsByKid}
        availabilityByWeek={availabilityByWeek}
      />
      <div className="h-5" />
    </div>
  );
}
