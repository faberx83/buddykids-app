"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Language, Theme } from "@/lib/data/profile";
import { updatePreferencesAction } from "@/app/actions/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ComingSoonBadge } from "@/components/StatusBadge";
import { enablePushNotifications, disablePushNotifications, hasBrowserPushSubscription } from "@/lib/push/client";
import { SETTINGS_CARD, SETTINGS_ERROR, SettingsSection, SwitchRow } from "@/components/nextgen/settings-v2";

const languageLabels: Record<Language, string> = { it: "Italiano", en: "English" };

// Sezione "Preferenze" (dentro Impostazioni) — lingua, tema E notifiche
// (unite qui su richiesta di Fabrizio: "le notifiche le metterei dentro le
// preferenze", prima erano una sottosezione separata — vedi
// ProfileSettingsSection.tsx, che non punta più a /notifiche). Ogni scelta
// salva subito (nessun pulsante "Salva" separato).
//
// Lingua/Tema segnati "Non ancora attivi" (Fabrizio: "le preferenze
// lingua/tema non fanno alcuna modifica"): il valore si salva davvero nel
// profilo, ma non cambia ancora nulla a video (nessuna traduzione reale,
// nessun tema scuro implementato) — il badge lo rende esplicito invece di
// sembrare un bug.
export default function ProfilePreferencesSection({
  initialLanguage,
  initialTheme,
  initialNotifyEmail,
  initialNotifyPush,
  initialNotifySms,
  v2 = false,
  briefingSlot,
  helpSlot,
}: {
  /** 20/10/2026 — Impostazioni V2 (solo area famiglie /nextgen): stesse
   *  scelte e stesso salvataggio, aspetto nuovo e ordine per importanza.
   *  V1 e portale Partner non passano la prop: invariati. */
  v2?: boolean;
  /** V2: "Il buongiorno di TRAMA", subito sotto le notifiche. */
  briefingSlot?: ReactNode;
  /** V2: "Aiuto e guida". */
  helpSlot?: ReactNode;
  initialLanguage: Language;
  initialTheme: Theme;
  initialNotifyEmail: boolean;
  initialNotifyPush: boolean;
  initialNotifySms: boolean;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const [theme, setTheme] = useState(initialTheme);
  const [notifyEmail, setNotifyEmail] = useState(initialNotifyEmail);
  const [notifyPush, setNotifyPush] = useState(initialNotifyPush);
  const [notifySms, setNotifySms] = useState(initialNotifySms);
  const [error, setError] = useState<string | null>(null);
  // Solo per "Notifiche push" (31/08/2026): a differenza degli altri due
  // toggle (un semplice salvataggio di preferenza), questo comporta una
  // vera richiesta di permesso al browser — un'operazione un po' più lunga
  // e che può fallire per motivi diversi da un errore di rete (permesso
  // negato, browser non supportato). "busy" disabilita il toggle mentre è
  // in corso, per evitare doppi click che genererebbero due prompt di
  // permesso sovrapposti.
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  // Segnalato da Fabrizio (31/08/2026, test reale): il toggle può risultare
  // "acceso" (initialNotifyPush true, dal DB) senza che QUESTO browser abbia
  // mai completato una vera subscription — sia perché il valore era true da
  // prima che questa funzionalità esistesse (era cosmetico), sia perché la
  // persona è iscritta solo su un altro device. In entrambi i casi mostrarlo
  // "acceso" qui è fuorviante: non c'è motivo di ricliccarlo, quindi non
  // parte mai una vera iscrizione. Corregge SOLO la visualizzazione (mai una
  // scrittura su profiles.notifyPush): un altro device potrebbe comunque
  // essere iscritto per davvero, e la persona può sempre ricliccare per
  // iscrivere anche questo.
  useEffect(() => {
    if (!initialNotifyPush) return;
    let cancelled = false;
    hasBrowserPushSubscription().then((active) => {
      if (!cancelled && !active) setNotifyPush(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(update: Parameters<typeof updatePreferencesAction>[0]) {
    setError(null);
    if (!isSupabaseConfigured) return;
    const result = await updatePreferencesAction(update);
    if (result.error) setError(result.error);
  }

  // Il toggle "Notifiche push" salva SEMPRE la preferenza (come gli altri
  // due) ma in più esegue l'iscrizione/disiscrizione REALE del browser
  // (lib/push/client.ts) — se quella fallisce (permesso negato, browser non
  // supportato, VAPID non configurato), il toggle torna allo stato
  // precedente invece di mostrare "attivo" senza che lo sia davvero:
  // notifyPush deve riflettere lo stato reale, non solo l'intenzione.
  async function handleTogglePush(next: boolean) {
    setPushError(null);
    setPushBusy(true);
    const result = next ? await enablePushNotifications() : await disablePushNotifications();
    setPushBusy(false);
    if (result.error) {
      setPushError(result.error);
      return; // notifyPush NON aggiornato: il toggle visivamente resta com'era
    }
    setNotifyPush(next);
    save({ notifyPush: next });
  }

  if (v2) {
    const chip = (on: boolean) =>
      `min-h-[40px] rounded-full border px-4 text-[14px] font-semibold ${on ? "border-trama-primary bg-trama-primary text-white" : "border-[#E3E6EC] bg-white text-ink"}`;
    return (
      <div className="flex flex-col gap-7">
        <SettingsSection id="pref-notifiche-h" title="Notifiche" hint="Come ti avvisiamo di promemoria, messaggi e cambi di programma.">
          <div className={`${SETTINGS_CARD} divide-y divide-[#F0F2F5]`}>
            <SwitchRow
              label="Notifiche push"
              hint="Sul telefono, anche ad app chiusa"
              checked={notifyPush}
              onChange={handleTogglePush}
              disabled={pushBusy}
            />
            <SwitchRow
              label="Notifiche email"
              hint="Conferme e riepiloghi alla tua email"
              checked={notifyEmail}
              onChange={(v) => {
                setNotifyEmail(v);
                save({ notifyEmail: v });
              }}
            />
          </div>
          {pushError && (
            <p role="alert" className={SETTINGS_ERROR}>
              {pushError}
            </p>
          )}
        </SettingsSection>

        {briefingSlot}
        {helpSlot}

        <SettingsSection id="pref-arrivo-h" title="In arrivo" hint="Puoi già sceglierle: si salvano, ma per ora non cambiano nulla nell'app.">
          <div className={`${SETTINGS_CARD} divide-y divide-[#F0F2F5]`}>
            <div className="flex flex-col gap-2 px-4 py-3">
              <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                Lingua
              </span>
              <div className="flex gap-2">
                {(Object.keys(languageLabels) as Language[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={language === l}
                    onClick={() => {
                      setLanguage(l);
                      save({ language: l });
                    }}
                    className={chip(language === l)}
                  >
                    {languageLabels[l]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 px-4 py-3">
              <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                Tema
              </span>
              <div className="flex gap-2">
                {(["light", "dark"] as Theme[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={theme === t}
                    onClick={() => {
                      setTheme(t);
                      save({ theme: t });
                    }}
                    className={chip(theme === t)}
                  >
                    {t === "light" ? "Chiaro" : "Scuro"}
                  </button>
                ))}
              </div>
            </div>
            <SwitchRow
              label="Notifiche SMS"
              checked={notifySms}
              onChange={(v) => {
                setNotifySms(v);
                save({ notifySms: v });
              }}
            />
          </div>
        </SettingsSection>

        {error && (
          <p role="alert" className={SETTINGS_ERROR}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-3.5">
      <div className="mb-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-2">
          Lingua
          <ComingSoonBadge label="Non ancora attivo" />
        </div>
        <div className="flex gap-2">
          {(Object.keys(languageLabels) as Language[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLanguage(l);
                save({ language: l });
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                language === l ? "border-sky bg-sky text-white" : "border-[#E8EBF0] bg-bg text-ink-2"
              }`}
            >
              {languageLabels[l]}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 border-b border-[#F0F2F5] pb-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-2">
          Tema
          <ComingSoonBadge label="Non ancora attivo" />
        </div>
        <div className="flex gap-2">
          {(["light", "dark"] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTheme(t);
                save({ theme: t });
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                theme === t ? "border-sky bg-sky text-white" : "border-[#E8EBF0] bg-bg text-ink-2"
              }`}
            >
              {t === "light" ? "Chiaro" : "Scuro"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-1.5 text-xs font-semibold text-ink-2">Notifiche</div>
      <ToggleRow
        label="Notifiche email"
        checked={notifyEmail}
        onChange={(v) => {
          setNotifyEmail(v);
          save({ notifyEmail: v });
        }}
      />
      <ToggleRow label="Notifiche push" checked={notifyPush} onChange={handleTogglePush} disabled={pushBusy} />
      {pushError && <p className="-mt-1 mb-1.5 text-[11px] font-medium text-orange">{pushError}</p>}
      <ToggleRow
        label="Notifiche SMS"
        checked={notifySms}
        onChange={(v) => {
          setNotifySms(v);
          save({ notifySms: v });
        }}
      />

      {error && <p className="mt-2 text-xs font-medium text-orange">{error}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center justify-between py-1.5 text-sm text-ink ${disabled ? "opacity-60" : ""}`}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-sky"
      />
    </label>
  );
}
