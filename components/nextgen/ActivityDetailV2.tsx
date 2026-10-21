"use client";

// TRAMA — SCHEDA ATTIVITÀ V2 (14/10/2026, proposta approvata da Fabrizio).
// Presentazione V2 della scheda /activity/[id], scelta da DetailClient quando
// DISCOVER_V2_ENABLED è acceso (mai in anteprima Partner, mai in Legacy).
// Tutta la logica (giorni spot, prezzi, link di prenotazione, stato della
// prenotazione esistente, preferiti) resta in app/activity/[id]/DetailClient.tsx
// e arriva qui già calcolata: questo file disegna soltanto.
//
// Cosa cambia rispetto alla scheda di prima:
//  - in alto foto vera o immagine di ripiego TRAMA (niente emoji gigante);
//  - titolo Poppins + segno TRAMA, una riga sola "centro · zona", età e orari;
//  - "Perché fa per voi" (max 3 motivi) al posto di due file di etichette;
//  - card "Cosa include" con i SOLI servizi disponibili;
//  - card "Settimane e posti", "La giornata tipo", giorni spot nei colori V2;
//  - via voto, numero di recensioni e km: valori inseriti a mano, non reali;
//  - barra in basso: prezzo + "Prenota" blu notte (o lo stato della
//    prenotazione); "Scrivi al centro" come azione secondaria.

import Link from "next/link";
import type { ReactNode } from "react";
import type { Activity, CertificationItem, DayAvailability, Promotion } from "@/lib/types";
import type { BookedDayDecision } from "@/lib/data/activity-days";
import ActivityVisual from "@/components/nextgen/ActivityVisual";
import TramaThread from "@/components/nextgen/TramaThread";
import ContactCenterButton from "@/components/ContactCenterButton";
import { dayPrice } from "@/lib/day-pricing";
import { navigationDestination, placeLine, type ActivityService } from "@/lib/nextgen/activity-detail-v2";
import { longDateIt, shortRangeIt, unavailableCtaLabel, type ActivityDateSummary } from "@/lib/nextgen/parent-ux-fix";

const WEEKDAY_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const WEEKDAY_LONG = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì"];

const CARD = "rounded-2xl border border-trama-line bg-white p-4";
const SECTION_TITLE = "font-poppins text-[17px] font-semibold text-ink";
const CTA = "flex min-h-[48px] items-center justify-center rounded-[12px] bg-trama-primary px-6 text-[15px] font-bold text-white active:bg-trama-primary-press";
const CTA_DISABLED = "flex min-h-[48px] cursor-not-allowed items-center justify-center rounded-[12px] bg-[#B9C0CC] px-5 text-[14px] font-bold text-white";

export interface ExistingBookingSummary {
  id: string;
  canCancelOrModify: boolean;
  partnerDecision: "pending" | "accepted" | "rejected" | "proposed" | "partial";
}

function bookingStateLabel(decision: ExistingBookingSummary["partnerDecision"]): string {
  if (decision === "accepted") return "Prenotazione confermata";
  if (decision === "partial") return "Confermata in parte";
  if (decision === "rejected") return "Prenotazione rifiutata";
  return "Prenotazione in attesa";
}

