// TRAMA — BETA REPORT DETTAGLIATO VIA EMAIL (20/11/2026).
// Fabrizio: "Puoi generare un report strutturato per vedere come va la beta?
// Da ricevere sempre il lunedì?" → "Email da TRAMA con report dettagliato
// grafici motivi e azioni".
//
// ADAPT di lib/data/beta-report-notice.ts (resoconto settimanale già in
// produzione, solo KPI in righe): qui il contenuto completo, costruito dalla
// stessa CockpitView del Beta cockpit. Logica pura, nessun I/O.
//
// Grafici: barre fatte con tabelle e colori in linea (le email non eseguono
// script né caricano immagini con affidabilità). "Motivi": i fatti osservati
// dal cockpit (dove si fermano le famiglie, frizioni); le cause restano da
// chiedere alle famiglie, come dice il cockpit stesso. "Azioni": regole fisse
// che collegano ogni fatto a una mossa concreta.

import type { CockpitView } from "./view";
import type { FrictionKey } from "./model";
import { kpiValueLabel } from "./model";

export interface ReportAction {
  /** Fatto osservato (con il numero). */
  why: string;
  /** Cosa fare, in concreto. */
  action: string;
  /** Dove farlo (pagina Admin o canale). */
  where: string;
  /** Famiglie coinvolte (per l'ordine). */
  families: number;
}

const FRICTION_ACTION: Record<FrictionKey, { action: string; where: string }> = {
  onboarding_incomplete: {
    action: "Manda il sollecito \"Ti mancano 2 minuti\": aggiungere figli e scuola.",
    where: "Beta Famiglie → Frizioni → Solleciti",
  },
  no_commitment: {
    action: "Manda il sollecito \"La tua prima settimana\": aggiungere un impegno al Planner.",
    where: "Beta Famiglie → Frizioni → Solleciti",
  },
  no_second_adult: {
    action: "Manda il sollecito \"Organizzatevi in due\": invitare l'altro genitore.",
    where: "Beta Famiglie → Frizioni → Solleciti",
  },
  partner_invite_pending: {
    action: "Chiedi al genitore che ha invitato di ricordarlo all'altro (l'invito resta valido).",
    where: "WhatsApp, messaggio personale",
  },
  push_off: {
    action: "Nel prossimo sollecito chiedi di attivare le notifiche (Profilo → Notifiche).",
    where: "Email del sollecito",
  },
  saved_not_placed: {
    action: "Ricorda le attività salvate: aggiungerle al Planner o chiederle al centro.",
    where: "Messaggio personale",
  },
  closure_unorganized: {
    action: "Avvisa delle chiusure della scuola in arrivo: è il momento giusto per Scopri.",
    where: "Messaggio personale",
  },
  center_no_reply: {
    action: "Sollecita il centro che non ha risposto, prima che la famiglia si stanchi.",
    where: "Admin → Richieste (SLA)",
  },
  negative_feedback: {
    action: "Leggi le segnalazioni e rispondi entro 48 ore: è il segnale più utile della beta.",
    where: "Beta Famiglie → Feedback",
  },
  abandoned_after_setup: {
    action: "Chiama o scrivi di persona: chiedi cosa non ha funzionato (non un messaggio automatico).",
    where: "Telefono o WhatsApp",
  },
};

