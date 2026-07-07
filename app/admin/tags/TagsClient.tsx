"use client";

import { useState } from "react";
import { Tag } from "@/lib/types";

function slugify(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const swatchOptions = [
  "#E3F9F5",
  "#FFF0EA",
  "#F0EEFF",
  "#E8F6FD",
  "#E8F9EE",
  "#FFF8E7",
];

export default function TagsClient({ initialTags }: { initialTags: Tag[] }) {
  const [tags, setTags] = useState(initialTags);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("🏷️");
  const [bg, setBg] = useState(swatchOptions[0]);

  function addTag(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    const id = slugify(label);
    if (tags.some((t) => t.id === id)) return;
    setTags((prev) => [...prev, { id, label: label.trim(), emoji, bg }]);
    setLabel("");
    setEmoji("🏷️");
    setShowForm(false);
  }

  function removeTag(id: string) {
    setTags((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Tag piattaforma</h1>
          <p className="text-sm text-ink-2">
            Lista master dei tag che i centri possono assegnare alle proprie attività (es.
            sportivo, musica, piscina…)
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex-shrink-0 rounded-md bg-sky px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC]"
        >
          + Nuovo tag
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={addTag}
          className="mb-6 grid gap-4 rounded-lg border border-[#E8EBF0] bg-white p-5 md:grid-cols-3"
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Nome tag</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Es. Avventura"
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Emoji</label>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Colore</label>
            <div className="flex items-center gap-1.5">
              {swatchOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBg(c)}
                  className={`h-7 w-7 rounded-full border-2 ${bg === c ? "border-sky" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 md:col-span-3">
            <button
              type="submit"
              className="rounded-md bg-sky px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC]"
            >
              Crea tag
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

      <div className="flex flex-wrap gap-2.5">
        {tags.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold"
            style={{ background: t.bg }}
          >
            <span>{t.emoji}</span>
            <span className="text-ink">{t.label}</span>
            <button
              type="button"
              onClick={() => removeTag(t.id)}
              className="ml-1 text-ink-3 hover:text-orange"
              title="Elimina tag"
            >
              <i className="ti ti-x text-xs" />
            </button>
          </div>
        ))}
        {tags.length === 0 && (
          <div className="text-sm text-ink-2">Nessun tag — creane uno con il pulsante qui sopra.</div>
        )}
      </div>

      <p className="mt-5 text-[11px] text-ink-3">
        Modifiche demo salvate solo in questa sessione — quando colleghi Supabase aggiorneranno la
        tabella <code className="rounded bg-bg px-1">tags</code>. I centri assegnano i tag alle
        proprie attività dalla pagina di modifica attività.
      </p>
    </div>
  );
}
