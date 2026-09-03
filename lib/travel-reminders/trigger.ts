// Logica pura (nessun I/O) del trigger dei Promemoria di partenza —
// separata da app/api/cron/travel-reminders/route.ts per essere testabile
// senza Supabase/rete, stesso principio già applicato a
// lib/booking-response/effective-decision.ts e lib/plan-shares/build-entries.ts.
//
// Il cron gira periodicamente (vedi vercel.json, ogni 15 minuti) invece che
// esattamente al minuto giusto — "isReminderDue" quindi non chiede "è
// ESATTAMENTE questo il minuto?" ma "il momento di avvisare è caduto negli
// ultimi N minuti e non l'abbiamo ancora mandato?" (finestra di tolleranza),
// altrimenti un'esecuzione cron in ritardo di pochi minuti farebbe perdere
// per sempre quel promemoria per la giornata.

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function mod1440(n: number): number {
  return ((n % 1440) + 1440) % 1440;
}

// Minuto del giorno (0-1439) in cui il push andrebbe inviato — target meno
// l'anticipo richiesto, con wraparound corretto se il risultato "sfora"
// mezzanotte all'indietro (es. target 00:10, allarme 30 min -> 23:40 del
// giorno prima).
export function computeTriggerMinutes(targetTime: string, alarmMinutes: number): number {
  return mod1440(toMinutes(targetTime) - alarmMinutes);
}

// true se "adesso" (nowHHMM) cade nella finestra [trigger, trigger +
// toleranceMinutes] — cioè il momento giusto è già passato da poco e non
// troppo, indipendentemente da quando esattamente gira il cron.
export function isReminderDue(nowHHMM: string, targetTime: string, alarmMinutes: number, toleranceMinutes: number): boolean {
  const trigger = computeTriggerMinutes(targetTime, alarmMinutes);
  const diff = mod1440(toMinutes(nowHHMM) - trigger);
  return diff >= 0 && diff <= toleranceMinutes;
}
