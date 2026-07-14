import { PillColor } from "./types";

export const pillClasses: Record<PillColor, string> = {
  aqua: "bg-aqua-light text-[#1fa88e]",
  orange: "bg-orange-light text-trama-orange",
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

// Sfondo pieno (colore "DEFAULT", non pastello) + testo bianco — usato per
// elementi selezionati/attivi che devono richiamare il colore accento di un
// bambino (kid.accentColor), es. il chip di selezione bambino nel Planner:
// prima era sempre nero (bg-ink) per qualunque bambino, incoerente con gli
// altri colori per-bambino già usati altrove nell'app (anello avatar in "Per
// bambino", badge match%).
export const solidBgClasses: Record<PillColor, string> = {
  aqua: "bg-aqua text-white",
  orange: "bg-orange text-white",
  purple: "bg-purple text-white",
  sky: "bg-sky text-white",
  green: "bg-green text-white",
};
