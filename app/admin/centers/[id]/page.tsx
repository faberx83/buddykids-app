import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCenterOnboardingState, getOnboardingAuditLog } from "@/lib/onboarding/data";
import {
  getOnboardingStatusLabel,
  getOnboardingStatusBadgeClassName,
  formatOnboardingTransition,
} from "@/lib/onboarding/status-copy";

// PRE-MICRO-PILOT GATE (R-01, task #557, 25/08/2026) — dettaglio operativo
// reale al posto di lib/mock-data.ts (generateStaticParams elencava solo i
// centri finti, quindi un centro reale dava sempre 404 qui). Scope
// deliberatamente minimo su richiesta di Fabrizio ("non serve una nuova
// dashboard analytics"): info centro + attività reali + stato/storico
// attivazione. Il dettaglio prenotazioni resta in /admin/bookings (già
// reale, Sprint 4) — non duplicato qui.
export default async function AdminCenterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured) return notFound();

  const supabase = await createClient();
  const { data: center } = await supabase
    .from("centers")
    .select("id, name, slug, city, address, description, contact_email, contact_phone")
    .eq("id", id)
    .maybeSingle();

  if (!center) return notFound();

  const { data: activities } = await supabase
    .from("activities")
    .select("id, slug, name, price_per_week, rating, reviews_count")
    .eq("center_id", id)
    .order("name", { ascending: true });

  const [onboarding, auditLog] = await Promise.all([
    getCenterOnboardingState(id),
    getOnboardingAuditLog(id),
  ]);

  return (
    <div>
      <Link href="/admin/centers" className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-sky">
        <i className="ti ti-arrow-left" /> Tutti i centri
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* FIX CONTRASTO ADMIN: text-ink==bg-navy, vedi analytics/page.tsx */}
        <h1 className="text-xl font-bold text-white">{center.name}</h1>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getOnboardingStatusBadgeClassName(onboarding.status)}`}
        >
          {getOnboardingStatusLabel(onboarding.status, "admin")}
        </span>
      </div>
      <p className="-mt-4 mb-6 text-sm text-navy-text2">
        {center.city ?? "—"}
        {center.address ? ` · ${center.address}` : ""}
      </p>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Descrizione</div>
          <p className="text-sm text-ink-2">{center.description || "—"}</p>
        </div>
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Contatti</div>
          <div className="space-y-1 text-sm text-ink-2">
            <div>
              <i className="ti ti-mail mr-1.5 text-ink-3" />
              {center.contact_email || "—"}
            </div>
            <div>
              <i className="ti ti-phone mr-1.5 text-ink-3" />
              {center.contact_phone || "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          Attività ({activities?.length ?? 0})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {(activities ?? []).map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{a.name}</div>
                <div className="text-xs text-ink-2">€{a.price_per_week}/settimana</div>
              </div>
              {a.reviews_count > 0 && (
                <span className="text-xs font-semibold text-ink-2">
                  ⭐ {a.rating} ({a.reviews_count})
                </span>
              )}
            </div>
          ))}
          {(activities ?? []).length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-ink-2">Nessuna attività per questo centro.</div>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">Storico attivazione</div>
        <div className="divide-y divide-[#F0F2F5]">
          {auditLog.length === 0 && (
            <div className="px-4 py-4 text-sm text-ink-2">
              Nessuno storico: centro creato prima dell&apos;introduzione del percorso di attivazione (trattato come{" "}
              {getOnboardingStatusLabel("APPROVED", "admin")}).
            </div>
          )}
          {auditLog.map((entry) => (
            <div key={entry.id} className="px-4 py-3 text-sm text-ink-2">
              <span className="font-medium text-ink">
                {formatOnboardingTransition(entry.fromStatus, entry.toStatus, "admin")}
              </span>
              <span className="ml-2 text-xs text-ink-3">{new Date(entry.createdAt).toLocaleString("it-IT")}</span>
              {entry.note && <div className="mt-1 text-xs text-ink-3">{entry.note}</div>}
            </div>
          ))}
        </div>
      </div>

      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-1 text-xs font-semibold text-sky"
      >
        Vedi le prenotazioni di tutti i centri →
      </Link>
    </div>
  );
}
