"use client";

// TRAMA — UNA SOLA "SCUOLA" PER FIGLIO (ritest del 22/10/2026, Fabrizio:
// "non ha senso lo stesso form che mettiamo sugli impegni ricorrenti, forse è
// ridondante"). Dietro PARENT_UX_FIX_ENABLED, nella scheda del figlio (La tua
// famiglia, V2), al posto di due posti diversi:
//   - "Calendario della scuola" (Regione + Comune → kid_school_profiles);
//   - "Orario della scuola" (nome, indirizzo, entrata, uscita, giorni →
//     impegno ricorrente con role "school", release settimana-tipo).
// Un solo modulo: si cerca la scuola per nome e Comune e Regione arrivano da
// soli (Photon/OpenStreetMap); se la scuola non si trova, bastano Regione e
// Comune; gli orari sono facoltativi e compaiono solo con la settimana tipo
// accesa. I dati restano dove erano (nessuna migrazione): un salvataggio
// scrive il calendario e, se ci sono, gli orari.
// Logica pura in lib/nextgen/parent-ux-fix.ts (regionFromPlace,
// siblingSchools); test in tests/one/parent-ux-fix.spec.ts.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PlaceAutocomplete from "@/components/nextgen/PlaceAutocomplete";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import type { SchoolHoursItem } from "@/components/nextgen/SchoolHoursBlock";
import { setSchoolContextForKidAction } from "@/app/actions/school-calendar";
import {
  createExternalPlannerItemAction,
  deleteExternalPlannerItemAction,
  updateExternalPlannerItemAction,
} from "@/app/actions/external-planner-items";
import { ITALIAN_REGIONS } from "@/lib/school-calendar/regions";
import type { KidSchoolProfileSummary } from "@/lib/data/school-calendar";
import { mondayOfIso, recurrenceLabel, schoolYearRange, WEEKDAY_LABELS_IT } from "@/lib/planner/recurrence";
import type { ExternalPlannerItemInput } from "@/lib/planner/external-planner-items-core";
import { addressBelongsTo, regionFromPlace, type SiblingSchool } from "@/lib/nextgen/parent-ux-fix";

function hhmm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "";
}

const LABEL = "flex flex-col gap-1.5 text-[13.5px] font-semibold text-ink";

