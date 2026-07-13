import NextgenBadge from "@/components/nextgen/NextgenBadge";

// SPRINT 0 — placeholder Admin. La Control Room vera arriva nello Sprint 5.
export default function NextgenAdminPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">TRAMA Admin</h1>
        <NextgenBadge />
      </div>
      <div className="rounded-2xl border border-[#E8EBF0] bg-white p-5">
        <p className="text-sm text-ink-2">
          Accesso confermato con ruolo platform_admin (guard condiviso con LEGACY).
        </p>
      </div>
      <p className="mt-4 text-xs text-ink-3">La Control Room arriva nello Sprint 5.</p>
    </div>
  );
}
