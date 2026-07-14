import TramaSpinner from "@/components/TramaSpinner";

export default function Loading() {
  return (
    <div className="flex h-64 items-center justify-center">
      {/* Pannello Admin ha sfondo scuro: il mark TRAMA è pensato per sfondi
          chiari (vedi Login), quindi qui va su un piccolo disco bianco per
          restare leggibile senza dover indovinare i colori esatti del PNG. */}
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 p-2">
        <TramaSpinner size={32} />
      </div>
    </div>
  );
}
