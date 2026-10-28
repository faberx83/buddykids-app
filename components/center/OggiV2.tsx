import Link from "next/link";
import PushNotificationsPrompt from "@/components/PushNotificationsPrompt";
import ActivationCard from "@/components/center/ActivationCard";
import type { ActivationView } from "@/lib/centers/activation";
import type { PartnerDecision } from "@/lib/booking-response/effective-decision";
import { shortItalianDay, toAnswerSummary } from "@/lib/centers/partner-oggi";

// TRAMA — PORTALE CENTRI V2, SEZIONE "OGGI" (28/10/2026, tavola 3 del mock,
// PARTNER_SHELL_V2_ENABLED). ADAPT della dashboard di /center: stessi dati,
// letti da app/center/page.tsx, nuovo ordine. Prima cosa: cosa aspetta una
// risposta; poi chi è al centro oggi; poi i numeri. Niente euro: nel pilota
// non si paga in app (la beta è solo richiesta al centro), quindi i riquadri
// contano richieste e attività, non incassi.

export interface OggiV2Props {
  savedProfile: boolean;
  activation: ActivationView | null;
  toAnswer: { bookings: number; messages: number; groups: number; oldestBookingDays: number };
  today: {
    expected: number;
    recorded: number;
    unconfirmedCheckins: number;
    specialDays: { key: string; label: string; activityName: string; href: string }[];
  };
  numbers: { publishedActivities: number; confirmed: number; awaitingParent: number; expiringPromotions: number };
  recent: { id: string; kids: string; activityName: string; decision: PartnerDecision }[];
}

const DECISION: Record<PartnerDecision, { label: string; cls: string }> = {
  pending: { label: "Da rispondere", cls: "bg-[#FFF3DC] text-[#7A4F00]" },
  accepted: { label: "Accettata", cls: "bg-[#E6F6F0] text-[#146B4F]" },
  rejected: { label: "Rifiutata", cls: "bg-[#EEF2F1] text-ink-2" },
  proposed: { label: "Proposta inviata", cls: "bg-partner-soft text-partner-primary" },
  partial: { label: "Accettata in parte", cls: "bg-partner-soft text-partner-primary" },
};

function SectionTitle({ id, children, action }: { id: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">
        {children}
      </h2>
      {action}
    </div>
  );
}

