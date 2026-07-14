// TRAMA Sprint 3bis — richiesta di Fabrizio dopo aver visto il primo spinner
// (semplice respiro scala+opacità sul PNG piatto): "vorrei una animazione con
// i fili del logo che si muovono... ogni filo si 'tesse' avanti e indietro in
// sequenza" — per richiamare letteralmente il significato di trama/tessitura.
// Il PNG del mark (public/brand/trama-logo-mark.png) è un'immagine piatta,
// senza fili separati da poter animare singolarmente: qui i 5 fili sono
// ridisegnati come <path> SVG indipendenti (stessa palette del brand), così
// ognuno può oscillare con un animation-delay proprio (vedi .trama-thread in
// globals.css) e il movimento attraversa i fili in sequenza invece di
// muoversi tutti insieme. Di default molto più grande del primo spinner
// (era 40px) per essere il fulcro centrale della schermata di caricamento,
// non un dettaglio piccolo in un angolo.
export default function TramaSpinner({ size = 140 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 240 160"
      width={size}
      height={(size * 160) / 240}
      role="img"
      aria-label="Caricamento in corso"
    >
      <path
        className="trama-thread"
        d="M18,26 C75,8 150,55 222,32"
        fill="none"
        stroke="#F66B5E"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        className="trama-thread"
        d="M12,52 C70,78 165,18 228,50"
        fill="none"
        stroke="#6F63C5"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        className="trama-thread"
        d="M16,78 C85,42 150,96 224,70"
        fill="none"
        stroke="#F6A623"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        className="trama-thread"
        d="M24,104 C80,128 158,58 212,98"
        fill="none"
        stroke="#2DBA8C"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        className="trama-thread"
        d="M58,132 C95,152 138,112 176,134"
        fill="none"
        stroke="#B7A4E3"
        strokeWidth="11"
        strokeLinecap="round"
      />
    </svg>
  );
}
