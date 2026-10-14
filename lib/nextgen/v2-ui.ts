// TRAMA — POLISH V2 (14/10/2026, "NAVY + OFF-WHITE + FILI TRAMA").
// Classi condivise delle superfici V2, in un posto solo: il navy è il colore
// primario (CTA, +, nav attiva, selezioni), il viola è un accento; le card
// hanno raggio 16 e un bordo sottile al posto dell'ombra; i pulsanti hanno
// raggio 12 (le pillole restano per schede, filtri e badge).
// Token in tailwind.config.ts: trama.primary / primary-press / primary-soft,
// trama.accent / accent-ink / accent-soft, trama.line.

/** Card di base: bianca, raggio 16, bordo sottile. */
export const V2_CARD = "rounded-2xl border border-trama-line bg-white";

/** Pulsante primario pieno (navy), alto 48. */
export const V2_CTA =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[12px] bg-trama-primary px-5 text-[15px] font-bold text-white active:bg-trama-primary-press disabled:bg-[#B9C0CC] disabled:text-white";

/** Pulsante primario compatto (navy), alto 44. */
export const V2_CTA_SM =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[12px] bg-trama-primary px-4 text-[14px] font-bold text-white active:bg-trama-primary-press disabled:bg-[#B9C0CC] disabled:text-white";

/** Pulsante secondario (contorno), alto 44. */
export const V2_CTA_SECONDARY =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[12px] border border-[#D9DDE5] bg-white px-4 text-[14px] font-semibold text-trama-primary active:bg-black/[0.03] disabled:opacity-50";

/** Link testuale (azioni secondarie, "Vedi tutte"). */
export const V2_LINK = "font-semibold text-trama-accent-ink";

/** Pillola selezionata / non selezionata (filtri, chip). */
export const V2_CHIP_ON = "border-trama-primary bg-trama-primary text-white";
export const V2_CHIP_OFF = "border-[#E3E6EC] bg-white text-ink";