function Tile({ value, label, href }: { value: string; label: string; href?: string }) {
  const inner = (
    <>
      <span className="font-poppins text-[22px] font-semibold text-partner-primary">{value}</span>
      <span className="text-[12.5px] leading-snug text-ink-2">{label}</span>
    </>
  );
  const cls = "flex flex-col gap-0.5 rounded-2xl border border-partner-line bg-white px-3.5 py-3";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:bg-partner-soft`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export default function OggiV2({ savedProfile, activation, toAnswer, today, numbers, recent }: OggiV2Props) {
  const answer = toAnswerSummary(toAnswer);
  const active = activation ? activation.active : true;
  const status = active
    ? { text: "Attivo · visibile alle famiglie", cls: "bg-[#E6F6F0] text-[#146B4F]", dot: "bg-trama-green" }
    : activation?.current === "verifica"
      ? { text: "In verifica da TRAMA", cls: "bg-partner-soft text-partner-primary", dot: "bg-partner-primary" }
      : { text: `In attivazione · ${activation?.percent ?? 0}%`, cls: "bg-[#FFF3DC] text-[#7A4F00]", dot: "bg-partner-accent" };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h1 className="font-poppins text-[28px] font-semibold text-ink">Oggi</h1>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-bold ${status.cls}`}>
          <span className={`h-[7px] w-[7px] rounded-full ${status.dot}`} aria-hidden="true" />
          {status.text}
        </span>
      </div>

      {savedProfile && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-[#E6F6F0] px-3.5 py-2.5 text-sm font-semibold text-ink">
          <i className="ti ti-circle-check text-[18px] text-trama-green" aria-hidden="true" />
          Profilo salvato
        </p>
      )}

      {activation && !activation.active && <ActivationCard view={activation} />}

      {answer.total > 0 ? (
        <Link
          href={answer.href}
          data-testid="oggi-da-rispondere"
          className="flex items-center gap-3 rounded-2xl bg-partner-primary px-4 py-3.5 text-white transition-colors hover:bg-partner-primary-press"
        >
          <span className="flex h-8 min-w-[32px] items-center justify-center rounded-full bg-white px-2 text-[15px] font-bold text-partner-primary">
            {answer.total}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-semibold">Da rispondere</span>
            <span className="text-[12.5px] text-[#D5E7E6]">{answer.detail}</span>
          </span>
          <i className="ti ti-chevron-right text-[18px]" aria-hidden="true" />
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-partner-line bg-white px-4 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E6F6F0]">
            <i className="ti ti-check text-[18px] text-trama-green" aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="text-[15px] font-semibold text-ink">Niente da rispondere</span>
            <span className="text-[12.5px] text-ink-2">Quando una famiglia vi scrive o prenota, vi avvisiamo anche per email.</span>
          </span>
        </div>
      )}

      <PushNotificationsPrompt />

      <section aria-labelledby="oggi-centro" className="flex flex-col gap-2.5">
        <SectionTitle
          id="oggi-centro"
          action={
            <Link href="/center/attendance" className="text-[13px] font-semibold text-partner-accent-ink">
              Registro presenze
            </Link>
          }
        >
          Al centro oggi · {shortItalianDay()}
        </SectionTitle>
        <div className="flex flex-col overflow-hidden rounded-[18px] border border-partner-line bg-white">
          {today.expected > 0 ? (
            <Link href="/center/attendance" className="flex items-center gap-3 px-4 py-3.5 hover:bg-partner-page">
              <i className="ti ti-clipboard-check text-[22px] text-partner-primary" aria-hidden="true" />
              <span className="flex flex-1 flex-col">
                <span className="text-[15px] font-semibold text-ink">
                  {today.recorded} su {today.expected} {today.expected === 1 ? "bambino segnato" : "bambini segnati"}
                </span>
                <span className="text-[12.5px] text-ink-2">Presente, in ritardo o assente: le famiglie lo vedono subito</span>
              </span>
              <i className="ti ti-chevron-right text-[18px] text-ink-2" aria-hidden="true" />
            </Link>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3.5">
              <i className="ti ti-mood-smile text-[22px] text-ink-2" aria-hidden="true" />
              <span className="text-[14px] text-ink-2">Oggi nessun bambino atteso.</span>
            </div>
          )}
          {today.unconfirmedCheckins > 0 && (
            <Link
              href="/center/attendance"
              className="flex items-center gap-3 border-t border-[#EEF2F1] px-4 py-3 hover:bg-partner-page"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-partner-accent" aria-hidden="true" />
              <span className="flex-1 text-[14px] font-semibold text-ink">
                {today.unconfirmedCheckins} check-in dei genitori da confermare
              </span>
              <i className="ti ti-chevron-right text-[18px] text-ink-2" aria-hidden="true" />
            </Link>
          )}
          {today.specialDays.map((d) => (
            <Link key={d.key} href={d.href} className="flex items-center gap-3 border-t border-[#EEF2F1] px-4 py-3 hover:bg-partner-page">
              <i className="ti ti-sparkles text-[18px] text-partner-accent-ink" aria-hidden="true" />
              <span className="flex-1 text-[14px] text-ink">
                Giornata speciale: {d.label} <span className="text-ink-2">({d.activityName})</span>
              </span>
            </Link>
          ))}
          <div className="flex items-center gap-2 border-t border-[#EEF2F1] px-4 py-2.5">
            <span className="text-[12.5px] text-ink-2">Chi ritira, con le deleghe dei genitori</span>
            <span className="rounded-full border border-dashed border-[#B9C6C2] px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">
              In programma
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="oggi-numeri" className="flex flex-col gap-2.5">
        <SectionTitle id="oggi-numeri">In numeri</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Tile value={String(numbers.publishedActivities)} label="attività pubblicate" href="/center/activities" />
          <Tile value={String(numbers.confirmed)} label="prenotazioni accettate" href="/center/prenotazioni" />
          <Tile value={String(numbers.awaitingParent)} label="proposte in attesa del genitore" href="/center/prenotazioni" />
          <Tile
            value={String(numbers.expiringPromotions)}
            label={numbers.expiringPromotions === 1 ? "promozione in scadenza" : "promozioni in scadenza"}
            href="/center/promotions"
          />
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-dashed border-[#B9C6C2] px-4 py-3">
          <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-2">In programma</span>
          <span className="text-[14px] text-ink">
            Cosa cercano le famiglie della vostra zona: giorni, orari ed età richiesti, e quante vi hanno salvato.
          </span>
        </div>
      </section>

      <section aria-labelledby="oggi-recenti" className="flex flex-col gap-2.5">
        <SectionTitle
          id="oggi-recenti"
          action={
            <Link href="/center/prenotazioni" className="text-[13px] font-semibold text-partner-accent-ink">
              Vedi tutte
            </Link>
          }
        >
          Ultime prenotazioni
        </SectionTitle>
        {recent.length > 0 ? (
          <ul className="overflow-hidden rounded-[18px] border border-partner-line bg-white">
            {recent.map((r, i) => (
              <li key={r.id} className={i < recent.length - 1 ? "border-b border-[#EEF2F1]" : ""}>
                <Link href="/center/prenotazioni" className="flex items-center gap-3 px-4 py-3 hover:bg-partner-page">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold text-ink">{r.kids || "Prenotazione"}</span>
                    <span className="truncate text-[12.5px] text-ink-2">{r.activityName}</span>
                  </span>
                  <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${DECISION[r.decision].cls}`}>
                    {DECISION[r.decision].label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[18px] border border-partner-line bg-white px-4 py-4 text-[14px] text-ink-2">
            Ancora nessuna prenotazione. Le richieste delle famiglie arriveranno qui e in Richieste.
          </p>
        )}
      </section>
    </div>
  );
}