/** Azioni consigliate: una per ogni frizione presente, le più diffuse prima (massimo 6). */
export function buildReportActions(view: Pick<CockpitView, "frictions" | "alerts">): ReportAction[] {
  const actions: ReportAction[] = view.frictions
    .filter((f) => f.families.length > 0)
    .map((f) => ({ why: f.label, families: f.families.length, ...FRICTION_ACTION[f.key] }));
  const newFeedback = view.alerts.find((a) => a.key === "new_feedback");
  if (newFeedback && newFeedback.count > 0 && !actions.some((a) => a.where === "Beta Famiglie → Feedback")) {
    actions.push({ why: newFeedback.text, action: "Smista i feedback nuovi (da capire, in lavorazione, risolto).", where: "Beta Famiglie → Feedback", families: newFeedback.count });
  }
  const dormant = view.alerts.find((a) => a.key === "dormant");
  if (dormant && dormant.count > 0) {
    actions.push({ why: dormant.text, action: "Manda il sollecito \"Com'è andata la settimana?\".", where: "Beta Famiglie → Frizioni → Solleciti", families: dormant.count });
  }
  return actions.sort((a, b) => b.families - a.families).slice(0, 6);
}

// ── HTML email ─────────────────────────────────────────────────────────────

const NAVY = "#172A4D";
const GREY = "#5B6478";
const LINE = "#E6E8F0";
const BAR = "#5B4BC4";
const BAR_SOFT = "#ECEAFB";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Barra orizzontale compatibile con le email: due celle di tabella, larghezze in percentuale. */
export function barHtml(value: number, max: number, color = BAR): string {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  const filled = pct === 0 ? "" : `<td style="width:${pct}%;background:${color};height:10px;font-size:0;line-height:0">&nbsp;</td>`;
  const rest = pct === 100 ? "" : `<td style="width:${100 - pct}%;background:${BAR_SOFT};height:10px;font-size:0;line-height:0">&nbsp;</td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:5px;overflow:hidden"><tr>${filled}${rest}</tr></table>`;
}

function section(title: string, body: string, note?: string): string {
  return `<tr><td style="padding:22px 24px 4px"><div style="font-size:16px;font-weight:700;color:${NAVY}">${escapeHtml(title)}</div>${
    note ? `<div style="font-size:12.5px;color:${GREY};margin-top:2px">${escapeHtml(note)}</div>` : ""
  }</td></tr><tr><td style="padding:8px 24px 6px">${body}</td></tr>`;
}

