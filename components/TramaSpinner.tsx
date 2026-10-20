// TRAMA Sprint 3bis (v4) — dopo due tentativi di animare i "fili" separati
// (bob verticale scartato, poi fili vettorializzati dal PNG con potrace
// rivelatisi rotti a schermo: "l'immagine è tutta rotta"), si torna al logo
// PIENO (public/brand/trama-logo-mark.png) come unica immagine — zero rischio
// di artefatti — centrato, grande, con zoom + dissolvenza (vedi
// .trama-spinner/tramaZoomFade in globals.css) invece del respiro quasi
// impercettibile della primissima versione.
//
// v5 — richiesta di Fabrizio dopo il giro loghi Partner/Admin: lo spinner
// deve seguire lo stesso colore del marchio del pannello in cui compare
// (navy su Partner, white su Admin — sfondo già navy lì, niente più disco
// bianco di appoggio), non restare sempre a colori. "tone" sceglie l'asset
// (stessa sagoma di BrandMark in DashboardLayout.tsx), default "color" per
// il tenant famiglia (invariato).
const SRC: Record<"color" | "navy" | "white", string> = {
  color: "/brand/trama-logo-mark.png",
  navy: "/brand/trama-logo-mark-navy.png",
  white: "/brand/trama-logo-mark-white.png",
};

// v6 (16/10/2026) — Fabrizio: "vuoi mettere il logo che fa qualche
// animazione? E utilizzarlo su pagine che si stanno caricando?". Stesso logo
// pieno, nuova animazione "si tesse" (.trama-weave in globals.css: maschera
// in diagonale che lo svela, poi sfuma). Usato da tutte le schermate di
// caricamento (famiglie V1 e V2, Partner, Admin, trasloco di dominio).
// role="status" + testo nascosto: chi usa un lettore di schermo sente
// "Caricamento".
// v7 (20/10/2026) — Fabrizio: "logo più grande, o wordmark sotto". Sotto il
// logo che si tesse c'è la scritta TRAMA, ferma (si legge sempre), larga
// circa metà del logo. Stesso colore del pannello (navy su Partner, bianca
// su Admin). `wordmark={false}` per i punti dove il nome è già scritto
// accanto (es. il trasloco di dominio).
const WORDMARK: Record<"color" | "navy" | "white", string> = {
  color: "/brand/trama-wordmark.png",
  navy: "/brand/trama-wordmark.png",
  white: "/brand/trama-wordmark-white.png",
};

// v9 (20/10/2026, Fabrizio: "l'alone sotto non mi piace… sfondo beigiolino
// e logo e wordmark ancora più grandi"). Niente alone: logo grande (il fondo
// beige a schermo intero lo mettono le pagine loading.tsx, vedi
// LOADER_SCREEN qui sotto) e scritta TRAMA larga quasi quanto il logo, che
// entra con una dissolvenza. Con "riduci movimento": tutto fermo.

/** Schermo del caricamento nelle app famiglie e Partner: beige caldo, a tutto schermo. */
export const LOADER_SCREEN = "fixed inset-0 z-[80] flex items-center justify-center bg-[#F5EFE5]";

export default function TramaSpinner({
  size = 220,
  tone = "color",
  label = "Caricamento",
  wordmark = true,
}: {
  size?: number;
  tone?: "color" | "navy" | "white";
  label?: string;
  wordmark?: boolean;
}) {
  return (
    <span role="status" className="relative inline-flex flex-col items-center" data-testid="trama-loader">
      <img src={SRC[tone]} alt="" aria-hidden="true" className="trama-weave relative" style={{ width: size, height: "auto" }} />
      {wordmark && (
        <img
          src={WORDMARK[tone]}
          alt=""
          aria-hidden="true"
          className="trama-loader-word relative mt-6"
          style={{ width: Math.round(size * 0.8), height: "auto" }}
        />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}
