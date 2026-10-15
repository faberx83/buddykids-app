// TRAMA — FIGLI NELLO STILE V2 (15/10/2026, Fabrizio: "vanno aggiornate anche
// le icone dei figli, sia avatar che interessi, in linea con il nuovo
// stile"). Niente faccine né emoji: l'avatar è la foto o l'iniziale sulla
// tinta del figlio (stessa di Home e Planner, KID_TONES), gli interessi sono
// un'icona al tratto + la parola.
//
// Gli interessi restano SALVATI come prima ("⚽ Sport": stesso valore usato
// dal matching di Scopri e dalla scheda attività) — qui cambia solo come si
// mostrano. Nessuna migrazione.

/** "⚽ Sport" → "Sport" (toglie emoji e simboli iniziali). */
export function interestLabel(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}]+/u, "").trim() || raw.trim();
}

const ICONS: Record<string, string> = {
  sport: "ti-ball-football",
  piscina: "ti-swimming",
  nuoto: "ti-swimming",
  musica: "ti-music",
  arte: "ti-palette",
  danza: "ti-sparkles",
  natura: "ti-plant-2",
  outdoor: "ti-trees",
  stem: "ti-flask",
  scienza: "ti-flask",
  teatro: "ti-masks-theater",
  tecnologia: "ti-device-laptop",
  lingue: "ti-language",
  inglese: "ti-language",
  cucina: "ti-chef-hat",
  intera: "ti-sun",
  mezza: "ti-clock",
};

/** Icona Tabler per un interesse ("⚽ Sport" o "Sport"); ripiego: stella. */
export function interestIcon(raw: string): string {
  return ICONS[interestLabel(raw).toLowerCase()] ?? "ti-star";
}

/** "Intera"/"Mezza" sono il tipo di giornata, non un interesse: fuori dalle scelte V2. */
export function isKidInterestOption(id: string): boolean {
  return id !== "intera" && id !== "mezza";
}

/** Iniziale per l'avatar senza foto. */
export function kidInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
