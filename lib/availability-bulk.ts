import type { DayAvailability } from "@/lib/types";

// OD-02 / PT-MVP-08 (TRAMA — QA Remediation, poi "REVISIONE DECISIONE OD-02:
// FIX PRIMA DELLA BETA", 06/08/2026): logica pura del pannello di modifica
// multipla del Calendario disponibilità Partner (components/
// AvailabilityCalendar.tsx). Estratta in questo file per essere testabile
// senza browser (stesso pattern di lib/day-pricing.ts e
// lib/feature-registry/catalog.ts) e per essere l'unica fonte di verità
// riusata sia dal pannello bulk sia — potenzialmente — da altri punti
// futuri, evitando un secondo modello dati parallelo.
//
// Root cause del bug originale: il `BulkDraft` applicava SEMPRE
// isOpen/capacity/discountPercent/lastMinute a tutti i giorni selezionati,
// sovrascrivendoli incondizionatamente, e non includeva affatto i campi
// "Giornata particolare" (specialEmoji/specialLabel). Fix: ogni campo del
// bulk draft (compresa la Giornata particolare) ha ora una semantica
// esplicita a 3 stati — campo non modificato / valore impostato / valore
// esplicitamente rimosso — mai un valore vuoto ambiguo per distinguere i
// primi due casi dal terzo (richiesta esplicita di Fabrizio, sezione 2).

export type SpecialDayBulkAction = "unchanged" | "set" | "remove";

/** Un singolo campo del bulk draft: `include` decide se il salvataggio lo
 * tocca o no; `value` è irrilevante quando `include` è false (il giorno
 * mantiene il proprio valore attuale, qualunque esso sia). */
export interface BulkFieldToggle<T> {
  include: boolean;
  value: T;
}

export interface BulkDraft {
  isOpen: BulkFieldToggle<boolean>;
  capacity: BulkFieldToggle<number>;
  discountPercent: BulkFieldToggle<number>;
  lastMinute: BulkFieldToggle<boolean>;
  specialDayAction: SpecialDayBulkAction;
  specialEmoji?: string;
  specialLabel?: string;
}

export function defaultBulkDraft(): BulkDraft {
  return {
    isOpen: { include: false, value: true },
    capacity: { include: false, value: 15 },
    discountPercent: { include: false, value: 0 },
    lastMinute: { include: false, value: false },
    specialDayAction: "unchanged",
    specialEmoji: undefined,
    specialLabel: undefined,
  };
}

/** true se applicare questo draft cambierebbe davvero qualcosa — usato per
 * disabilitare il bottone "Applica" quando il Partner non ha selezionato
 * alcun campo da modificare (evita un salvataggio silenziosamente no-op). */
export function bulkDraftHasChanges(draft: BulkDraft): boolean {
  return (
    draft.isOpen.include ||
    draft.capacity.include ||
    draft.discountPercent.include ||
    draft.lastMinute.include ||
    draft.specialDayAction !== "unchanged"
  );
}

/**
 * Applica il bulk draft ai soli giorni selezionati, senza toccare:
 * - i giorni NON selezionati (mai modificati, per costruzione: la funzione
 *   ritorna l'oggetto originale invariato per quelle date);
 * - i campi NON inclusi nel draft (`include: false` o `specialDayAction:
 *   "unchanged"`), che restano quelli già presenti sul giorno (`{...d,
 *   ...patch}` con quella chiave assente da `patch`).
 * Nessuna riga viene duplicata: la mappatura è 1:1 sull'array in ingresso.
 */
export function applyBulkPatch(
  days: DayAvailability[],
  selected: ReadonlySet<string>,
  draft: BulkDraft
): DayAvailability[] {
  return days.map((d) => {
    if (!selected.has(d.date)) return d;

    const patch: Partial<DayAvailability> = {};

    if (draft.isOpen.include) {
      patch.isOpen = draft.isOpen.value;
    }
    if (draft.capacity.include) {
      patch.capacity = draft.capacity.value;
      // Stesso comportamento già in uso nel pannello a giorno singolo e
      // nel bulk pre-esistente: cambiare la capienza totale resetta i
      // posti liberi al nuovo totale.
      patch.spotsLeft = draft.capacity.value;
    }
    if (draft.discountPercent.include) {
      patch.discountPercent = draft.discountPercent.value || undefined;
    }
    if (draft.lastMinute.include) {
      patch.lastMinute = draft.lastMinute.value;
    }

    if (draft.specialDayAction === "set") {
      patch.specialEmoji = draft.specialEmoji || undefined;
      patch.specialLabel = draft.specialLabel || undefined;
    } else if (draft.specialDayAction === "remove") {
      patch.specialEmoji = undefined;
      patch.specialLabel = undefined;
    }
    // "unchanged": nessuna chiave special* nel patch -> {...d, ...patch}
    // preserva esattamente il valore già presente su quel giorno.

    return { ...d, ...patch };
  });
}

export interface SpecialDaySummary {
  /** true se i giorni selezionati hanno oggi valori diversi tra loro
   * (stato "misto/indeterminato" da mostrare nel pannello, non un valore
   * singolo arbitrario). */
  mixed: boolean;
  emoji: string;
  label: string;
}

/** Fotografia dello stato ATTUALE (prima di applicare il draft) della
 * Giornata particolare sui giorni selezionati — usata per mostrare nel
 * pannello bulk "valore attuale: 🏊 Piscina" oppure "valori misti", invece
 * di lasciare il Partner indovinare cosa c'è già sui giorni scelti. */
export function summarizeSpecialDay(
  days: DayAvailability[],
  selected: ReadonlySet<string>
): SpecialDaySummary | null {
  if (selected.size === 0) return null;

  const values = days
    .filter((d) => selected.has(d.date))
    .map((d) => `${d.specialEmoji ?? ""}|${d.specialLabel ?? ""}`);

  const unique = new Set(values);
  if (unique.size === 1) {
    const [emoji, label] = values[0].split("|");
    return { mixed: false, emoji, label };
  }
  return { mixed: true, emoji: "", label: "" };
}
