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

// v8 (20/10/2026) — Fabrizio: "ancora troppo piccolo, lo vorrei più grande e
// bellino". Logo più grande, scritta TRAMA larga quasi quanto il logo (prima
// metà), un alone morbido con i colori dei fili che "respira" dietro il logo,
// e la scritta che entra con una dissolvenza. Con "riduci movimento": tutto
// fermo (vedi .trama-loader-* in globals.css).
export default function TramaSpinner({
  size = 176,
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
      <span className="relative inline-flex items-center justify-center">
        <span
          aria-hidden="true"
          className="trama-loader-glow pointer-events-none absolute rounded-full"
          style={{ width: size * 1.35, height: size * 1.35, opacity: tone === "white" ? 0.35 : 0.75 }}
        />
        <img src={SRC[tone]} alt="" aria-hidden="true" className="trama-weave relative" style={{ width: size, height: "auto" }} />
      </span>
      {wordmark && (
        <img
          src={WORDMARK[tone]}
          alt=""
          aria-hidden="true"
          className="trama-loader-word relative mt-5"
          style={{ width: Math.round(size * 0.78), height: "auto" }}
        />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}
