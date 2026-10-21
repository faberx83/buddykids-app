"use client";

// TRAMA — RICERCA LUOGHI (21/10/2026, release "ricerca-luoghi").
// Campo di testo con suggerimenti mentre scrivi: nome della scuola o del
// posto → nome + indirizzo (Photon/OpenStreetMap, tramite la nostra
// /api/places/search). Si può sempre scrivere a mano: i suggerimenti
// aiutano, non obbligano. Con la release spenta è un campo normale.

import { useEffect, useId, useRef, useState } from "react";
import { MIN_QUERY_LENGTH, placeLocationText, type PlaceSuggestion } from "@/lib/places/search";

export default function PlaceAutocomplete({
  id,
  value,
  onChange,
  onPick,
  pickText = placeLocationText,
  kind = "any",
  enabled,
  placeholder,
  className,
}: {
  id: string;
  value: string;
  onChange: (text: string) => void;
  /** Dopo la scelta (oltre al testo): es. salvare anche le coordinate. */
  onPick?: (place: PlaceSuggestion) => void;
  /** Testo messo nel campo alla scelta (di solito "Nome, indirizzo"). */
  pickText?: (place: PlaceSuggestion) => string;
  kind?: "school" | "any";
  enabled: boolean;
  placeholder?: string;
  className: string;
}) {
  const listId = useId();
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  // Dopo una scelta il testo cambia: non rilanciare subito la ricerca.
  const picked = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const q = value.trim();
    if (q.length < MIN_QUERY_LENGTH || picked.current === value) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/places/search?kind=${kind}&q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const body = (await res.json()) as { suggestions?: PlaceSuggestion[] };
        setItems(body.suggestions ?? []);
        setActive(-1);
        setOpen(true);
      } catch {
        // rete assente o richiesta annullata: resta testo libero
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, kind, enabled]);

  function pick(p: PlaceSuggestion) {
    const text = pickText(p);
    picked.current = text;
    onChange(text);
    onPick?.(p);
    setOpen(false);
    setItems([]);
  }

  const showList = enabled && open && items.length > 0;

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          picked.current = null;
          onChange(e.target.value);
        }}
        onFocus={() => items.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(items[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        role={enabled ? "combobox" : undefined}
        aria-expanded={enabled ? showList : undefined}
        aria-controls={enabled ? listId : undefined}
        aria-autocomplete={enabled ? "list" : undefined}
        className={className}
      />
      {enabled && loading && (
        <i className="ti ti-loader-2 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-[16px] text-ink-3" aria-hidden="true" />
      )}
      {showList && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-[12px] border border-trama-line bg-white shadow-[0_8px_24px_rgba(23,42,77,0.14)]">
          <ul id={listId} role="listbox" data-testid="place-suggestions">
            {items.map((p, i) => (
              <li key={`${p.name}-${p.address}-${i}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                  className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left ${i === active ? "bg-trama-primary-soft" : "active:bg-black/[0.03]"}`}
                >
                  <i className={`ti ${p.kind.startsWith("amenity:school") || p.kind.startsWith("amenity:kindergarten") ? "ti-school" : "ti-map-pin"} mt-0.5 text-[16px] text-ink-3`} aria-hidden="true" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[14.5px] font-semibold text-ink">{p.name}</span>
                    {p.address && <span className="truncate text-[12.5px] text-ink-2">{p.address}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t border-[#F0F2F5] px-3.5 py-1.5 text-[11px] text-ink-3">Indirizzi © OpenStreetMap</p>
        </div>
      )}
    </div>
  );
}
