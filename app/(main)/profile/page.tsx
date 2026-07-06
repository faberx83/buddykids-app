import MenuItem from "@/components/MenuItem";
import LogoutButton from "@/components/LogoutButton";
import { kids } from "@/lib/mock-data";

export default function ProfilePage() {
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
            SF
          </div>
          <div>
            <div className="text-lg font-bold text-ink">Sofia Ferretti</div>
            <div className="mt-0.5 text-xs text-ink-2">sofia.ferretti@email.it</div>
          </div>
          <button className="ml-auto rounded-sm border border-[#E8EBF0] bg-white px-3 py-1.5 text-xs font-medium text-ink">
            Modifica
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat num="12" label="Prenotazioni" />
          <Stat num="3" label="Gruppi" />
          <Stat num="€85" label="Risparmiati" />
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-bold text-ink">I miei bambini</span>
          <span className="cursor-pointer text-[13px] font-medium text-sky">+ Aggiungi</span>
        </div>
        {kids.map((k) => (
          <div
            key={k.id}
            className="mb-2.5 flex cursor-pointer items-center gap-3 rounded-lg border border-[#F0F2F5] bg-white p-3.5 transition-all hover:scale-[0.98] hover:shadow-md"
          >
            <div
              className="flex h-[50px] w-[50px] flex-shrink-0 items-center justify-center rounded-full text-2xl"
              style={{ background: k.color }}
            >
              {k.emoji}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-ink">
                {k.name} Ferretti
              </div>
              <div className="mb-1 text-xs text-ink-2">
                {k.age} anni · {k.grade}
              </div>
              <div className="flex flex-wrap gap-1">
                {k.interests?.map((int) => (
                  <span
                    key={int}
                    className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium text-ink-2"
                  >
                    {int}
                  </span>
                ))}
              </div>
            </div>
            <i className="ti ti-chevron-right text-lg text-ink-3" />
          </div>
        ))}
      </div>

      <div className="px-5 pt-2">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Attività
        </div>
        <MenuItem
          icon="ti-ticket"
          iconBg="#E8F6FD"
          iconColor="#4DAFEF"
          main="Le mie prenotazioni"
          sub="2 attive · 10 passate"
        />
        <MenuItem
          icon="ti-bell"
          iconBg="#FFF0EA"
          iconColor="#FF8C5A"
          main="Notifiche"
          sub="3 nuovi messaggi"
          badge={3}
        />
        <MenuItem
          icon="ti-heart"
          iconBg="#FFF8E7"
          iconColor="#c49a00"
          main="Preferiti"
          sub="8 attività salvate"
        />
        <MenuItem
          icon="ti-bus"
          iconBg="#E8F9EE"
          iconColor="#52C87A"
          main="Navetta"
          sub="Segui il percorso live"
          href="/groups"
        />
      </div>

      <div className="px-5 pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Supporto
        </div>
        <MenuItem icon="ti-message-circle" iconBg="#F4F6FA" iconColor="#6B7280" main="Chat con organizzatori" sub="Rispondiamo in 2 ore" />
        <MenuItem icon="ti-file-invoice" iconBg="#F4F6FA" iconColor="#6B7280" main="Ricevute e fatture" />
        <MenuItem icon="ti-language" iconBg="#F4F6FA" iconColor="#6B7280" main="Lingua" sub="Italiano · English" />
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
