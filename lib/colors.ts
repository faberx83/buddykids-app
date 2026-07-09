import { PillColor } from "./types";

export const pillClasses: Record<PillColor, string> = {
  aqua: "bg-aqua-light text-[#1fa88e]",
  orange: "bg-orange-light text-[#d4622a]",
  purple: "bg-purple-light text-[#6b58d4]",
  sky: "bg-sky-light text-[#2a8dc4]",
  green: "bg-green-light text-[#2d8f52]",
};

export const badgeClasses = pillClasses;

// Solo lo sfondo pastello (senza colore testo) — usato per le card "tinta
// per categoria" del Planner in Home (settimana coperta, suggerimenti).
export const lightBgClasses: Record<PillColor, string> = {
  aqua: "bg-aqua-light",
  orange: "bg-orange-light",
  purple: "bg-purple-light",
  sky: "bg-sky-light",
  green: "bg-green-light",
};