export default function ActivityDetailV2({
  activity,
  reasons,
  services,
  fav,
  onToggleFav,
  onBack,
  coverImageUrl,
  galleryUrls,
  onOpenImage,
  lightbox,
  activePromotions,
  certifications,
  showDaySelection,
  filterWeekCount,
  onClearWeekFilter,
  noDaysInFilter,
  dayWeekGroups,
  bookedDayDecisions,
  selectedDayDates,
  onToggleDay,
  daysCost,
  meetsMinDays,
  activityAvailable,
  realSpotsLeft,
  existingBooking,
  bookingHref,
  dateSummary = null,
}: {
  activity: Activity;
  reasons: string[];
  services: ActivityService[];
  fav: boolean;
  onToggleFav: () => void;
  onBack: () => void;
  coverImageUrl?: string;
  galleryUrls: string[];
  onOpenImage: (url: string) => void;
  lightbox: ReactNode;
  activePromotions: Promotion[];
  certifications: CertificationItem[];
  showDaySelection: boolean;
  filterWeekCount: number;
  onClearWeekFilter: () => void;
  noDaysInFilter: boolean;
  dayWeekGroups: [string, (DayAvailability | null)[]][];
  bookedDayDecisions: Record<string, BookedDayDecision>;
  selectedDayDates: string[];
  onToggleDay: (day: DayAvailability) => void;
  daysCost: number;
  meetsMinDays: boolean;
  activityAvailable: boolean;
  realSpotsLeft?: number;
  existingBooking: ExistingBookingSummary | null;
  bookingHref: string;
  /** Correzioni dal test UX (21/10/2026, PARENT_UX_FIX_ENABLED): date vere e stato coerente. null = come prima. */
  dateSummary?: ActivityDateSummary | null;
}) {
  const facts = [
    activity.ageRange ? { icon: "ti-users", text: activity.ageRange } : null,
    activity.hours ? { icon: "ti-clock", text: activity.hours } : null,
  ].filter(Boolean) as { icon: string; text: string }[];
  const daysSelected = selectedDayDates.length;
  const spotsText = !activityAvailable
    ? dateSummary
      ? unavailableCtaLabel(dateSummary)
      : "Al momento non disponibile"
    : activity.showExactSpots && realSpotsLeft !== undefined
      ? realSpotsLeft === 1
        ? "Ultimo posto"
        : `Ultimi ${realSpotsLeft} posti`
      : "Posti disponibili";

  return (
    <div className="flex h-full min-h-screen flex-col bg-trama-page sm:min-h-0 sm:flex-1">
      {lightbox}
      <div className="no-scrollbar flex-1 overflow-y-auto pb-6">
        {/* 1. In alto: foto vera o immagine di ripiego TRAMA */}
        <div className="relative">
          {coverImageUrl ? (
            <button type="button" onClick={() => onOpenImage(coverImageUrl)} className="block w-full" aria-label="Apri la foto a schermo intero">
              <ActivityVisual title={activity.name} imageUrl={coverImageUrl} className="h-[220px] w-full" />
            </button>
          ) : (
            <ActivityVisual title={activity.name} className="h-[176px] w-full" />
          )}
          <button
            type="button"
            onClick={onBack}
            aria-label="Indietro"
            className="absolute left-4 top-[calc(12px+env(safe-area-inset-top,0px))] flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[20px] text-ink shadow-[0_1px_4px_rgba(23,42,77,0.15)] active:scale-95"
          >
            <i className="ti ti-arrow-left" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onToggleFav}
            aria-label={fav ? "Togli dai salvati" : "Salva"}
            aria-pressed={fav}
            className="absolute right-4 top-[calc(12px+env(safe-area-inset-top,0px))] flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-trama-navy shadow-[0_1px_4px_rgba(23,42,77,0.15)] active:scale-95"
          >
            <i className={`ti ${fav ? "ti-bookmark-filled text-trama-primary" : "ti-bookmark"} text-[20px]`} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 pt-[18px]">
          {/* 2. Titolo, luogo, età e orari */}
          <header className="flex flex-col gap-2">
            <div className="flex flex-col">
              <h1 className="font-poppins text-[24px] font-semibold leading-tight text-ink">{activity.name}</h1>
              <TramaThread className="mt-1.5" />
            </div>
            <p className="text-[14px] text-ink-2">{placeLine(activity)}</p>
            {/* Correzioni dal test UX (21/10/2026), UX-PARENT-012: dove si
                va davvero. "Apri mappa" con l'indirizzo o le coordinate; se
                l'indirizzo non ha un numero civico lo diciamo. */}
            {dateSummary && (() => {
              const destination = navigationDestination(activity.address, activity.lat, activity.lng);
              const vague = !/\d/.test(activity.address ?? "");
              return (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {destination && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[36px] items-center gap-1 text-[13.5px] font-semibold text-trama-accent-ink"
                    >
                      <i className="ti ti-map-pin text-[15px]" aria-hidden="true" />
                      Apri mappa
                    </a>
                  )}
                  {vague && <span className="text-[12.5px] text-ink-2">Indirizzo esatto da confermare con il centro</span>}
                </div>
              );
            })()}
            {facts.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {facts.map((f) => (
                  <span key={f.text} className="flex items-center gap-1.5 text-[13.5px] text-ink-2">
                    <i className={`ti ${f.icon} text-[15px] text-ink-3`} aria-hidden="true" />
                    {f.text}
                  </span>
                ))}
              </div>
            )}
          </header>

          {galleryUrls.length > 0 && (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {galleryUrls.map((url, i) => (
                <button key={url} type="button" onClick={() => onOpenImage(url)} className="flex-shrink-0" aria-label={`Apri foto ${i + 1} a schermo intero`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage */}
                  <img src={url} alt="" className="h-20 w-28 rounded-[12px] object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* 3. Perché fa per voi */}
          {reasons.length > 0 && (
            <section className={CARD} aria-labelledby="perche-h">
              <h2 id="perche-h" className={SECTION_TITLE}>
                Perché fa per voi
              </h2>
              <ul className="mt-2.5 flex flex-col gap-2">
                {reasons.map((r) => (
                  <li key={r} className="flex items-center gap-2 text-[14px] text-ink">
                    <i className="ti ti-circle-check-filled text-[17px] text-[#1F9A72]" aria-hidden="true" />
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {activePromotions.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 rounded-[12px] bg-trama-accent-soft px-3.5 py-3 text-[13.5px] font-semibold text-trama-accent-ink">
              <i className={`ti ${p.type === "last_minute" ? "ti-bolt" : "ti-discount-2"} text-[17px]`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                {p.label}
                {p.type === "day_discount" && p.dayOfWeek !== undefined && <span className="font-normal"> · ogni {WEEKDAY_LONG[p.dayOfWeek]}</span>}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[12.5px]">-{p.discountPercent}%</span>
            </div>
          ))}

          {/* 4. Descrizione */}
          {activity.description && <p className="text-[14.5px] leading-relaxed text-ink-2">{activity.description}</p>}

          {/* 5. Cosa include: solo ciò che c'è davvero */}
          {services.length > 0 && (
            <section className={CARD} aria-labelledby="include-h">
              <h2 id="include-h" className={SECTION_TITLE}>
                Cosa include
              </h2>
              <ul className="mt-1.5 flex flex-col">
                {services.map((s, i) => (
                  <li key={s.key} className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-[#F0F2F5]" : ""}`}>
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#E6F6F0] text-[#1F9A72]">
                      <i className={`ti ${s.icon} text-[18px]`} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[14.5px] font-semibold text-ink">{s.label}</span>
                      {s.detail && <span className="text-[12.5px] text-ink-2">{s.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {activity.dietaryOptions && activity.dietaryOptions.length > 0 && (
                <p className="mt-2 border-t border-[#F0F2F5] pt-2.5 text-[13px] text-ink-2">
                  <span className="font-semibold text-ink">Diete gestite:</span> {activity.dietaryOptions.join(", ")}
                </p>
              )}
            </section>
          )}

          {/* 6. Settimane e posti */}
          <section className={CARD} aria-labelledby="settimane-h">
            <h2 id="settimane-h" className={SECTION_TITLE}>
              Settimane e posti
            </h2>
            <dl className="mt-1.5 flex flex-col">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[14px] text-ink-2">Prezzo</dt>
                <dd className="text-[14.5px] font-bold text-trama-navy">€{activity.pricePerWeek} a settimana</dd>
              </div>
              {/* Correzioni dal test UX (21/10/2026), UX-PARENT-003: le date
                  vere al posto del testo libero "7 di 8". */}
              {dateSummary && (
                <div data-testid="activity-dates" className="flex flex-col gap-1 border-t border-[#F0F2F5] py-2.5">
                  <dt className="text-[14px] text-ink-2">Date</dt>
                  <dd className="flex flex-col gap-1">
                    {dateSummary.state === "ended" ? (
                      <span className="text-[14.5px] font-semibold text-ink">
                        Edizione conclusa{dateSummary.lastEnd ? ` il ${longDateIt(dateSummary.lastEnd)}` : ""}. Le nuove date non sono ancora pubblicate.
                      </span>
                    ) : dateSummary.state === "no_dates" ? (
                      <span className="text-[14.5px] font-semibold text-ink">Il centro non ha ancora pubblicato le date.</span>
                    ) : (
                      dateSummary.upcoming.map((r) => (
                        <span key={`${r.start}-${r.end}`} className="flex items-center justify-between gap-3 text-[14.5px]">
                          <span className="font-semibold text-ink">{shortRangeIt(r.start, r.end)}</span>
                          <span className={r.full ? "text-ink-3" : "font-semibold text-[#146B4F]"}>{r.full ? "Al completo" : "Posti liberi"}</span>
                        </span>
                      ))
                    )}
                  </dd>
                </div>
              )}
              {!dateSummary && activity.weeksAvailable && (
                <div className="flex items-center justify-between border-t border-[#F0F2F5] py-2.5">
                  <dt className="text-[14px] text-ink-2">Settimane aperte</dt>
                  <dd className="text-[14.5px] font-semibold text-ink">{activity.weeksAvailable}</dd>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-[#F0F2F5] py-2.5">
                <dt className="text-[14px] text-ink-2">Posti</dt>
                <dd
                  className={`text-[14.5px] font-semibold ${
                    !activityAvailable ? "text-ink-3" : activity.showExactSpots && realSpotsLeft !== undefined ? "text-[#B54708]" : "text-[#146B4F]"
                  }`}
                >
                  {spotsText}
                </dd>
              </div>
            </dl>
          </section>

          {/* 7. Giorni spot */}
          {showDaySelection && (
            <section className={CARD} aria-labelledby="giorni-h">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="giorni-h" className={SECTION_TITLE}>
                  Giorni singoli
                </h2>
                {activity.minDaysPerBooking && activity.minDaysPerBooking > 1 && (
                  <span className="text-[12.5px] text-ink-2">Minimo {activity.minDaysPerBooking} giorni</span>
                )}
              </div>
              <p className="mt-1 text-[13.5px] text-ink-2">Scegli solo i giorni che ti servono, invece della settimana intera.</p>
              {filterWeekCount > 0 && (
                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-[12px] bg-trama-primary-soft px-3 py-2 text-[12.5px] text-trama-primary">
                  <span>Solo {filterWeekCount === 1 ? "la settimana scelta" : `le ${filterWeekCount} settimane scelte`}</span>
                  <button type="button" onClick={onClearWeekFilter} className="min-h-[36px] px-1 font-semibold">
                    Vedi tutti
                  </button>
                </div>
              )}
              {noDaysInFilter && (
                <p className="mt-2.5 rounded-[12px] border border-dashed border-[#D8DEE8] p-3 text-center text-[13px] text-ink-2">
                  Nessun giorno aperto {filterWeekCount === 1 ? "in questa settimana" : "in queste settimane"}.
                </p>
              )}
              <div className="mt-3 flex flex-col gap-1.5">
                {dayWeekGroups.map(([monday, slots]) => (
                  <div key={monday} className="grid grid-cols-5 gap-1.5">
                    {slots.map((day, weekday) => {
                      if (!day) {
                        return (
                          <div
                            key={weekday}
                            className="flex min-h-[72px] flex-col items-center justify-center rounded-[10px] border border-dashed border-[#E3E6EC] text-[11px] text-ink-3"
                          >
                            {WEEKDAY_SHORT[weekday]}
                            <span className="mt-1">—</span>
                          </div>
                        );
                      }
                      const decision = bookedDayDecisions[day.date];
                      const booked = decision === "accepted" || decision === "pending" || decision === "waitlisted";
                      const full = day.spotsLeft <= 0 || !day.singleDayBookable;
                      const selected = selectedDayDates.includes(day.date);
                      const date = new Date(day.date + "T00:00:00Z");
                      const label = booked
                        ? decision === "accepted"
                          ? "Prenotato"
                          : decision === "pending"
                            ? "In attesa"
                            : "In lista"
                        : full
                          ? "Pieno"
                          : `€${dayPrice(day, activity.pricePerWeek)}`;
                      return (
                        <button
                          key={day.date}
                          type="button"
                          disabled={full || booked}
                          aria-pressed={selected}
                          onClick={() => onToggleDay(day)}
                          className={`flex min-h-[72px] flex-col items-center justify-center rounded-[10px] border px-0.5 text-center ${
                            booked
                              ? decision === "accepted"
                                ? "border-[#2DBA8C] bg-[#E6F6F0] text-[#146B4F]"
                                : "border-[#F6B84B] bg-[#FFF8EB] text-[#7A4500]"
                              : full
                                ? "cursor-not-allowed border-[#E3E6EC] bg-[#F7F8FA] text-ink-3"
                                : selected
                                  ? "border-trama-primary bg-trama-primary text-white"
                                  : "border-[#E3E6EC] bg-white text-ink"
                          }`}
                        >
                          <span className="text-[10.5px] font-semibold uppercase opacity-80">{WEEKDAY_SHORT[day.weekday]}</span>
                          <span className="text-[14px] font-bold">{date.getUTCDate()}</span>
                          <span className="text-[10.5px] font-semibold">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              {daysSelected > 0 && !meetsMinDays && activity.minDaysPerBooking && (
                <p className="mt-2.5 text-[12.5px] font-medium text-[#B54708]">Servono almeno {activity.minDaysPerBooking} giorni per prenotare.</p>
              )}
            </section>
          )}

          {/* 8. La giornata tipo */}
          {activity.schedule.length > 0 && (
            <section className={CARD} aria-labelledby="giornata-h">
              <h2 id="giornata-h" className={SECTION_TITLE}>
                La giornata tipo
              </h2>
              <ol className="mt-2 flex flex-col">
                {activity.schedule.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 py-1.5">
                    <span className="w-12 flex-shrink-0 text-[13.5px] font-bold tabular-nums text-trama-primary">{s.time}</span>
                    <span className="text-[14px] text-ink-2">{s.label}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {certifications.length > 0 && (
            <section className={CARD} aria-labelledby="cert-h">
              <h2 id="cert-h" className={SECTION_TITLE}>
                Certificazioni
              </h2>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {certifications.map((c) => (
                  <span key={c.id} className="flex items-center gap-1.5 rounded-full bg-trama-accent-soft px-3 py-1.5 text-[12.5px] font-semibold text-trama-accent-ink">
                    <i className="ti ti-certificate text-[14px]" aria-hidden="true" />
                    {c.label}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* 9. Scrivi al centro: azione secondaria */}
          <section className="flex flex-col gap-2">
            <p className="text-[13.5px] text-ink-2">Hai una domanda su orari, pranzo o iscrizione?</p>
            <ContactCenterButton activityDbId={activity.dbId} />
          </section>
        </div>
      </div>

      {/* 10. Barra in basso: prezzo e azione */}
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-trama-line bg-white px-5 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3">
        <div className="min-w-0">
          <div className="text-[20px] font-bold text-trama-navy">€{daysSelected > 0 ? daysCost : activity.pricePerWeek}</div>
          <div className="text-[12px] text-ink-2">{daysSelected > 0 ? (daysSelected === 1 ? "1 giorno" : `${daysSelected} giorni`) : "a settimana"}</div>
        </div>
        {daysSelected > 0 && meetsMinDays ? (
          <Link href={bookingHref} data-spotlight="book_activity" className={CTA}>
            Prenota
          </Link>
        ) : existingBooking ? (
          existingBooking.canCancelOrModify ? (
            <Link href={`/prenotazioni/${existingBooking.id}/modifica`} className={CTA}>
              Modifica prenotazione
            </Link>
          ) : (
            <div className="text-right">
              <div className="text-[14px] font-bold text-ink">{bookingStateLabel(existingBooking.partnerDecision)}</div>
              <div className="text-[12px] text-ink-2">Per modifiche scrivi al centro</div>
            </div>
          )
        ) : daysSelected === 0 && !activityAvailable ? (
          <button type="button" disabled className={CTA_DISABLED}>
            {dateSummary ? unavailableCtaLabel(dateSummary) : "Non disponibile ora"}
          </button>
        ) : daysSelected > 0 && !meetsMinDays ? (
          <button type="button" disabled data-spotlight="book_activity" className={CTA_DISABLED}>
            Prenota
          </button>
        ) : (
          <Link href={bookingHref} data-spotlight="book_activity" className={CTA}>
            Prenota
          </Link>
        )}
      </div>
    </div>
  );
}
