// TRAMA Sprint 3 — spinner di caricamento con la grafica del logo, al posto
// della rotellina generica (border + animate-spin) usata finora in tutti i
// loading.tsx delle route. Richiesta di Fabrizio: "ogni rotellina di
// caricamento sull'app deve riportare una grafica del logo animata".
export default function TramaSpinner({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/brand/trama-logo-mark.png"
      alt=""
      aria-hidden="true"
      className="trama-spinner"
      style={{ width: size, height: size }}
    />
  );
}
