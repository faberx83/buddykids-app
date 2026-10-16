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
export default function TramaSpinner({
  size = 160,
  tone = "color",
  label = "Caricamento",
}: {
  size?: number;
  tone?: "color" | "navy" | "white";
  label?: string;
}) {
  return (
    <span role="status" className="inline-flex flex-col items-center" data-testid="trama-loader">
      <img src={SRC[tone]} alt="" aria-hidden="true" className="trama-weave" style={{ width: size, height: "auto" }} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
