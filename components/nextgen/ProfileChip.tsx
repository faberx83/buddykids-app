"use client";

// TRAMA — PROFILO DA OGNI SEZIONE (14/10/2026, richiesta Fabrizio: "il
// profilo si può rendere raggiungibile anche dalle altre sezioni?"). Con la
// nuova barra il Profilo non è più una voce in basso: si apriva solo
// dall'avatar della Home. Questo avatar compatto sta in alto a destra di
// Planner, Scopri e Prenotazioni (stesso link, stessa foto o iniziale della
// Home). Nome e foto arrivano una volta sola dal layout NEXTGEN (nessuna
// query per pagina). Fuori dal provider, o con la barra attuale (dove il
// Profilo è già nella barra), non mostra nulla.

import { createContext, useContext } from "react";
import Link from "next/link";

interface ProfileChipData {
  enabled: boolean;
  firstName: string | null;
  avatarUrl: string | null;
}

const ProfileChipContext = createContext<ProfileChipData>({ enabled: false, firstName: null, avatarUrl: null });

/**
 * 15/10/2026: true dentro l'area famiglie NEXTGEN con la nuova barra accesa.
 * Usato anche da PageHeader per l'intestazione V2 delle sottopagine.
 */
export function useNavV2(): boolean {
  return useContext(ProfileChipContext).enabled;
}

export function ProfileChipProvider({ value, children }: { value: ProfileChipData; children: React.ReactNode }) {
  return <ProfileChipContext.Provider value={value}>{children}</ProfileChipContext.Provider>;
}

export default function ProfileChip() {
  const { enabled, firstName, avatarUrl } = useContext(ProfileChipContext);
  if (!enabled) return null;
  const initial = (firstName?.trim()[0] ?? "").toUpperCase();
  return (
    <Link
      href="/nextgen/profile"
      aria-label="Profilo e impostazioni"
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center"
    >
      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#ECE8F8] font-poppins text-[15px] font-semibold text-[#4A3F9E] ring-2 ring-white active:scale-95">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- stessa foto dell'avatar in Home
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : initial ? (
          initial
        ) : (
          <i className="ti ti-user text-[18px]" aria-hidden="true" />
        )}
      </span>
    </Link>
  );
}
