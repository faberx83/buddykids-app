import TramaSpinner from "@/components/TramaSpinner";

// TRAMA Sprint 3bis — vedi app/(main)/loading.tsx per la nota sul perché il
// contenitore è passato da h-64 a min-h-[60vh].
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <TramaSpinner size={160} />
    </div>
  );
}