export default function KidSchoolBlock({
  kid,
  profile,
  schoolItem,
  siblings,
  siblingItems,
  routineEnabled,
  placeSearchEnabled,
  residenceCity,
  todayIso,
  initialEditing = false,
  inputCls,
}: {
  kid: { id: string; name: string };
  profile: KidSchoolProfileSummary | undefined;
  /** Orario della scuola di questo figlio (settimana tipo), se c'è. */
  schoolItem: SchoolHoursItem | null;
  siblings: SiblingSchool[];
  siblingItems: Record<string, SchoolHoursItem | null>;
  /** Settimana tipo accesa: si possono indicare entrata, uscita e giorni. */
  routineEnabled: boolean;
  placeSearchEnabled: boolean;
  residenceCity: string | null;
  todayIso: string;
  initialEditing?: boolean;
  inputCls: string;
}) {
  const router = useRouter();
  const showToast = useNextgenToast();
  const [editing, setEditing] = useState(initialEditing);
  useEffect(() => {
    if (initialEditing) document.getElementById(`kid-school-${kid.id}`)?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una volta, all'apertura da ?scuola=
  }, []);

  const savedName = schoolItem && schoolItem.title !== "Scuola" ? schoolItem.title : "";
  const [name, setName] = useState(savedName);
  const [address, setAddress] = useState(schoolItem?.location ?? "");
  // Secondo test UX (22/10, UX-PARENT-017): l'indirizzo appartiene a un nome
  // preciso (scelto dalla ricerca, copiato da un fratello o già salvato). Se
  // il nome cambia a mano, l'indirizzo vecchio si toglie: mai "Scuola Demo"
  // con l'indirizzo della Pizzigoni. Logica in lib/nextgen/parent-ux-fix.ts.
  const [addressFor, setAddressFor] = useState(savedName);
  const [addressRemoved, setAddressRemoved] = useState(false);
  // UX-PARENT-018: "Usa questo nome" (scuola non trovata) → Regione e Comune a mano.
  const [typedKept, setTypedKept] = useState(false);
  const [place, setPlace] = useState<{ lat: number; lng: number } | null>(schoolItem?.place ?? null);
  const [region, setRegion] = useState(profile?.region ?? "");
  const [comune, setComune] = useState(profile?.comune ?? "");
  const [fromSearch, setFromSearch] = useState(false);
  // Ritest 22/10 (prova 17): dopo "Stessa scuola di Luca" la ricerca si salta: riepilogo e "Cambia".
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);
  const [withHours, setWithHours] = useState(Boolean(schoolItem));
  const [entry, setEntry] = useState(hhmm(schoolItem?.startTime) || "08:30");
  const [exit, setExit] = useState(hhmm(schoolItem?.endTime) || "16:30");
  const [weekdays, setWeekdays] = useState<number[]>(schoolItem?.recurrence?.weekdays ?? [1, 2, 3, 4, 5]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetDraft() {
    setName(savedName);
    setAddress(schoolItem?.location ?? "");
    setAddressFor(savedName);
    setAddressRemoved(false);
    setTypedKept(false);
    setPlace(schoolItem?.place ?? null);
    setRegion(profile?.region ?? "");
    setComune(profile?.comune ?? "");
    setFromSearch(false);
    setCopiedFrom(null);
    setWithHours(Boolean(schoolItem));
    setEntry(hhmm(schoolItem?.startTime) || "08:30");
    setExit(hhmm(schoolItem?.endTime) || "16:30");
    setWeekdays(schoolItem?.recurrence?.weekdays ?? [1, 2, 3, 4, 5]);
    setError(null);
  }

  function copyFrom(s: SiblingSchool) {
    setRegion(s.region);
    setComune(s.comune ?? "");
    const it = siblingItems[s.kidId];
    if (it) {
      setName(it.title !== "Scuola" ? it.title : "");
      setAddress(it.location ?? "");
      setAddressFor(it.title !== "Scuola" ? it.title : "");
      setPlace(it.place ?? null);
      if (routineEnabled) {
        setWithHours(true);
        setEntry(hhmm(it.startTime) || entry);
        setExit(hhmm(it.endTime) || exit);
        setWeekdays(it.recurrence?.weekdays ?? weekdays);
      }
    } else {
      setName(s.schoolName && s.schoolName !== "Scuola" ? s.schoolName : "");
      setAddress("");
      setPlace(null);
      setAddressFor("");
    }
    setAddressRemoved(false);
    setTypedKept(false);
    setFromSearch(false);
    setCopiedFrom(s.kidName);
    setError(null);
  }

  const toggleDay = (d: number) => setWeekdays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b)));

  async function save() {
    setError(null);
    if (!region) return setError("Scegli la regione, oppure cerca la scuola per nome.");
    if (withHours && routineEnabled) {
      if (weekdays.length === 0) return setError("Scegli almeno un giorno di scuola.");
      if (!entry || !exit || exit <= entry) return setError("L'uscita deve essere dopo l'entrata.");
    }
    setBusy(true);
    const cal = await setSchoolContextForKidAction(kid.id, region, comune);
    if (cal.error) {
      setBusy(false);
      return setError(cal.error);
    }
    if (routineEnabled) {
      if (withHours) {
        const year = schoolYearRange(todayIso);
        const input: ExternalPlannerItemInput = {
          kind: "commitment",
          title: name.trim() || "Scuola",
          startDate: year.startDate,
          endDate: year.endDate,
          allDay: false,
          startTime: entry,
          endTime: exit,
          location: address.trim() || null,
          notes: null,
          externalUrl: null,
          kidIds: [kid.id],
          place,
          recurrence: { freq: "weekly", weekdays, interval: 1, anchor: mondayOfIso(year.startDate) },
          isSchool: true,
        };
        const res = schoolItem ? await updateExternalPlannerItemAction(schoolItem.id, input) : await createExternalPlannerItemAction(input);
        if (res.error) {
          setBusy(false);
          return setError(`Calendario salvato, orari no: ${res.error}`);
        }
      } else if (schoolItem) {
        const res = await deleteExternalPlannerItemAction(schoolItem.id);
        if (res.error) {
          setBusy(false);
          return setError(`Calendario salvato, orari no: ${res.error}`);
        }
      }
    }
    setBusy(false);
    setEditing(false);
    showToast(`Scuola di ${kid.name} salvata`);
    router.refresh();
  }

  const hoursLine =
    schoolItem && routineEnabled
      ? `${(recurrenceLabel(schoolItem.recurrence) ?? "").replace(/^./, (c) => c.toUpperCase())} · ${hhmm(schoolItem.startTime)}–${hhmm(schoolItem.endTime)}`
      : null;

  return (
    <section id={`kid-school-${kid.id}`} aria-labelledby={`kid-school-h-${kid.id}`} data-testid="kid-school-unified" className="mt-4 border-t border-[#F0F2F5] pt-4">
      <h3 id={`kid-school-h-${kid.id}`} className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <i className="ti ti-school text-[18px] text-trama-navy" aria-hidden="true" />
        Scuola
      </h3>

      {!editing ? (
        profile ? (
          <div className="mt-2 flex items-start justify-between gap-3">
            <span className="flex min-w-0 flex-col gap-0.5">
              {savedName && <span className="truncate text-[14.5px] font-semibold text-ink">{savedName}</span>}
              <span className="truncate text-[14px] text-ink">{profile.comune ? `${profile.comune} · ${profile.region}` : profile.region}</span>
              {hoursLine && <span className="text-[13px] text-ink-2">{hoursLine}</span>}
              <span className={`text-[12.5px] ${profile.calendarAvailable ? "text-[#146B4F]" : "text-ink-2"}`}>
                {profile.calendarAvailable
                  ? `Ponti e vacanze ${profile.academicYearShort} nel Planner`
                  : "Calendario di questa regione non ancora disponibile"}
              </span>
            </span>
            <button type="button" onClick={() => setEditing(true)} className="flex min-h-[44px] flex-shrink-0 items-center text-[14px] font-semibold text-trama-accent-ink">
              Modifica
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[13.5px] leading-snug text-ink-2">
              {schoolItem
                ? `Manca il Comune della scuola: ponti e vacanze di ${kid.name} non sono nel Planner.`
                : `Non ancora indicata: ponti e vacanze di ${kid.name} non sono nel Planner.`}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex min-h-[44px] flex-shrink-0 items-center rounded-[12px] border border-[#D9DDE5] bg-white px-3.5 text-[14px] font-semibold text-trama-primary"
            >
              Indica
            </button>
          </div>
        )
      ) : (
        <div className="mt-2 flex flex-col gap-3.5" data-testid="kid-school-form">
          {siblings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {siblings.map((s) => (
                <button
                  key={s.kidId}
                  type="button"
                  onClick={() => copyFrom(s)}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#E3E6EC] bg-white px-3.5 text-[13.5px] font-semibold text-ink active:bg-black/[0.03]"
                >
                  <i className="ti ti-copy text-[15px]" aria-hidden="true" />
                  Stessa scuola di {s.kidName}
                </button>
              ))}
            </div>
          )}

          {copiedFrom ? (
            <div data-testid="kid-school-copied" className="flex items-start justify-between gap-3 rounded-[12px] bg-[#E6F6F0] px-3.5 py-3 text-[13.5px] text-[#146B4F]">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold">Stessa scuola di {copiedFrom}</span>
                {name.trim() && <span className="truncate text-ink">{name}</span>}
                <span className="text-ink">{comune ? `${comune} · ${region}` : region}</span>
                {withHours && routineEnabled && (
                  <span className="text-ink-2">
                    {weekdays.map((d) => WEEKDAY_LABELS_IT[d].short).join(", ")} · {entry}–{exit}
                  </span>
                )}
              </span>
              <button type="button" onClick={() => setCopiedFrom(null)} className="min-h-[36px] flex-shrink-0 font-semibold text-trama-accent-ink">
                Cambia
              </button>
            </div>
          ) : (
            <>
          <div className={LABEL}>
            <label htmlFor={`kid-school-name-${kid.id}`}>
              {placeSearchEnabled ? "Cerca la scuola" : "Nome della scuola"}{" "}
              <span className="font-normal text-ink-2">{routineEnabled ? "(facoltativo)" : "(facoltativo, serve a trovare il Comune)"}</span>
            </label>
            <PlaceAutocomplete
              id={`kid-school-name-${kid.id}`}
              kind="school"
              enabled={placeSearchEnabled}
              value={name}
              onChange={(text) => {
                setName(text);
                setFromSearch(false);
                setTypedKept(false);
                if (addressBelongsTo(address, addressFor, text)) return;
                if (address) setAddressRemoved(true);
                setAddress("");
                setPlace(null);
              }}
              pickText={(p) => p.name}
              strictZone={{ city: comune || residenceCity, region }}
              onUseTyped={() => {
                setAddress("");
                setPlace(null);
                setAddressFor("");
                setFromSearch(false);
                setTypedKept(true);
              }}
              onPick={(p) => {
                setAddress(p.address);
                setAddressFor(p.name);
                setAddressRemoved(false);
                setTypedKept(false);
                setPlace({ lat: p.lat, lng: p.lng });
                const r = regionFromPlace(p.region, ITALIAN_REGIONS);
                if (r) setRegion(r);
                if (p.city) setComune(p.city);
                setFromSearch(Boolean(r && p.city));
              }}
              placeholder="Es. Scuola primaria Pizzigoni"
              className={`${inputCls} w-full font-normal`}
            />
            {address && <span className="text-[12.5px] font-normal text-ink-2">{address}</span>}
            {addressRemoved && !address && (
              <span data-testid="kid-school-address-removed" className="text-[12.5px] font-normal leading-snug text-ink-2">
                Hai cambiato scuola. L&apos;indirizzo precedente è stato rimosso. Regione e Comune restano modificabili qui sotto.
              </span>
            )}
            {typedKept && (
              <span data-testid="kid-school-typed-kept" className="text-[12.5px] font-normal leading-snug text-[#146B4F]">
                Va bene «{name.trim()}». Indica Regione e Comune qui sotto: servono per ponti e vacanze.
              </span>
            )}
          </div>

          {fromSearch ? (
            <p data-testid="kid-school-from-search" className="flex items-center justify-between gap-3 rounded-[12px] bg-[#E6F6F0] px-3.5 py-2.5 text-[13.5px] text-[#146B4F]">
              <span>
                Calendario di <b>{comune}</b> ({region})
              </span>
              <button type="button" onClick={() => setFromSearch(false)} className="min-h-[36px] flex-shrink-0 font-semibold text-trama-accent-ink">
                Cambia
              </button>
            </p>
          ) : (
            <>
              <p className="text-[13px] leading-snug text-ink-2">
                Per ponti e vacanze bastano Regione e Comune della scuola{placeSearchEnabled ? ": se la cerchi qui sopra, li mettiamo noi" : ""}.
              </p>
              <label className={LABEL}>
                Regione
                <select value={region} onChange={(e: { target: { value: string } }) => setRegion(e.target.value)} className={`${inputCls} font-normal`}>
                  <option value="">Scegli la regione</option>
                  {ITALIAN_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className={LABEL}>
                Comune della scuola
                <input
                  value={comune}
                  onChange={(e: { target: { value: string } }) => setComune(e.target.value)}
                  placeholder="Es. Milano"
                  className={`${inputCls} font-normal`}
                />
              </label>
              {residenceCity && comune.trim().toLowerCase() !== residenceCity.trim().toLowerCase() && (
                <button type="button" onClick={() => setComune(residenceCity)} className="-mt-1.5 flex min-h-[40px] w-fit items-center text-[13.5px] font-semibold text-trama-accent-ink">
                  Usa il mio Comune ({residenceCity})
                </button>
              )}
            </>
          )}

            </>
          )}

          {routineEnabled && (
            <div className="flex flex-col gap-3 rounded-[14px] border border-trama-line p-3.5">
              <label className="flex items-center justify-between gap-3 text-[14px] font-semibold text-ink">
                Orari della scuola
                <input
                  type="checkbox"
                  role="switch"
                  checked={withHours}
                  onChange={(e: { target: { checked: boolean } }) => setWithHours(e.target.checked)}
                  className="h-5 w-5 accent-[#172A4D]"
                />
              </label>
              {withHours ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-[12.5px] text-ink-2">Entrata</span>
                      <input type="time" value={entry} onChange={(e: { target: { value: string } }) => setEntry(e.target.value)} className={`${inputCls} w-full`} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12.5px] text-ink-2">Uscita</span>
                      <input type="time" value={exit} onChange={(e: { target: { value: string } }) => setExit(e.target.value)} className={`${inputCls} w-full`} />
                    </label>
                  </div>
                  <div className="flex justify-between gap-1" role="group" aria-label="Giorni di scuola">
                    {[1, 2, 3, 4, 5, 6].map((d) => {
                      const on = weekdays.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={on}
                          aria-label={WEEKDAY_LABELS_IT[d].long}
                          onClick={() => toggleDay(d)}
                          className={`flex h-11 w-11 items-center justify-center rounded-full border text-[14px] font-semibold ${
                            on ? "border-trama-primary bg-trama-primary text-white" : "border-[#E3E6EC] bg-white text-ink"
                          }`}
                        >
                          {WEEKDAY_LABELS_IT[d].letter}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[12.5px] leading-snug text-ink-2">Nel Planner la scuola è una riga discreta e sparisce nei giorni di chiusura.</span>
                </>
              ) : (
                <span className="text-[12.5px] leading-snug text-ink-2">Facoltativi: entrata, uscita e giorni, se vuoi vedere la scuola nella giornata.</span>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-[13px] font-medium text-[#B3261E]">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                resetDraft();
                setEditing(false);
              }}
              disabled={busy}
              className="min-h-[48px] flex-1 rounded-[12px] border border-[#D9DDE5] bg-white px-4 text-[15px] font-semibold text-trama-primary disabled:opacity-60"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="min-h-[48px] flex-[2] rounded-[12px] bg-trama-primary px-4 text-[15px] font-semibold text-white active:bg-trama-primary-press disabled:opacity-60"
            >
              {busy ? "Salvo…" : "Salva scuola"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
