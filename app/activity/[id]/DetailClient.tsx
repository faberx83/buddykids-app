"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Activity, Promotion } from "@/lib/types";
import { badgeClasses } from "@/lib/colors";

const weekdayLabels = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì"];

export default function DetailClient({
  activity,
  promotions,
}: {
  activity: Activity;
  promotions: Promotion[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Settimana passata da Cerca (a sua volta arrivata dal "Riempi" del
  // Planner) — la portiamo avanti nel link di prenotazione cosi arriva
  // preselezionata invece di doverla ricercare da capo.
  const weekParam = searchParams.get("week");
  // Bambino selezionato in Home/Cerca (famiglie con più figli) — passato
  // avanti anche da qui, cosi in Prenotazione risulta già spuntato quello
  // giusto invece del primo della lista.
  const kidParam = searchParams.get("kid");
  const bookingHref = (() => {
    const params = new URLSearchParams();
    if (weekParam) params.set("week", weekParam);
    if (kidParam) params.set("kid", kidParam);
    const query = params.toString();
    return query ? `/booking/${activity.id}?${query}` : `/booking/${activity.id}`;
  })();
  const [fav, setFav] = useState(true);
  const activePromotions = promotions.filter((p) => p.active);

  return (
    <div className="flex h-full min-h-screen flex-col sm:min-h-0 sm:flex-1">
      <div
        className="relative flex h-[230px] flex-shrink-0 items-center justify-center bg-cover bg-center"
        style={
          activity.coverImageUrl
            ? { backgroundImage: `url(${activity.coverImageUrl})` }
            : { background: activity.imgGradient }
        }
      >
        {!activity.coverImageUrl && <span className="relative z-[1] text-8xl">{activity.emoji}</span>}
        <button
          onClick={() => router.back()}
          className="absolute left-[18px] top-[18px] z-10 flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/90 text-lg text-ink backdrop-blur-sm transition-transform hover:scale-110"
        >
          <i className="ti ti-arrow-left" />
        </button>
        <button
          onClick={() => setFav((f) => !f)}
          className="absolute right-[18px] top-[18px] z-10 flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/90 text-lg text-orange backdrop-blur-sm transition-transform hover:scale-110"
        >
          <i className={fav ? "ti ti-heart-filled" : "ti ti-heart"} />
        </button>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-[18px]">
        <div className="mb-1 flex items-start justify-between">
          <div>
            <div className="text-xl font-bold text-ink">{activity.name}</div>
            <div className="mb-2.5 text-[13px] font-medium text-ink-2">
              {activity.center} — {activity.address}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1 rounded-md bg-yellow-light px-2.5 py-1.5">
            <i className="ti ti-star-filled text-sm text-yellow" />
            <span className="text-sm font-bold text-ink">{activity.rating}</span>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2.5">
          <span className="flex items-center gap-1 text-xs text-ink-2">
            <i className="ti ti-map-pin text-sm text-ink-3" />
            {activity.distanceKm} km · {activity.address}
          </span>
          <span className="flex items-center gap-1 text-xs text-ink-2">
            <i className="ti ti-users text-sm text-ink-3" />
            {activity.ageRange}
          </span>
          {activity.hours && (
            <span className="flex items-center gap-1 text-xs text-ink-2">
              <i className="ti ti-clock text-sm text-ink-3" />
              {activity.hours}
            </span>
          )}
        </div>

        {activity.galleryUrls && activity.galleryUrls.length > 0 && (
          <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
            {activity.galleryUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage, non ottimizzabile senza config extra
              <img
                key={url}
                src={url}
                alt=""
                className="h-20 w-28 flex-shrink-0 rounded-md object-cover"
              />
            ))}
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-1.5">
          {activity.badges.map((b) => (
            <div
              key={b.label}
              className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[11px] font-semibold ${badgeClasses[b.color]}`}
            >
              <i className={`ti ${b.icon} text-[13px]`} />
              {b.label}
            </div>
          ))}
        </div>

        {activePromotions.length > 0 && (
          <div className="mb-4 space-y-2">
            {activePromotions.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2.5 rounded-md bg-purple-light px-3 py-2.5 text-xs font-semibold text-[#6b58d4]"
              >
                <span>{p.type === "last_minute" ? "⚡" : "🏷️"}</span>
                <span>
                  {p.label}
                  {p.type === "day_discount" && p.dayOfWeek !== undefined && (
                    <span className="font-normal"> · ogni {weekdayLabels[p.dayOfWeek]}</span>
                  )}
                </span>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5">
                  -{p.discountPercent}%
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mb-4 text-[13px] leading-[1.75] text-ink-2">
          {activity.description}
        </div>
        <div className="my-3 h-px bg-[#F0F2F5]" />

        <div className="mb-2.5 text-sm font-bold text-ink">Programma della giornata</div>
        <div className="mb-3.5 rounded-md bg-bg p-3">
          {activity.schedule.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5 py-1.5">
              <div
                className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              <div className="min-w-[48px] text-xs font-semibold text-ink">{s.time}</div>
              <div className="text-xs text-ink-2">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="my-3 h-px bg-[#F0F2F5]" />

        <InfoRow icon="ti-coin-euro" label="Costo settimana" value={`€${activity.pricePerWeek}`} valueColor="text-sky" />
        <InfoRow icon="ti-calendar" label="Settimane disponibili" value={activity.weeksAvailable} />
        <InfoRow
          icon="ti-users"
          label="Posti rimasti"
          value={
            activity.showExactSpots && activity.spotsLeft !== undefined
              ? `⚠️ Solo ${activity.spotsLeft}!`
              : "Posti disponibili"
          }
          valueColor={activity.showExactSpots && activity.spotsLeft !== undefined ? "text-orange" : undefined}
        />
        <div className="my-3 h-px bg-[#F0F2F5]" />

        <div className="mb-2.5 text-sm font-bold text-ink">Servizi disponibili</div>
        <div className="mb-3.5 flex flex-wrap gap-2">
          <ServiceTag
            icon="ti-sunrise"
            label="Pre-scuola"
            available={Boolean(activity.preService?.available)}
            detail={
              activity.preService?.available
                ? `dalle ${activity.preService.time}${
                    activity.preService.priceExtra > 0 ? ` · +€${activity.preService.priceExtra}/sett` : " · incluso"
                  }`
                : undefined
            }
          />
          <ServiceTag
            icon="ti-sunset-2"
            label="Post-scuola"
            available={Boolean(activity.postService?.available)}
            detail={
              activity.postService?.available
                ? `fino alle ${activity.postService.time}${
                    activity.postService.priceExtra > 0 ? ` · +€${activity.postService.priceExtra}/sett` : " · incluso"
                  }`
                : undefined
            }
          />
          <ServiceTag
            icon="ti-tools-kitchen-2"
            label="Pranzo"
            available={activity.mealOption === "included" || activity.mealOption === "packed"}
            detail={
              activity.mealOption === "included"
                ? "incluso"
                : activity.mealOption === "packed"
                ? "al sacco"
                : undefined
            }
          />
          <ServiceTag icon="ti-cup" label="Bar nel centro" available={Boolean(activity.centerHasBar)} />
          <ServiceTag
            icon="ti-bus"
            label="Servizio navetta"
            available={activity.shuttlePrice > 0}
            detail={activity.shuttlePrice > 0 ? `+€${activity.shuttlePrice}/sett` : undefined}
          />
        </div>
        <div className="my-3 h-px bg-[#F0F2F5]" />

        <div className="mb-2.5 text-sm font-bold text-ink">
          Recensioni ({activity.reviewsCount})
        </div>
        {activity.reviews.map((r, i) => (
          <div key={i} className="mb-2 rounded-md bg-bg p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: r.color, color: "#2a8dc4" }}
              >
                {r.initials}
              </div>
              <span className="text-[13px] font-semibold text-ink">{r.name}</span>
              <div className="ml-auto text-[13px] text-yellow">★★★★★</div>
            </div>
            <div className="text-xs leading-[1.65] text-ink-2">{r.text}</div>
          </div>
        ))}
        <div className="h-2.5" />
      </div>

      <div className="flex flex-shrink-0 items-center justify-between border-t border-[#F0F2F5] bg-white px-5 py-3.5">
        <div>
          <div className="text-xl font-bold text-ink">€{activity.pricePerWeek}</div>
          <div className="text-[11px] text-ink-2">per settimana</div>
        </div>
        <Link
          href={bookingHref}
          className="rounded-lg bg-sky px-7 py-3.5 text-[15px] font-bold text-white transition-all hover:scale-[0.97] hover:bg-[#3A9FDC]"
        >
          Prenota ora
        </Link>
      </div>
    </div>
  );
}

function ServiceTag({
  icon,
  label,
  available,
  detail,
}: {
  icon: string;
  label: string;
  available: boolean;
  detail?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${
        available ? "bg-green-light text-green" : "bg-bg text-ink-3"
      }`}
    >
      <i className={`ti ${available ? icon : "ti-x"} text-[13px]`} />
      {label}
      {available && detail && <span className="font-normal">· {detail}</span>}
      {!available && <span className="font-normal">non disponibile</span>}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-1.5 text-[13px] text-ink-2">
        <i className={`ti ${icon} text-base text-ink-3`} />
        {label}
      </div>
      <div className={`text-[13px] font-semibold ${valueColor ?? "text-ink"}`}>{value}</div>
    </div>
  );
}
