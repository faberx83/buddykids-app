// TRAMA Sprint 3bis (v4) — dopo due tentativi di animare i "fili" separati
// (bob verticale scartato, poi fili vettorializzati dal PNG con potrace
// rivelatisi rotti a schermo: "l'immagine è tutta rotta"), si torna al logo
// PIENO (public/brand/trama-logo-mark.png) come unica immagine — zero rischio
// di artefatti — centrato, grande, con zoom + dissolvenza (vedi
// .trama-spinner/tramaZoomFade in globals.css) invece del respiro quasi
// impercettibile della primissima versione.
export default function TramaSpinner({ size = 160 }: { size?: number }) {
  return (
    <img
      src="/brand/trama-logo-mark.png"
      alt=""
      aria-hidden="true"
      className="trama-spinner"
      style={{ width: size, height: "auto" }}
    />
  );
}
