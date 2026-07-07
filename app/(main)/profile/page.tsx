import MenuItem from "@/components/MenuItem";
import LogoutButton from "@/components/LogoutButton";
import ProfileKidsSection from "@/components/ProfileKidsSection";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getKidsForUser } from "@/lib/data/kids";
import { ComingSoonBadge, DemoBadge } from "@/components/StatusBadge";

async function getProfileIdentity() {
  const fallback = { displayName: "Sofia Ferretti", displayEmail: "sofia.ferretti@email.it", initials: "SF" };
  if (!isSupabaseConfigured) return fallback;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fallback;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const displayEmail: string = profile?.email || user.email || fallback.displayEmail;
  const displayName: string = profile?.full_name?.trim() || displayEmail.split("@")[0];
  const initials =
    displayName
      .split(/\s+/)
      .map((part: string) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return { displayName, displayEmail, initials };
}

export default async function ProfilePage() {
  const { displayName, displayEmail, initials } = await getProfileIdentity();
  const kids = await getKidsForUser();

  return (
    <div className="animate-fade-in">
      <div
        className="flex-shrink-0 px-5 pb-6 pt-5"
        style={{
          background: "linear-gradient(160deg,#E8F6FD 0%,#E3F9F5 100%)",
        }}
      >
        <div className="mb-[18px] flex items-center gap-3.5">
          <div
            className="flex h-[62px] w-[62px] items-center justify-center rounded-full text-xl font-bold text-white"
            style={{ background: "linear-gradient(135deg,#4DAFEF,#3ECFB2)" }}
          >
            {initials}
          </div>
          <div>
            <div className="text-lg font-bold text-ink">{displayName}</div>
            <div className="mt-0.5 text-xs text-ink-2">{displayEmail}</div>
          </div>
          <button className="ml-auto flex items-center gap-1.5 rounded-sm border border-[#E8EBF0] bg-white px-3 py-1.5 text-xs font-medium text-ink opacity-70">
            Modifica
            <ComingSoonBadge />
          </button>
        </div>
        <div className="mb-1.5 flex justify-end">
          <DemoBadge label="Numeri demo" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat num="12" label="Prenotazioni" />
          <Stat num="3" label="Gruppi" />
          <Stat num="€85" label="Risparmiati" />
        </div>
      </div>

      <ProfileKidsSection initialKids={kids} />

      <div className="px-5 pt-2">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Attività
        </div>
        <MenuItem
          icon="ti-ticket"
          iconBg="#E8F6FD"
          iconColor="#4DAFEF"
          main="Le mie prenotazioni"
          sub="Elenco prenotazioni in arrivo"
          comingSoon
        />
        <MenuItem
          icon="ti-bell"
          iconBg="#FFF0EA"
          iconColor="#FF8C5A"
          main="Notifiche"
          sub="Non ancora attive"
          comingSoon
        />
        <MenuItem
          icon="ti-heart"
          iconBg="#FFF8E7"
          iconColor="#c49a00"
          main="Preferiti"
          sub="Non ancora attivi"
          comingSoon
        />
        <MenuItem
          icon="ti-bus"
          iconBg="#E8F9EE"
          iconColor="#52C87A"
          main="Navetta"
          sub="Tracciamento live non ancora disponibile"
          comingSoon
        />
      </div>

      <div className="px-5 pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Supporto
        </div>
        <MenuItem icon="ti-message-circle" iconBg="#F4F6FA" iconColor="#6B7280" main="Chat con organizzatori" sub="Rispondiamo in 2 ore" comingSoon />
        <MenuItem icon="ti-file-invoice" iconBg="#F4F6FA" iconColor="#6B7280" main="Ricevute e fatture" comingSoon />
        <MenuItem icon="ti-language" iconBg="#F4F6FA" iconColor="#6B7280" main="Lingua" sub="Italiano · English" comingSoon />
      </div>

      <LogoutButton />
      <div className="h-4" />
    </div>
  );
}

function Stat({ num, label }: { num: string; label: string }) {
  return (
    <div className="rounded-md bg-white px-2 py-2.5 text-center">
      <div className="text-lg font-bold text-ink">{num}</div>
      <div className="mt-0.5 text-[10px] font-medium text-ink-2">{label}</div>
    </div>
  );
}
