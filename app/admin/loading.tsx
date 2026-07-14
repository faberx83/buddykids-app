import TramaSpinner from "@/components/TramaSpinner";

// TRAMA Sprint 3bis — vedi app/(main)/loading.tsx per la nota sul perché il
// contenitore è passato da h-64 a min-h-[60vh]; il disco bianco cresce in
// proporzione, i fili restano leggibili su sfondo scuro.
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      {/* Pannello Admin ha sfondo scuro: i fili SVG sono pensati per sfondi
          chiari (vedi Login), quindi qui vanno su un disco bianco per
          restare leggibili. */}
      <div className="flex h-52 w-52 items-center justify-center rounded-full bg-white/90 p-6">
        <TramaSpinner size={140} />
      </div>
    </div>
  );
}
