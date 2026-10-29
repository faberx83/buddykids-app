import Link from "next/link";
import DuplicateActivityButton from "@/components/center/DuplicateActivityButton";
import PartnerPageHeader from "@/components/center/PartnerPageHeader";
import { ACTIVITY_TEMPLATES } from "@/lib/centers/activity-templates";
import { buildFamilyPreviewHref } from "@/lib/center/family-preview";
import { EMPTY_DATE_SUMMARY, type ActivityDateSummary } from "@/lib/data/activity-dates";

// TRAMA — PORTALE CENTRI V2, SEZIONE "ATTIVITÀ" (28/10/2026, tavola 6,
// PARTNER_SHELL_V2_ENABLED). ADAPT dell'elenco di /center/activities:
// stesse attività, in più a che punto sono le date ("mancano le date" se non
// ce n'è nessuna futura), "Crea da modello" e "Duplica". La modifica e il
// calendario restano le pagine di sempre.

export interface ActivityRowV2 {
  slug: string;
  name: string;
  emoji: string;
  ageRange: string;
  dayBased: boolean;
  /** Settimane e anche giorni singoli. */
  mixed?: boolean;
  hours: string | null;
  pricePerWeek: number;
  dates: ActivityDateSummary;
}

function formatDay(isoDate: string): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
    .format(new Date(`${isoDate}T00:00:00Z`))
    .replace(/\./g, "");
}

function priceLabel(a: ActivityRowV2): string {
  if (!a.pricePerWeek) return "Prezzo da indicare";
  if (a.dayBased) {
    const day = Math.round((a.pricePerWeek / 5) * 100) / 100;
    return `€${Number.isInteger(day) ? day : day.toFixed(2)} al giorno`;
  }
  return `€${a.pricePerWeek} a settimana`;
}

function DatesLine({ d }: { d: ActivityDateSummary }) {
  if (!d.next) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-[#FFF3DC] px-2.5 py-1 text-[12px] font-bold text-[#7A4F00]">
        <i className="ti ti-calendar-exclamation text-[14px]" aria-hidden="true" />
        Mancano le date: le famiglie non possono iscriversi
      </span>
    );
  }
  const amount =
    d.openDays > 0
      ? `${d.openDays} ${d.openDays === 1 ? "giorno aperto" : "giorni aperti"}`
      : `${d.weeks} ${d.weeks === 1 ? "settimana" : "settimane"}`;
  return (
    <span className="text-[13px] text-ink-2">
      Prossimo: <span className="font-semibold text-ink">{formatDay(d.next)}</span> · {amount}
    </span>
  );
}

export default function ActivitiesV2({ activities, canCreate }: { activities: ActivityRowV2[]; canCreate: boolean }) {
  const missing = activities.filter((a) => !a.dates.next).length;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 animate-fade-in">
      <PartnerPageHeader
        title="Attività"
        subtitle={
          activities.length === 0
            ? "Ancora nessuna attività: partite da un modello, ci vuole un minuto."
            : missing > 0
              ? `${missing} ${missing === 1 ? "attività è" : "attività sono"} senza date: aggiungetele perché le famiglie possano iscriversi.`
              : "Le famiglie vedono queste attività con i giorni aperti."
        }
        action={
          canCreate ? (
            <Link
              href="/center/activities/new"
              data-spotlight="create_activity"
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-partner-primary px-4 text-[14.5px] font-semibold text-white hover:bg-partner-primary-press"
            >
              <i className="ti ti-plus text-[18px]" aria-hidden="true" />
              Nuova attività
            </Link>
          ) : undefined
        }
      />

      {canCreate && (
        <section aria-labelledby="att-modelli" className="flex flex-col gap-2.5">
          <h2 id="att-modelli" className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">
            Crea da modello
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {ACTIVITY_TEMPLATES.map((t) => (
              <Link
                key={t.key}
                href={`/center/activities/new?modello=${t.key}`}
                className="flex items-start gap-3 rounded-2xl border border-partner-line bg-white p-3.5 transition-colors hover:border-partner-primary hover:bg-partner-soft"
              >
                <span className="text-[24px] leading-none" aria-hidden="true">
                  {t.emoji}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[14.5px] font-semibold text-ink">{t.title}</span>
                  <span className="text-[12.5px] leading-snug text-ink-2">{t.pitch}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="att-elenco" className="flex flex-col gap-2.5">
        <h2 id="att-elenco" className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">
          Le vostre attività
        </h2>
        {activities.length === 0 ? (
          <p className="rounded-[18px] border border-dashed border-partner-line bg-white px-4 py-5 text-[14px] text-ink-2">
            Qui compariranno le vostre attività, con i giorni aperti e i posti.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {activities.map((a) => (
              <li key={a.slug} className="flex flex-col gap-3 rounded-[18px] border border-partner-line bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-partner-soft text-[22px]" aria-hidden="true">
                    {a.emoji}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link href={`/center/activities/${a.slug}`} className="text-[16px] font-semibold leading-snug text-ink hover:underline">
                      {a.name}
                    </Link>
                    <span className="text-[13px] text-ink-2">
                      {a.ageRange ? `${a.ageRange} · ` : ""}
                      {a.dayBased ? "a giorni singoli" : a.mixed ? "a settimane o giorni singoli" : "a settimane"}
                      {a.hours ? ` · ${a.hours}` : ""} · {priceLabel(a)}
                    </span>
                    <DatesLine d={a.dates ?? EMPTY_DATE_SUMMARY} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/center/activities/${a.slug}/calendar`}
                    className={`flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold ${
                      a.dates.next
                        ? "border border-partner-line bg-white text-partner-primary hover:bg-partner-soft"
                        : "bg-partner-primary text-white hover:bg-partner-primary-press"
                    }`}
                  >
                    <i className="ti ti-calendar text-[16px]" aria-hidden="true" />
                    {a.dates.next ? "Date e posti" : "Aggiungi le date"}
                  </Link>
                  <Link
                    href={`/center/activities/${a.slug}`}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-partner-line bg-white px-3 text-[13px] font-semibold text-partner-primary hover:bg-partner-soft"
                  >
                    <i className="ti ti-pencil text-[16px]" aria-hidden="true" />
                    Modifica
                  </Link>
                  <DuplicateActivityButton activitySlug={a.slug} name={a.name} />
                  <Link
                    href={buildFamilyPreviewHref(a.slug, "attivita")}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-partner-line bg-white px-3 text-[13px] font-semibold text-partner-primary hover:bg-partner-soft"
                  >
                    <i className="ti ti-eye text-[16px]" aria-hidden="true" />
                    Anteprima
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
