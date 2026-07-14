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

export default function TramaSpinner({
  size = 160,
  tone = "color",
}: {
  size?: number;
  tone?: "color" | "navy" | "white";
}) {
  return (
    <img
      src={SRC[tone]}
      alt=""
      aria-hidden="true"
      className="trama-spinner"
      style={{ width: size, height: "auto" }}
    />
  );
}
