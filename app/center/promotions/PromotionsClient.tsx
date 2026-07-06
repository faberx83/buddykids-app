"use client";

import { useState } from "react";
import { Activity, Promotion, PromotionType } from "@/lib/types";

const weekdayLabels = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì"];

export default function PromotionsClient({
  activities,
  initialPromotions,
}: {
  activities: Activity[];
  initialPromotions: Promotion[];
}) {
  const [items, setItems] = useState(initialPromotions);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<PromotionType>("day_discount");
  const [activityId, setActivityId] = useState(activities[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [discountPercent, setDiscountPercent] = useState(15);
  const [dayOfWeek, setDayOfWeek] = useState(4);

  function toggleActive(id: string) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));
  }

  function removePromotion(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  function addPromotion(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !activityId) return;
    const newPromo: Promotion = {
      id: `promo-${Date.now()}`,
      activityId,
      type,
      label,
      discountPercent,
      dayOfWeek: type === "day_discount" ? dayOfWeek : undefined,
      active: true,
    };
    setItems((prev) => [newPromo, ...prev]);
    setLabel("");
    setShowForm(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Promozioni</h1>
          <p className="text-sm text-ink-2">
            Sconti su giorni specifici della settimana e promo last-minute per riempire i posti
            vuoti
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex-shrink-0 rounded-md bg-sky px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC]"
        >
          + Nuova promo
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={addPromotion}
          className="mb-6 grid gap-4 rounded-lg border border-[#E8EBF0] bg-white p-5 md:grid-cols-2"
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Attività</label>
            <select
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            >
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Tipo promo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PromotionType)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            >
              <option value="day_discount">Sconto su giorno della settimana</option>
              <option value="last_minute">Promo last-minute</option>
            </select>
          </div>

          {type === "day_discount" && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-2">
                Giorno della settimana
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
              >
                {weekdayLabels.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Sconto (%)</label>
            <input
              type="number"
              min={1}
              max={90}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Etichetta</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Es. Venerdì scontato, Ultimi posti disponibili…"
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </div>

          <div className="flex gap-2 md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-sky px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC]"
            >
              Crea promozione
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-[#E8EBF0] px-5 py-2.5 text-sm font-semibold text-ink"
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
              <th className="px-4 py-3 font-medium">Promozione</th>
              <th className="px-4 py-3 font-medium">Attività</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Sconto</th>
              <th className="px-4 py-3 font-medium">Stato</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const activity = activities.find((a) => a.id === p.activityId);
              return (
                <tr key={p.id} className="border-b border-[#F0F2F5] last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{p.label}</td>
                  <td className="px-4 py-3 text-ink-2">{activity?.name}</td>
                  <td className="px-4 py-3 text-ink-2">
                    {p.type === "day_discount"
                      ? `${weekdayLabels[p.dayOfWeek ?? 0]}`
                      : "Last-minute"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-purple">-{p.discountPercent}%</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(p.id)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        p.active ? "bg-green-light text-[#2d8f52]" : "bg-[#F4F6FA] text-ink-3"
                      }`}
                    >
                      {p.active ? "Attiva" : "In pausa"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removePromotion(p.id)}
                      className="text-xs font-medium text-orange"
                    >
                      Elimina
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-ink-2">
                  Nessuna promozione attiva — creane una con il pulsante qui sopra.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
