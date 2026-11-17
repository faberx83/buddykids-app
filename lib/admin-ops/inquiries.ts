// TRAMA — ADMIN OPERATIVO (12/11/2026). Richiesta di Fabrizio: "In Richieste
// SLA e Segnalazioni collega gli aggregati ai singoli casi". Iniziativa:
// claude/INIZIATIVA_admin_operativo.md.
//
// Messaggi famiglia → centro ("Contatta il gestore", activity_inquiries):
// filtri da URL condivisi tra la card di "Oggi", la tabella per centro e
// l'elenco dei singoli casi in /admin/richieste. Pura.

import { daysBetween, type Actor } from "@/lib/admin-ops/bookings";
import { isDemoRecord } from "@/lib/admin-ops/demo";
import { NO_TEST_ACCOUNTS, isTestAccount, type TestAccountIds } from "@/lib/admin-ops/test-accounts";

export type InquiryStatus = "aperta" | "risposta" | "chiusa";

export interface AdminInquiryRow {
  id: string;
  status: InquiryStatus;
  createdAt: string;
  repliedAt: string | null;
  lastMessageAt: string | null;
  centerId: string | null;
  centerName: string;
  centerIsTestFixture: boolean;
  activityId: string | null;
  activityName: string;
  /** 17/11/2026: per riconoscere gli account di prova. */
  parentId?: string | null;
  parentName: string;
  message: string;
  reply: string | null;
}

export interface InquiryFilters {
  centro: string;
  stato: InquiryStatus | "tutte";
  demo: boolean;
}

export interface AdminInquiryView {
  row: AdminInquiryRow;
  isDemo: boolean;
  ageDays: number;
  actor: Actor | null;
  nextStep: string | null;
  responseHours: number | null;
}

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => {
  const v = sp[k];
  return (Array.isArray(v) ? v[0] : v) ?? "";
};

export function parseInquiryFilters(sp: SP): InquiryFilters {
  const stato = one(sp, "stato");
  return {
    centro: one(sp, "centro"),
    stato: stato === "aperta" || stato === "risposta" || stato === "chiusa" ? stato : "tutte",
    demo: one(sp, "demo") === "1",
  };
}

export function inquiriesHref(f: Partial<InquiryFilters>): string {
  const p = new URLSearchParams();
  if (f.centro) p.set("centro", f.centro);
  if (f.stato && f.stato !== "tutte") p.set("stato", f.stato);
  if (f.demo) p.set("demo", "1");
  const s = p.toString();
  return `/admin/richieste${s ? `?${s}` : ""}#casi`;
}

export function viewInquiry(r: AdminInquiryRow, todayIso: string, testAccounts: TestAccountIds = NO_TEST_ACCOUNTS): AdminInquiryView {
  const ageDays = Math.max(0, daysBetween(r.createdAt, todayIso));
  const open = r.status === "aperta";
  const responseHours =
    r.repliedAt && r.createdAt ? Math.max(0, (Date.parse(r.repliedAt) - Date.parse(r.createdAt)) / 3600000) : null;
  return {
    row: r,
    isDemo: isDemoRecord({
      centerName: r.centerName,
      centerIsTestFixture: r.centerIsTestFixture,
      activityName: r.activityName,
      accountIsTest: isTestAccount(r.parentId, testAccounts),
    }),
    ageDays,
    actor: open ? "centro" : null,
    nextStep: open ? (ageDays >= 2 ? "Sollecitare il centro a rispondere" : "Il centro risponde alla famiglia") : null,
    responseHours,
  };
}

export function filterInquiries(views: AdminInquiryView[], f: InquiryFilters): AdminInquiryView[] {
  return views.filter(
    (v) => (f.demo || !v.isDemo) && (!f.centro || v.row.centerId === f.centro) && (f.stato === "tutte" || v.row.status === f.stato)
  );
}

export interface CenterInquiryAggregate {
  centerId: string;
  centerName: string;
  total: number;
  open: number;
  oldestOpenDays: number | null;
  avgResponseHours: number | null;
}

/** Aggregato per centro calcolato dalle STESSE viste filtrate dell'elenco. */
export function aggregateByCenter(views: AdminInquiryView[]): CenterInquiryAggregate[] {
  const map = new Map<string, CenterInquiryAggregate & { _sum: number; _n: number }>();
  for (const v of views) {
    const id = v.row.centerId ?? "—";
    const a = map.get(id) ?? { centerId: id, centerName: v.row.centerName, total: 0, open: 0, oldestOpenDays: null, avgResponseHours: null, _sum: 0, _n: 0 };
    a.total += 1;
    if (v.row.status === "aperta") {
      a.open += 1;
      a.oldestOpenDays = Math.max(a.oldestOpenDays ?? 0, v.ageDays);
    }
    if (v.responseHours !== null) {
      a._sum += v.responseHours;
      a._n += 1;
    }
    map.set(id, a);
  }
  return [...map.values()]
    .map(({ _sum, _n, ...a }) => ({ ...a, avgResponseHours: _n > 0 ? _sum / _n : null }))
    .sort((a, b) => b.open - a.open || b.total - a.total);
}
