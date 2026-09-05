"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, CertificationItem, DayAvailability, Promotion } from "@/lib/types";
// "import type" (non un import valore): lib/data/activity-days.ts è
// server-only (createClient di lib/supabase/server) — un import normale
// trascinerebbe quel modulo nel bundle client. Il tipo viene eraso a
// compile-time, quindi resta sicuro anche da un componente "use client".
import type { BookedDayDecision } from "@/lib/data/activity-days";
import { badgeClasses } from "@/lib/colors";
import ImageLightbox from "@/components/ImageLightbox";
import ContactCenterButton from "@/components/ContactCenterButton";
import { toggleFavoriteAction } from "@/app/actions/favorites";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { calculateDayBookingCost, dayPrice, meetsMinDaysRequirement } from "@/lib/day-pricing";

const weekdayLabels = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì"];
const weekdayShort = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export default function DetailClient({
  activity,
  promotions,
  initialFavorite,
  certifications = [],
  days = [],
  bookedDayDecisions = {},
  nextgen = false,
  existingBooking = null,
  activityAvailable = true,
  realSpotsLeft = undefined,
}: {
  activity: Activity;
  promotions: Promotion[];
  // Prima era sempre useState(true) (mai persistito, vedi
  // FUNCTIONAL-TC-026) — ora arriva dal database (lib/data/favorites.ts).
  initialFavorite: boolean;
  // Solo quelle già approvate da un Admin piattaforma (vedi
  // lib/data/certifications.ts#getApprovedCertificationsForActivity) —
  // richiesta di Fabrizio: badge per certificazioni del servizio esposto
  // (es. "Istruttori certificati FISE per equitazione").
  certifications?: CertificationItem[];
  // TRAMA ONE Build Sprint 3 — "Giorni spot": disponibilità giorno-per-
  // giorno, già filtrata a monte (app/activity/[id]/page.tsx la valorizza
  // solo quando activity.bookingMode !== "week_only"). Vuoto per ogni
  // attività a sola settimana intera — nessun cambio di comportamento lì.
  days?: DayAvailability[];
  // Segnalazione 25/08/2026 (Fabrizio): i giorni già prenotati da questo
  // genitore per questa attività (qualunque bambino) devono distinguersi
  // visivamente dai giorni ancora liberi — vedi
  // lib/data/activity-days.ts#getBookedDayDecisionsForActivity.
  // AGGIORNAMENTO 02/09/2026 ("se ho 1 giornata accettata e 1 rifiutata...
  // cosa capisco?"): non basta più sapere CHE il giorno è prenotato, serve
  // anche COME il centro ha risposto — data ISO (yyyy-mm-dd) → decisione.
  // Vuoto per ogni attività a sola settimana intera.
  bookedDayDecisions?: Record<string, BookedDayDecision>;
  // nextgen (01/09/2026, segnalazione Fabrizio "grafica legacy" nel
  // dettaglio attività): questa route è condivisa da Legacy e NextGen
  // (nessuna /nextgen/activity/... dedicata, vedi
  // app/activity/[id]/page.tsx) — il flag arriva già risolto da lì. Legacy
  // (default false) resta invariato.
  nextgen?: boolean;
  // PLANNER BETA v1.1 (Wave 4, punto 21-23) — segnalazione: la CTA sticky
  // "Prenota ora" restava visibile anche quando il genitore aveva GIÀ una
  // prenotazione attiva per questa attività (es. arrivando da Home →
  // "Prossimo appuntamento" → questa scheda), "semanticamente errato".
  // Risolto server-side in app/activity/[id]/page.tsx tramite
  // getMyBookingsForParent() — STESSA fonte di verità già usata da "Le mie
  // prenotazioni"/Planner, nessuna nuova interpretazione dello stato
  // prenotazione. null = nessuna prenotazione attiva per questa attività
  // (comportamento invariato, CTA acquisitiva "Prenota ora").
  existingBooking?: {
    id: string;
    status: "pending" | "confirmed" | "cancelled";
    canCancelOrModify: boolean;
    // FIX (TRAMA FINAL HARDENING CLOSURE, 04/09/2026) — vedi commento su
    // app/activity/[id]/page.tsx: la label sotto ora si basa su questo
    // campo (già calcolato da getMyBookingsForParent(), stesso valore
    // mostrato in "Le mie prenotazioni"/Planner), non più sul solo status
    // di pagamento.
    partnerDecision: "pending" | "accepted" | "rejected" | "proposed" | "partial";
  } | null;
  // FIX (TRAMA FINAL HARDENING §1/§3, segnalazione Fabrizio 04/09/2026 —
  // walkthrough live: banner "Solo 0 posti!" ma CTA "Prenota ora" ancora
  // attiva). Root cause: questa scheda usava SOLO il campo editoriale
  // activity.spotsLeft/showExactSpots (digitato a mano dal gestore in
  // ActivityEditForm — "Posti rimasti (in evidenza)"), mai collegato alla
  // disponibilità reale activity_weeks/activity_days che invece governa
  // DAVVERO se una prenotazione è possibile (stessa fonte del wizard di
  // prenotazione, vedi getWeeksForActivity in app/activity/[id]/page.tsx).
  // Ora arriva qui il segnale CANONICO calcolato server-side: nessuna
  // seconda fonte di verità mantenuta "solo per compatibilità UI".
  // undefined = non calcolato (non dovrebbe succedere dalla page.tsx reale,
  // ma teniamo un default sicuro "true" per non introdurre falsi negativi).
  activityAvailable?: boolean;
  // Posti liberi REALI (minimo tra le settimane offerte non esaurite) — da
  // mostrare al posto del vecchio activity.spotsLeft editoriale. undefined
  // se non calcolabile (es. attività a soli giorni spot, o nessuna
  // settimana offerta): in quel caso si mostra solo "Posti disponibili"
  // generico, mai un numero potenzialmente falso.
  realSpotsLeft?: number;
}) {
  const accentBg = nextgen ? "bg-trama-violet" : "bg-sky";
  const accentText = nextgen ? "text-trama-violet" : "text-sky";
  const accentBorder = nextgen ? "border-trama-violet" : "border-sky";
  const accentLight = nextgen ? "bg-trama-lilac/20" : "bg-sky-light";
  const accentHoverBorder = nextgen ? "hover:border-trama-violet" : "hover:border-sky";
  const accentHoverBg = nextgen ? "hover:bg-[#594F9E]" : "hover:bg-[#3A9FDC]";
  const titleCls = nextgen ? "font-poppins text-[13px] font-bold text-ink" : "text-sm font-bold text-ink";
  const router = useRouter();
  const searchParams = useSearchParams();
  // Settimana passata da Cerca (a sua volta arrivata dal "Riempi" del
  // Planner) — la portiamo avanti nel link di prenotazione cosi arriva
  // preselezionata invece di doverla ricercare da capo.
  const weekParam = searchParams.get("week");
  // BUG CORRETTO 07/08/2026 (segnalato da Fabrizio: da "Riempi" su una
  // settimana del Planner, il filtro veniva applicato correttamente nella
  // lista di Scopri ma qui, nel dettaglio del singolo centro, i "giorni
  // spot" mostrati erano "a caso e non contestualizzati al filtro" — questa
  // pagina leggeva ?week= ma non lo usava mai per filtrare `days`, mostrava
  // sempre tutti i giorni aperti dell'intera stagione). "?weeks=" (plurale,
  // da ActivityCard.tsx quando Scopri ha più settimane selezionate) o
  // "?week=" singolare (link più vecchi) — entrambi supportati.
  const weeksParam = searchParams.get("weeks");
  const filterWeekStarts = useMemo(() => {
    if (weeksParam) return weeksParam.split(",").filter(Boolean);
    return weekParam ? [weekParam] : [];
  }, [weeksParam, weekParam]);
  // Ogni settimana stagionale è lun-ven (5 giorni, vedi lib/season-weeks.ts):
  // un giorno è "nella settimana" se la sua data cade tra lo start e start+4.
  const filterWeekRanges = useMemo(
    () =>
      filterWeekStarts.map((start) => {
        const startDate = new Date(start + "T00:00:00Z");
        const end = new Date(startDate);
        end.setUTCDate(startDate.getUTCDate() + 4);
        return { start, end: end.toISOString().slice(0, 10) };
      }),
    [filterWeekStarts]
  );
  // Bambino selezionato in Home/Cerca (famiglie con più figli) — passato
  // avanti anche da qui, cosi in Prenotazione risulta già spuntato quello
  // giusto invece del primo della lista.
  const kidParam = searchParams.get("kid");
  // TRAMA ONE Build Sprint 3 — "context object" leggero: source/cid arrivano
  // dalla card di Ricerca (Legacy o NextGen, vedi ActivityCardHorizontal.tsx
  // / ActivityCard.tsx) e proseguono verso la Prenotazione cosi il log a
  // valle puo essere correlato allo stesso percorso ricerca→dettaglio→
  // richiesta (vedi lib/telemetry/correlation.ts). Facoltativi: se assenti,
  // comportamento invariato.
  const sourceParam = searchParams.get("source");
  const cidParam = searchParams.get("cid");
  // TRAMA ONE Build Sprint 3 — "Giorni spot": selezione giorni singoli,
  // attiva solo quando ci sono giorni configurati dal Gestore e l'attività
  // non è a sola settimana intera. Ordinati per data, solo quelli aperti.
  //
  // Segnalazione 25/08/2026 (Fabrizio): il calendario mostrava ancora giorni
  // già passati rispetto a OGGI (data di sistema) come normalmente
  // selezionabili — un giorno concluso non ha più senso ne' da prenotare ne'
  // da mostrare qui, stesso principio già applicato alle settimane in
  // lib/data/weeks.ts#dropPastWeeks (task #243) ma mai a questo elenco.
  // Confronto sulla data ISO COMPLETA (non solo mese-giorno come
  // dropPastWeeks): a differenza della griglia stagionale convenzionale,
  // activity_days ha righe con un anno reale scritto dal Gestore, quindi
  // qui il confronto sull'anno intero è corretto e non rischia la stessa
  // regressione anti-seed di dropPastWeeks.
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const allBookableDays = useMemo(
    () =>
      days
        .filter((d) => d.isOpen && d.date >= todayIso)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [days, todayIso]
  );
  // Giorni già impegnati su una richiesta ESISTENTE (accettata/in attesa/in
  // lista d'attesa) — "rifiutato" escluso di proposito: quel giorno è
  // tornato libero e va restare selezionabile per una nuova richiesta (vedi
  // "wasRejected" più sotto). Usato per bloccare il toggle, non solo per lo
  // stile del pulsante: prima il click passava comunque, aggiungendo alla
  // selezione un giorno già coperto da un'altra richiesta.
  const lockedDaySet = useMemo(
    () =>
      new Set(
        Object.entries(bookedDayDecisions)
          .filter(([, decision]) => decision !== "rejected")
          .map(([date]) => date)
      ),
    [bookedDayDecisions]
  );
  // Se si arriva da "Riempi"/Scopri con una o più settimane selezionate,
  // mostra solo i "giorni spot" che cadono in quelle settimane invece di
  // tutta la stagione — questo è il fix del bug segnalato.
  const bookableDays = useMemo(() => {
    if (filterWeekRanges.length === 0) return allBookableDays;
    return allBookableDays.filter((d) =>
      filterWeekRanges.some((r) => d.date >= r.start && d.date <= r.end)
    );
  }, [allBookableDays, filterWeekRanges]);
  const showDaySelection = activity.bookingMode !== "week_only" && allBookableDays.length > 0;
  // Segnalazione 25/08/2026 (Fabrizio): "voglio vedere i giorni corretti
  // sulla stessa linea da lun a ven" — prima i giorni erano un flex-wrap
  // senza alcun allineamento a colonna, per cui il "lunedì" di una settimana
  // poteva non trovarsi mai sotto il "lunedì" di un'altra. Raggruppati qui
  // per settimana (lunedì della settimana di ciascun giorno) e resi in una
  // griglia fissa a 5 colonne (Lun..Ven): una cella vuota, non un giorno
  // "chiuso" travestito, per un giorno feriale senza alcuna riga
  // activity_days configurata dal Gestore in quella settimana.
  function mondayOf(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00Z");
    const jsDay = d.getUTCDay(); // 0=dom..6=sab
    const diff = jsDay === 0 ? -6 : 1 - jsDay;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().slice(0, 10);
  }
  const dayWeekGroups = useMemo(() => {
    const byMonday = new Map<string, (DayAvailability | null)[]>();
    for (const day of bookableDays) {
      if (day.weekday > 4) continue; // solo lun-ven in questa griglia (sab/dom non fanno parte della settimana Giorni spot)
      const monday = mondayOf(day.date);
      if (!byMonday.has(monday)) byMonday.set(monday, [null, null, null, null, null]);
      byMonday.get(monday)![day.weekday] = day;
    }
    return [...byMonday.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [bookableDays]);
  const [selectedDayDates, setSelectedDayDates] = useState<string[]>([]);
  const toggleDay = (day: DayAvailability) => {
    if (!day.singleDayBookable || day.spotsLeft <= 0) return;
    if (lockedDaySet.has(day.date)) return;
    setSelectedDayDates((prev) =>
      prev.includes(day.date) ? prev.filter((d) => d !== day.date) : [...prev, day.date]
    );
  };
  const daysCost = useMemo(
    () => calculateDayBookingCost(bookableDays, selectedDayDates, activity.pricePerWeek),
    [bookableDays, selectedDayDates, activity.pricePerWeek]
  );
  const meetsMinDays = meetsMinDaysRequirement(selectedDayDates.length, activity.minDaysPerBooking);
  // Se il genitore ha scelto almeno un giorno, prevale sulla settimana
  // (bookingHref porta le date scelte, così Prenotazione parte già da lì) —
  // altrimenti comportamento invariato (solo ?week=/?kid=).
  const bookingHref = (() => {
    const params = new URLSearchParams();
    // "weeks" (plurale) se Scopri ne ha selezionate più di una, altrimenti
    // "week" singolare (invariato per i link più vecchi/altri punti di
    // ingresso che passano solo quello) — vedi BookingClient.tsx che ora
    // legge entrambi.
    if (filterWeekStarts.length > 1) params.set("weeks", filterWeekStarts.join(","));
    else if (weekParam) params.set("week", weekParam);
    if (kidParam) params.set("kid", kidParam);
    if (selectedDayDates.length > 0) params.set("days", [...selectedDayDates].sort().join(","));
    if (sourceParam) params.set("source", sourceParam);
    if (cidParam) params.set("cid", cidParam);
    const query = params.toString();
    return query ? `/booking/${activity.id}?${query}` : `/booking/${activity.id}`;
  })();
  const [fav, setFav] = useState(initialFavorite);
  const activePromotions = promotions.filter((p) => p.active);
  // Copertina + galleria in un unico carosello (ImageLightbox) — prima erano
  // semplici <img> senza onClick, restavano "solo anteprima".
  const carouselImages = [
    ...(activity.coverImageUrl ? [activity.coverImageUrl] : []),
    ...(activity.galleryUrls ?? []),
  ];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <div className="flex h-full min-h-screen flex-col sm:min-h-0 sm:flex-1">
      <div
        className="relative flex h-[230px] flex-shrink-0 items-center justify-center bg-cover bg-center"
        style={
          activity.coverImageUrl
            ? { backgroundImage: `url(${activity.coverImageUrl})` }
            : { background: activity.imgGradient }
        }
        onClick={() => activity.coverImageUrl && setLightboxIndex(0)}
        role={activity.coverImageUrl ? "button" : undefined}
        aria-label={activity.coverImageUrl ? "Apri la copertina a schermo intero" : undefined}
      >
        {!activity.coverImageUrl && <span className="relative z-[1] text-8xl">{activity.emoji}</span>}
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.back();
          }}
          aria-label="Indietro"
          className="absolute left-[18px] top-[18px] z-10 flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/90 text-lg text-ink backdrop-blur-sm transition-transform hover:scale-110"
        >
          <i className="ti ti-arrow-left" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const next = !fav;
            setFav(next); // aggiornamento ottimistico
            if (activity.dbId && isSupabaseConfigured) {
              toggleFavoriteAction(activity.dbId, next).then((result) => {
                if (result.error) setFav(!next); // rollback se la scrittura fallisce
              });
            }
          }}
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

        <div className="mb-3">
          <ContactCenterButton activityDbId={activity.dbId} />
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
            {activity.galleryUrls.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setLightboxIndex(carouselImages.indexOf(url))}
                className="flex-shrink-0"
                aria-label={`Apri foto ${i + 1} a schermo intero`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage, non ottimizzabile senza config extra */}
                <img src={url} alt="" className="h-20 w-28 rounded-md object-cover" />
              </button>
            ))}
          </div>
        )}

        {lightboxIndex !== null && (
          <ImageLightbox
            images={carouselImages}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}

        {/* Segnalazione di Fabrizio: i tag scelti nell'editor (Sport, Natura,
            Lingue...) non comparivano MAI qui — questa sezione non esisteva
            affatto (solo i "badges" free-form sotto erano renderizzati).
            Stesso colore hex del tag reale (vedi lib/data/activities.ts). */}
        {activity.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {activity.tags.map((tag) => (
              <span
                key={tag.label}
                style={tag.bg ? { backgroundColor: tag.bg } : undefined}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  tag.bg ? "text-ink" : badgeClasses[tag.color!]
                }`}
              >
                {tag.label}
              </span>
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

        <div className={`mb-2.5 ${titleCls}`}>Programma della giornata</div>
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

        {/* TRAMA ONE Build Sprint 3 — "Giorni spot": selezione di singoli
            giorni invece della settimana intera, solo per attività dove il
            Gestore l'ha configurata (bookingMode "day_only"/"mixed" +
            almeno un activity_day aperto). Comportamento invariato per
            tutte le altre attività: questa sezione semplicemente non
            esiste per loro. */}
        {showDaySelection && (
          <>
            <div className="mb-1 flex items-center justify-between">
              <div className={titleCls}>Giorni spot</div>
              {activity.minDaysPerBooking && activity.minDaysPerBooking > 1 && (
                <span className="text-[11px] font-medium text-ink-2">
                  Minimo {activity.minDaysPerBooking} giorni
                </span>
              )}
            </div>
            <div className="mb-2.5 text-[13px] text-ink-2">
              Scegli solo i giorni che ti servono, invece dell&apos;intera settimana
            </div>
            {filterWeekRanges.length > 0 && (
              <div className={`mb-2.5 flex items-center justify-between gap-2 rounded-md ${accentLight} px-3 py-2 text-[11px] font-medium text-ink`}>
                <span>
                  <i className={`ti ti-filter mr-1 text-sm ${accentText}`} />
                  Mostro solo i giorni di {filterWeekRanges.length === 1 ? "questa settimana" : `queste ${filterWeekRanges.length} settimane`}{" "}
                  (dal Planner/Scopri)
                </span>
                <button
                  type="button"
                  onClick={() => router.replace(`/activity/${activity.id}`)}
                  className={`flex-shrink-0 whitespace-nowrap font-semibold ${accentText} active:bg-black/[0.04]`}
                >
                  Vedi tutti
                </button>
              </div>
            )}
            {filterWeekRanges.length > 0 && bookableDays.length === 0 && (
              <p className="mb-2.5 rounded-md border border-dashed border-[#D8DEE8] bg-white p-3 text-center text-[12.5px] text-ink-2">
                Nessun giorno spot aperto in {filterWeekRanges.length === 1 ? "questa settimana" : "queste settimane"}.
              </p>
            )}
            <div className="mb-2 flex flex-col gap-2">
              {dayWeekGroups.map(([monday, slots]) => (
                <div key={monday} className="grid grid-cols-5 gap-1.5">
                  {slots.map((day, weekday) => {
                    if (!day) {
                      // Nessuna riga activity_days per questo giorno feriale di
                      // questa settimana — cella vuota "non configurata", non un
                      // giorno chiuso: la settimana resta comunque allineata a
                      // 5 colonne (Lun..Ven) invece di scorrere le card in fila.
                      return (
                        <div
                          key={weekday}
                          className="flex min-h-[76px] flex-col items-center justify-center rounded-md border border-dashed border-[#E8EBF0] px-1 py-2 text-center text-[10px] text-ink-3"
                        >
                          {weekdayShort[weekday]}
                          <span className="mt-1">—</span>
                        </div>
                      );
                    }
                    const soldOut = day.spotsLeft <= 0 || !day.singleDayBookable;
                    // AGGIORNAMENTO 02/09/2026 (segnalazione Fabrizio: "se ho 1
                    // giornata accettata e 1 rifiutata... cosa capisco?") — un
                    // giorno "già prenotato" non è più un blocco unico: la
                    // decisione del centro (accettato/in attesa/rifiutato/
                    // lista d'attesa) determina sia il badge sia se il giorno
                    // resta bloccato o torna selezionabile. "Rifiutato" non è
                    // trattato come "prenotato" — il centro l'ha liberato,
                    // quindi torna nel flusso normale (selezionabile se non
                    // pieno), con solo un'etichetta in più per lo storico.
                    const dayDecision = bookedDayDecisions[day.date];
                    const alreadyBooked = dayDecision === "accepted" || dayDecision === "pending" || dayDecision === "waitlisted";
                    const wasRejected = dayDecision === "rejected";
                    const selected = selectedDayDates.includes(day.date);
                    const price = dayPrice(day, activity.pricePerWeek);
                    const dateObj = new Date(day.date + "T00:00:00Z");
                    const dayNum = dateObj.getUTCDate();
                    const monthShort = dateObj.toLocaleDateString("it-IT", { month: "short", timeZone: "UTC" });
                    const bookedStyle: Record<string, string> = {
                      accepted: "border-green bg-green-light text-ink",
                      pending: "border-trama-orange bg-orange-light text-ink",
                      waitlisted: "border-sky bg-sky-light text-ink",
                    };
                    const bookedBadge: Record<string, { icon: string; label: string; cls: string }> = {
                      accepted: { icon: "ti-circle-check", label: "Prenotato", cls: "text-green" },
                      pending: { icon: "ti-clock", label: "In attesa", cls: "text-trama-orange" },
                      waitlisted: { icon: "ti-hourglass-high", label: "Lista d'attesa", cls: "text-sky" },
                    };
                    return (
                      <button
                        key={day.date}
                        type="button"
                        disabled={soldOut || alreadyBooked}
                        onClick={() => toggleDay(day)}
                        className={`relative flex min-h-[76px] flex-col items-center justify-center rounded-md border-[1.5px] px-1 py-2 text-center transition-colors ${
                          alreadyBooked
                            ? bookedStyle[dayDecision as string]
                            : soldOut
                            ? "cursor-not-allowed border-[#E8EBF0] bg-[#FAFBFD] text-ink-3"
                            : selected
                            ? `${accentBorder} ${accentLight} text-ink`
                            : `border-[#E8EBF0] bg-white text-ink ${accentHoverBorder}`
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase text-ink-2">
                          {weekdayShort[day.weekday]}
                        </span>
                        <span className="text-sm font-bold">
                          {dayNum} {monthShort}
                        </span>
                        {day.specialEmoji && <span className="text-xs">{day.specialEmoji}</span>}
                        {/* Segnalazione 25/08/2026 (Fabrizio): "voglio vedere i
                            giorni che ho già prenotato, altrimenti sembra che
                            non abbia prenotato" — badge distinto invece del
                            solo prezzo, così un giorno già coperto non si
                            confonde con uno ancora libero. */}
                        {alreadyBooked ? (
                          <span className={`text-[11px] font-semibold ${bookedBadge[dayDecision as string].cls}`}>
                            <i className={`ti ${bookedBadge[dayDecision as string].icon} mr-0.5 text-[10px]`} />
                            {bookedBadge[dayDecision as string].label}
                          </span>
                        ) : (
                          <span className={`text-[11px] font-semibold ${accentText}`}>
                            {soldOut ? "Pieno" : `€${price}`}
                          </span>
                        )}
                        {wasRejected && !soldOut && (
                          <span className="text-[9.5px] font-medium text-ink-3">Rifiutato in precedenza</span>
                        )}
                        {!alreadyBooked && !wasRejected && day.discountPercent ? (
                          <span className="text-[10px] font-medium text-green">-{day.discountPercent}%</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            {selectedDayDates.length > 0 && (
              <div className="mb-3.5 rounded-md bg-bg p-3">
                <div className="flex justify-between text-[15px] font-bold text-ink">
                  <span>
                    {selectedDayDates.length} giorn{selectedDayDates.length === 1 ? "o" : "i"} selezionat
                    {selectedDayDates.length === 1 ? "o" : "i"}
                  </span>
                  <span className={accentText}>€{daysCost}</span>
                </div>
                {!meetsMinDays && activity.minDaysPerBooking && (
                  <p className="mt-1.5 text-[11.5px] font-medium text-orange">
                    Servono almeno {activity.minDaysPerBooking} giorni per prenotare Giorni spot su questa attività.
                  </p>
                )}
              </div>
            )}
            <div className="my-3 h-px bg-[#F0F2F5]" />
          </>
        )}

        <InfoRow icon="ti-coin-euro" label="Costo settimana" value={`€${activity.pricePerWeek}`} valueColor={accentText} />
        <InfoRow icon="ti-calendar" label="Settimane disponibili" value={activity.weeksAvailable} />
        <InfoRow
          icon="ti-users"
          label="Posti rimasti"
          // FIX (TRAMA FINAL HARDENING §1/§3) — non più activity.spotsLeft
          // (editoriale, scollegato dalla realtà): il numero mostrato ora è
          // sempre quello reale (realSpotsLeft), la scelta del gestore
          // (showExactSpots) resta solo per decidere SE mostrare il numero
          // o un generico "Posti disponibili", mai per inventarne uno.
          value={
            !activityAvailable
              ? "Al momento non disponibile"
              : activity.showExactSpots && realSpotsLeft !== undefined
              ? `⚠️ Solo ${realSpotsLeft}!`
              : "Posti disponibili"
          }
          valueColor={
            !activityAvailable
              ? "text-ink-3"
              : activity.showExactSpots && realSpotsLeft !== undefined
              ? "text-orange"
              : undefined
          }
        />
        <div className="my-3 h-px bg-[#F0F2F5]" />

        {certifications.length > 0 && (
          <>
            <div className={`mb-2.5 ${titleCls}`}>Certificazioni</div>
            <div className="mb-3.5 flex flex-wrap gap-2">
              {certifications.map((cert) => (
                <span
                  key={cert.id}
                  className={`flex items-center gap-1.5 rounded-md ${accentLight} px-2.5 py-1.5 text-[11px] font-semibold ${accentText}`}
                >
                  <i className="ti ti-certificate text-[13px]" />
                  {cert.label}
                </span>
              ))}
            </div>
            <div className="my-3 h-px bg-[#F0F2F5]" />
          </>
        )}

        <div className={`mb-2.5 ${titleCls}`}>Servizi disponibili</div>
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
          {/* SPRINT 3 (feedback Fabrizio) — stesso restyle wording di
              ActivityCard.tsx/ActivityCardHorizontal.tsx: qui non c'era un
              problema di colore (ServiceTag è sempre verde/grigio, uniforme
              per tutti i servizi), solo di testo. */}
          <ServiceTag
            icon="ti-heart-handshake"
            label="Nessuna limitazione"
            available={Boolean(activity.centerAccessible)}
            detail={activity.centerAccessible ? activity.centerAccessibleNote : undefined}
          />
        </div>

        {activity.dietaryOptions && activity.dietaryOptions.length > 0 && (
          <>
            <div className={`mb-2.5 ${titleCls}`}>Diete e intolleranze gestite</div>
            <div className="mb-3.5 flex flex-wrap gap-2">
              {activity.dietaryOptions.map((option) => (
                <span
                  key={option}
                  className="flex items-center gap-1.5 rounded-md bg-green-light px-2.5 py-1.5 text-[11px] font-semibold text-green"
                >
                  <i className="ti ti-salad text-[13px]" />
                  {option}
                </span>
              ))}
            </div>
          </>
        )}
        <div className="my-3 h-px bg-[#F0F2F5]" />

        <div className={`mb-2.5 ${titleCls}`}>
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
        {selectedDayDates.length > 0 ? (
          <div>
            <div className="text-xl font-bold text-ink">€{daysCost}</div>
            <div className="text-[11px] text-ink-2">
              {selectedDayDates.length} giorn{selectedDayDates.length === 1 ? "o" : "i"}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xl font-bold text-ink">€{activity.pricePerWeek}</div>
            <div className="text-[11px] text-ink-2">per settimana</div>
          </div>
        )}
        {existingBooking ? (
          // PLANNER BETA v1.1 (Wave 4) — booking attivo ("pending" o
          // "confirmed") già esistente per questa attività: "Prenota ora"
          // non deve MAI comparire (sarebbe una nuova acquisizione, non
          // un'azione su quanto già prenotato). Mostriamo SOLO l'azione
          // realmente supportata dal backend oggi — modifica della
          // prenotazione esistente — riusando la STESSA route condivisa
          // già linkata da "Le mie prenotazioni" (PrenotazioniClient.tsx,
          // "Modifica" → /prenotazioni/[id]/modifica). Nessuna nuova
          // capability inventata: se canCancelOrModify è false (es. finestra
          // di modifica chiusa), non forziamo comunque un link che poi
          // fallirebbe — mostriamo solo lo stato, il "Contatta il gestore"
          // già presente in cima alla scheda resta il canale reale per
          // qualunque richiesta in quel caso.
          existingBooking.canCancelOrModify ? (
            <Link
              href={`/prenotazioni/${existingBooking.id}/modifica`}
              className={`rounded-lg ${accentBg} px-7 py-3.5 text-[15px] font-bold text-white transition-all hover:scale-[0.97] ${accentHoverBg}`}
            >
              Modifica prenotazione
            </Link>
          ) : (
            <div className="text-right">
              <div className="text-[13px] font-bold text-ink">
                {/* FIX (TRAMA FINAL HARDENING CLOSURE, segnalazione Fabrizio
                    04/09/2026 — "controlla la coerenza tra lo stato delle
                    prenotazioni in tutti i punti"): prima si leggeva SOLO
                    existingBooking.status (pagamento, quasi sempre
                    "confirmed" indipendentemente dalla risposta del centro)
                    — la stessa prenotazione poteva quindi dire "confermata"
                    qui e "in attesa"/"confermata parzialmente" in "Le mie
                    prenotazioni"/Planner. Stessa vocale di
                    PrenotazioniClient.tsx (la referenza primaria del
                    genitore per questo stato), stesso campo
                    partnerDecision — nessuna nuova regola. */}
                {existingBooking.partnerDecision === "accepted"
                  ? "Prenotazione confermata"
                  : existingBooking.partnerDecision === "partial"
                  ? "Confermata parzialmente"
                  : existingBooking.partnerDecision === "rejected"
                  ? "Prenotazione rifiutata"
                  : "Prenotazione in attesa"}
              </div>
              <div className="text-[11px] text-ink-2">Per modifiche, usa &quot;Contatta il gestore&quot; sopra</div>
            </div>
          )
        ) : selectedDayDates.length === 0 && !activityAvailable ? (
          // FIX (TRAMA FINAL HARDENING §1) — "Se disponibilità <= 0, la CTA
          // 'Prenota ora' NON deve essere attiva": prima di questo fix la
          // CTA era SEMPRE attiva qui indipendentemente dalla disponibilità
          // reale (il banner sopra poteva dire "Solo 0 posti!" mentre questo
          // link portava comunque al wizard). Nessun giorno spot selezionato
          // (quel path resta invariato: selezionare un giorno pieno è già
          // impossibile, vedi toggleDay) e nessuna disponibilità reale per
          // settimana/giorno → stato esplicito, nessuna navigazione.
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg bg-[#C5CDD8] px-7 py-3.5 text-[15px] font-bold text-white"
          >
            Al momento non disponibile
          </button>
        ) : selectedDayDates.length > 0 && !meetsMinDays ? (
          <button
            type="button"
            disabled
            // TRAMA ONE Parent Spotlight sprint (24/08/2026) — stesso
            // data-spotlight della variante attiva sotto, così il target
            // dello step "book_activity" (discover_book_parent) resta
            // trovabile anche in questo stato transitorio (giorni scelti
            // sotto il minimo). Un <button disabled> non emette eventi
            // click nativi, quindi il listener di completamento del
            // motore Spotlight non scatta comunque finché l'utente non
            // sceglie giorni sufficienti e vede la variante cliccabile.
            data-spotlight="book_activity"
            className="cursor-not-allowed rounded-lg bg-[#C5CDD8] px-7 py-3.5 text-[15px] font-bold text-white"
          >
            Prenota ora
          </button>
        ) : (
          <Link
            href={bookingHref}
            // TRAMA ONE Parent Spotlight sprint (24/08/2026) — target reale
            // dello step "book_activity" (lib/walkthrough/registry.ts,
            // discover_book_parent).
            data-spotlight="book_activity"
            className={`rounded-lg ${accentBg} px-7 py-3.5 text-[15px] font-bold text-white transition-all hover:scale-[0.97] ${accentHoverBg}`}
          >
            Prenota ora
          </Link>
        )}
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