function barRows(items: { label: string; value: number; extra?: string }[], max: number, color?: string): string {
  if (items.length === 0) return `<div style="font-size:13.5px;color:${GREY}">Nessun dato nel periodo.</div>`;
  return items
    .map(
      (i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr>
<td style="font-size:13.5px;color:${NAVY};padding-bottom:3px">${escapeHtml(i.label)}</td>
<td align="right" style="font-size:13.5px;font-weight:700;color:${NAVY};padding-bottom:3px;white-space:nowrap">${i.value}${i.extra ? ` <span style="font-weight:400;color:${GREY}">${escapeHtml(i.extra)}</span>` : ""}</td>
</tr><tr><td colspan="2">${barHtml(i.value, max, color)}</td></tr></table>`
    )
    .join("");
}

function deltaHtml(delta: number | null): string {
  if (delta === null) return "";
  if (delta === 0) return `<span style="color:${GREY}">= sett. prima</span>`;
  const up = delta > 0;
  return `<span style="color:${up ? "#1F9A72" : "#C0392B"}">${up ? "▲" : "▼"} ${up ? "+" : ""}${delta}</span>`;
}

export interface BetaReportEmailInput {
  view: CockpitView;
  rangeLabel: string;
  /** Link al report completo in Admin. */
  link: string;
  /** Righe "Ultimi 7 giorni" già calcolate (account, segnalazioni, prenotazioni…). */
  weekLines: string[];
}

export function buildBetaReportEmail({ view, rangeLabel, link, weekLines }: BetaReportEmailInput): { subject: string; html: string; text: string } {
  const actions = buildReportActions(view);
  const subject = `TRAMA — Beta Report ${rangeLabel}`;

  // KPI: griglia 2 colonne
  const kpiCells = view.kpis.map(
    (k) => `<td width="50%" valign="top" style="padding:6px"><div style="border:1px solid ${LINE};border-radius:12px;padding:12px">
<div style="font-size:12px;color:${GREY}">${escapeHtml(k.label)}</div>
<div style="font-size:22px;font-weight:700;color:${NAVY};margin-top:2px">${escapeHtml(kpiValueLabel(k))}</div>
<div style="font-size:12px;margin-top:2px">${view.comparisonShown ? deltaHtml(k.delta) : ""}</div></div></td>`
  );
  const kpiRows: string[] = [];
  for (let i = 0; i < kpiCells.length; i += 2) kpiRows.push(`<tr>${kpiCells[i]}${kpiCells[i + 1] ?? '<td width="50%"></td>'}</tr>`);
  const kpiHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${kpiRows.join("")}</table>`;

  // Funnel famiglie
  const funnelMax = Math.max(1, ...view.funnel.map((f) => f.reached));
  const funnelHtml = barRows(
    view.funnel.map((f) => ({ label: f.label, value: f.reached, extra: f.stopped > 0 ? `· ${f.stopped} ferme qui` : undefined })),
    funnelMax
  );

  // Prima della registrazione
  const pre = (view.preFunnel ?? []).filter((r) => r.value !== null);
  const preMax = Math.max(1, ...pre.map((r) => r.value as number));
  const preHtml = pre.length ? barRows(pre.map((r) => ({ label: r.label, value: r.value as number })), preMax, "#2DBA8C") : "";

  // Uso per area
  const usage = view.usage.filter((u) => u.families > 0).sort((a, b) => b.families - a.families);
  const usageMax = Math.max(1, ...usage.map((u) => u.families));
  const usageHtml = barRows(
    usage.map((u) => ({ label: u.label, value: u.families, extra: u.repeatFamilies > 0 ? `· ${u.repeatFamilies} tornano` : undefined })),
    usageMax,
    "#F6A623"
  );

  // Motivi: frizioni
  const frictions = view.frictions.filter((f) => f.families.length > 0);
  const frictionHtml = frictions.length
    ? `<ul style="margin:0;padding-left:18px;font-size:13.5px;color:${NAVY}">${frictions
        .map((f) => `<li style="margin-bottom:6px">${escapeHtml(f.label)}${f.trend ? ` <span style="color:${GREY}">(${f.trend > 0 ? "+" : ""}${f.trend} dall'inizio del periodo)</span>` : ""}</li>`)
        .join("")}</ul>`
    : `<div style="font-size:13.5px;color:${GREY}">Nessuna frizione nel periodo.</div>`;

  // Azioni
  const actionsHtml = actions.length
    ? actions
        .map(
          (a, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;border:1px solid ${LINE};border-radius:12px"><tr><td style="padding:12px">
<div style="font-size:12px;color:${GREY}">${i + 1}. Perché: ${escapeHtml(a.why)}</div>
<div style="font-size:14.5px;font-weight:700;color:${NAVY};margin-top:3px">${escapeHtml(a.action)}</div>
<div style="font-size:12.5px;color:${BAR};margin-top:3px">Dove: ${escapeHtml(a.where)}</div></td></tr></table>`
        )
        .join("")
    : `<div style="font-size:13.5px;color:${GREY}">Nessuna azione urgente questa settimana.</div>`;

  // Segnalazioni e domanda
  const fs = view.feedbackSummary;
  const feedbackHtml = `<div style="font-size:13.5px;color:${NAVY}">${view.feedbackInPeriod.length} nel periodo, da ${fs.families} famiglie in tutto · ${fs.byStatus.nuovo ?? 0} ancora da leggere${
    fs.recurring.length ? `<br>Temi ricorrenti: ${fs.recurring.slice(0, 4).map((r) => escapeHtml(`${r.label} (${r.families} fam.)`)).join(", ")}` : ""
  }</div>`;
  const demandHtml = view.topDemand.length
    ? `<ul style="margin:0;padding-left:18px;font-size:13.5px;color:${NAVY}">${view.topDemand
        .slice(0, 3)
        .map((d) => `<li>${escapeHtml(d.label)}${d.locality ? ` · ${escapeHtml(d.locality)}` : ""} — ${d.families} ${d.families === 1 ? "famiglia" : "famiglie"}</li>`)
        .join("")}</ul>`
    : "";

  const summaryHtml = view.summary.lines.length
    ? `<ul style="margin:0;padding-left:18px;font-size:14px;color:${NAVY}">${view.summary.lines.map((l) => `<li style="margin-bottom:4px">${escapeHtml(l)}</li>`).join("")}</ul>`
    : "";
  const weekHtml = weekLines.length ? `<div style="font-size:13.5px;color:${NAVY}">${weekLines.map(escapeHtml).join("<br>")}</div>` : "";

  const html = `<!doctype html><html><body style="margin:0;background:#F6F4EF">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F4EF"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;font-family:-apple-system,Helvetica,Arial,sans-serif;line-height:1.45">
<tr><td style="padding:24px 24px 0"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${BAR};font-weight:700">TRAMA · Beta Report</div>
<div style="font-size:22px;font-weight:700;color:${NAVY};margin-top:4px">${escapeHtml(rangeLabel)}</div></td></tr>
${summaryHtml ? section("In sintesi", summaryHtml) : ""}
${section("Numeri chiave", kpiHtml, view.comparisonShown ? "Frecce: confronto con il periodo precedente." : "Il confronto con la settimana prima compare quando le famiglie sono abbastanza.")}
${section("Azioni consigliate", actionsHtml, "Una per ogni fatto osservato, le più diffuse prima.")}
${section("Dove si fermano le famiglie", funnelHtml, "Famiglie che hanno raggiunto ogni passo; \"ferme qui\" = non sono andate oltre.")}
${preHtml ? section("Prima della registrazione", preHtml, "Unità diverse (visite, richieste, persone): non si confrontano tra loro.") : ""}
${section("Cosa usano", usageHtml, "Famiglie che hanno usato ogni area nel periodo; \"tornano\" = in almeno 2 giorni.")}
${section("Motivi da capire", frictionHtml, "Fatti osservati, non cause: il perché va chiesto alle famiglie.")}
${section("Segnalazioni", feedbackHtml)}
${demandHtml ? section("Attività richieste", demandHtml) : ""}
${weekHtml ? section("Ultimi 7 giorni", weekHtml, "Prove escluse.") : ""}
<tr><td style="padding:18px 24px 26px"><a href="${escapeHtml(link)}" style="display:inline-block;background:${NAVY};color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px;padding:12px 18px;border-radius:12px">Apri il report completo</a>
<div style="font-size:12px;color:${GREY};margin-top:8px">Serve l'accesso Admin. Account di prova e interni esclusi.</div></td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `Beta Report · ${rangeLabel}`,
    "",
    ...view.summary.lines,
    "",
    "NUMERI CHIAVE",
    ...view.kpis.map((k) => `${k.label}: ${kpiValueLabel(k)}${view.comparisonShown && k.delta ? ` (${k.delta > 0 ? "+" : ""}${k.delta})` : ""}`),
    "",
    "AZIONI CONSIGLIATE",
    ...(actions.length ? actions.map((a, i) => `${i + 1}. ${a.action} — perché: ${a.why} — dove: ${a.where}`) : ["Nessuna azione urgente."]),
    "",
    "DOVE SI FERMANO",
    ...view.funnel.map((f) => `${f.label}: ${f.reached}${f.stopped ? ` (${f.stopped} ferme qui)` : ""}`),
    "",
    "MOTIVI DA CAPIRE",
    ...(frictions.length ? frictions.map((f) => `- ${f.label}`) : ["Nessuna frizione."]),
    "",
    ...(weekLines.length ? ["ULTIMI 7 GIORNI", ...weekLines, ""] : []),
    link,
  ].join("\n");

  return { subject, html, text };
}
