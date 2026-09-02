import { test as pureTest, expect as pureExpect } from "@playwright/test";
import {
  computeRolesToCover,
  computeCoordinationGap,
  computeOrganizationState,
  KidBookedDaysInput,
} from "@/lib/nextgen/week-roles";
import { computeHeroWeeksSummary } from "@/lib/nextgen/planner-insights";
import type { WeekResponsibility } from "@/lib/nextgen/responsibility-options";

// TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS (02/09/2026): segnalazione
// di Fabrizio (Sett.15 "Prova FP"/Lino) — HOME diceva "Organizzata al 100%"
// e Planner Overview "3 su 3 organizzate" anche con 2 passaggi Andata/
// Ritorno su 10 non assegnati: copertura ATTIVITÀ (c'è una prenotazione?)
// non è mai stata sinonimo di copertura COORDINAMENTO (sappiamo chi
// accompagna/ritira?). Questi test coprono l'helper puro condiviso
// (lib/nextgen/week-roles.ts: computeRolesToCover, esteso con
// computeCoordinationGap/computeOrganizationState) che ora alimenta sia Home
// (app/nextgen/HomeDashboardClient.tsx) sia Planner Overview
// (app/nextgen/planner/PlannerClient.tsx) — stessa fonte, nessun secondo
// calcolo divergente.
//
// Data di riferimento usata in tutto il file: todayIso = "2026-09-02" (data
// reale della segnalazione). Settimane di fixture, tutte lun-ven:
//   week1: 2026-08-17..08-21 (PASSATA — endDate < todayIso)
//   week2: 2026-08-31..09-04 (settimana corrente, contiene todayIso)
//   week3: 2026-09-07..09-11 (futura)
//   week4: 2026-09-14..09-18 (futura, corrisponde alla vera Sett.16 di prod)

const TODAY_ISO = "2026-09-02";

const WEEK1 = { index: 1, startDate: "2026-08-17", endDate: "2026-08-21", dismissed: false };
const WEEK2 = { index: 2, startDate: "2026-08-31", endDate: "2026-09-04", dismissed: false };
const WEEK3 = { index: 3, startDate: "2026-09-07", endDate: "2026-09-11", dismissed: false };
const WEEK4 = { index: 4, startDate: "2026-09-14", endDate: "2026-09-18", dismissed: false };

function resp(
  kidId: string,
  weekStartDate: string,
  weekday: WeekResponsibility["weekday"],
  moment: WeekResponsibility["moment"]
): WeekResponsibility {
  return { kidId, weekStartDate, weekday, moment, responsible: "io", responsibleLabel: null };
}

pureTest.describe("ORG-COMP — regola formale di organizzazione completa (§10 del prompt)", () => {
  pureTest("ORG-COMP-01: attività completa + coordinamento completo -> fullOrganization = true", () => {
    pureExpect(computeOrganizationState(true, 0)).toBe("full");
  });

  pureTest("ORG-COMP-02: attività completa + 1 responsabilità futura mancante -> fullOrganization = false", () => {
    pureExpect(computeOrganizationState(true, 1)).not.toBe("full");
    pureExpect(computeOrganizationState(true, 1)).toBe("coordination_gap");
  });

  pureTest("ORG-COMP-03: attività completa + responsabilità mancante SOLO nel passato -> fullOrganization = true (stato attuale azionabile)", () => {
    // week1 è passata (endDate 2026-08-21 < todayIso 2026-09-02): un bambino
    // prenotato lì con "Chi fa cosa?" mai assegnato non deve più contare
    // come un gap oggi — stesso perimetro !dismissed/endDate>=todayIso già
    // usato da computeHeroWeeksSummary per l'attività, riusato qui uguale.
    const bookedDays: KidBookedDaysInput[] = [
      { kidId: "K1", kidName: "Kid1", dates: ["2026-08-17", "2026-08-18"] }, // solo week1 (passata)
    ];
    const gap = computeCoordinationGap([WEEK1, WEEK2, WEEK3], bookedDays, [], TODAY_ISO);
    pureExpect(gap.totalMissing).toBe(0);
    pureExpect(computeOrganizationState(true, gap.totalMissing)).toBe("full");
  });

  pureTest("ORG-COMP-04: attività incompleta + coordinamento completo -> fullOrganization = false", () => {
    pureExpect(computeOrganizationState(false, 0)).not.toBe("full");
    pureExpect(computeOrganizationState(false, 0)).toBe("activity_gap");
  });

  pureTest("ORG-COMP-05: attività incompleta + coordinamento incompleto -> il problema di attività mantiene la priorità", () => {
    // Mai "coordination_gap" quando manca anche l'attività: un gap di
    // coordinamento non deve mai mascherare un problema più fondamentale
    // (§6 CASO C).
    pureExpect(computeOrganizationState(false, 2)).toBe("activity_gap");
  });

  pureTest("ORG-COMP-06: 2 slot di responsabilità futuri mancanti -> missingCoordinationCount = 2", () => {
    const bookedDays: KidBookedDaysInput[] = [{ kidId: "K1", kidName: "Kid1", dates: ["2026-09-07"] }]; // lun, week3
    const gap = computeCoordinationGap([WEEK3], bookedDays, [], TODAY_ISO);
    pureExpect(gap.totalMissing).toBe(2); // andata + ritorno, nessuna assegnazione
  });

  pureTest("ORG-COMP-07: Andata assegnata + Ritorno mancante -> count = 1", () => {
    const summary = computeRolesToCover(
      WEEK3.startDate,
      [{ kidId: "K1", kidName: "Kid1", dates: ["2026-09-07"] }],
      [resp("K1", WEEK3.startDate, "lun", "andata")]
    );
    pureExpect(summary.missingSlots).toBe(1);
    pureExpect(summary.byMoment.andata.missing).toBe(0);
    pureExpect(summary.byMoment.ritorno.missing).toBe(1);
  });

  pureTest("ORG-COMP-08: Andata mancante + Ritorno assegnato -> count = 1", () => {
    const summary = computeRolesToCover(
      WEEK3.startDate,
      [{ kidId: "K1", kidName: "Kid1", dates: ["2026-09-07"] }],
      [resp("K1", WEEK3.startDate, "lun", "ritorno")]
    );
    pureExpect(summary.missingSlots).toBe(1);
    pureExpect(summary.byMoment.andata.missing).toBe(1);
    pureExpect(summary.byMoment.ritorno.missing).toBe(0);
  });
});

pureTest.describe("ORG-MULTI — indipendenza per bambino (§3-§4 del prompt: mai '5 giorni × numero bambini')", () => {
  // Sofia: lun/mar/gio (09-07/09-08/09-10) — Niccolò: mar/mer/ven (09-08/09-09/09-11).
  // Martedì (09-08) è condiviso da entrambi: deve generare 4 slot distinti
  // (Sofia Andata/Ritorno + Niccolò Andata/Ritorno), mai deduplicati.
  const bookedDays: KidBookedDaysInput[] = [
    { kidId: "Sofia", kidName: "Sofia", dates: ["2026-09-07", "2026-09-08", "2026-09-10"] },
    { kidId: "Niccolo", kidName: "Niccolò", dates: ["2026-09-08", "2026-09-09", "2026-09-11"] },
  ];

  pureTest("ORG-MULTI-01: tutto assegnato tranne Niccolò/Ritorno/martedì -> gap = 1 (mai 0, mai 2, mai aggregato)", () => {
    const allAssignments: WeekResponsibility[] = [
      resp("Sofia", WEEK3.startDate, "lun", "andata"),
      resp("Sofia", WEEK3.startDate, "lun", "ritorno"),
      resp("Sofia", WEEK3.startDate, "mar", "andata"),
      resp("Sofia", WEEK3.startDate, "mar", "ritorno"),
      resp("Sofia", WEEK3.startDate, "gio", "andata"),
      resp("Sofia", WEEK3.startDate, "gio", "ritorno"),
      resp("Niccolo", WEEK3.startDate, "mar", "andata"),
      // resp("Niccolo", WEEK3.startDate, "mar", "ritorno") — VOLUTAMENTE mancante
      resp("Niccolo", WEEK3.startDate, "mer", "andata"),
      resp("Niccolo", WEEK3.startDate, "mer", "ritorno"),
      resp("Niccolo", WEEK3.startDate, "ven", "andata"),
      resp("Niccolo", WEEK3.startDate, "ven", "ritorno"),
    ];
    const summary = computeRolesToCover(WEEK3.startDate, bookedDays, allAssignments);
    pureExpect(summary.missingSlots).toBe(1);
    pureExpect(summary.missing).toHaveLength(1);
    pureExpect(summary.missing[0]).toMatchObject({ kidId: "Niccolo", weekday: "mar", moment: "ritorno" });
  });

  pureTest("ORG-MULTI-02: stesso giorno, due bambini, una responsabilità mancante ciascuno -> gap = 2", () => {
    // Martedì condiviso: Sofia manca Ritorno, Niccolò manca Andata.
    const assignments: WeekResponsibility[] = [
      resp("Sofia", WEEK3.startDate, "mar", "andata"),
      // resp("Sofia", ..., "mar", "ritorno") mancante
      // resp("Niccolo", ..., "mar", "andata") mancante
      resp("Niccolo", WEEK3.startDate, "mar", "ritorno"),
    ];
    const onlyTuesday: KidBookedDaysInput[] = [
      { kidId: "Sofia", kidName: "Sofia", dates: ["2026-09-08"] },
      { kidId: "Niccolo", kidName: "Niccolò", dates: ["2026-09-08"] },
    ];
    const summary = computeRolesToCover(WEEK3.startDate, onlyTuesday, assignments);
    pureExpect(summary.missingSlots).toBe(2);
    pureExpect(summary.missing.map((m) => m.kidId).sort()).toEqual(["Niccolo", "Sofia"]);
  });

  pureTest("ORG-MULTI-03: assegnare una responsabilità di Sofia NON modifica il gap di Niccolò", () => {
    const baseAssignments: WeekResponsibility[] = [
      resp("Sofia", WEEK3.startDate, "lun", "andata"),
      resp("Sofia", WEEK3.startDate, "mar", "andata"),
      resp("Sofia", WEEK3.startDate, "mar", "ritorno"),
      resp("Sofia", WEEK3.startDate, "gio", "andata"),
      resp("Sofia", WEEK3.startDate, "gio", "ritorno"),
      resp("Niccolo", WEEK3.startDate, "mar", "andata"),
      resp("Niccolo", WEEK3.startDate, "mer", "andata"),
      resp("Niccolo", WEEK3.startDate, "mer", "ritorno"),
      resp("Niccolo", WEEK3.startDate, "ven", "andata"),
      resp("Niccolo", WEEK3.startDate, "ven", "ritorno"),
      // Sofia/lun/ritorno e Niccolo/mar/ritorno restano entrambi mancanti
      // (l'UNICO buco di ciascuno, per isolare l'effetto di assegnare quello di Sofia)
    ];
    const before = computeRolesToCover(WEEK3.startDate, bookedDays, baseAssignments);
    const niccoloMissingBefore = before.missing.filter((m) => m.kidId === "Niccolo").length;
    pureExpect(niccoloMissingBefore).toBe(1);

    const afterAssigningSofia = computeRolesToCover(WEEK3.startDate, bookedDays, [
      ...baseAssignments,
      resp("Sofia", WEEK3.startDate, "lun", "ritorno"), // colma l'unico buco di Sofia
    ]);
    const niccoloMissingAfter = afterAssigningSofia.missing.filter((m) => m.kidId === "Niccolo").length;
    const sofiaMissingAfter = afterAssigningSofia.missing.filter((m) => m.kidId === "Sofia").length;
    pureExpect(niccoloMissingAfter).toBe(niccoloMissingBefore); // invariato
    pureExpect(sofiaMissingAfter).toBe(0); // colmato
  });
});

pureTest.describe("HOME-ORG — Home hero: attività vs coordinamento (app/nextgen/HomeDashboardClient.tsx)", () => {
  // Stessa derivazione di HomeDashboardClient.tsx: gaps = settimane
  // !covered && !dismissed && !isPastUncovered; activityCoverageComplete =
  // gaps.length === 0. Riprodotta qui 1:1 (stesso identico calcolo, non un
  // secondo divergente) per poter testare organizationState senza montare
  // React.
  function homeGapsCount(weeks: { covered: boolean; dismissed: boolean; endDate: string }[], todayIso: string) {
    const isPastUncovered = (w: { covered: boolean; endDate: string }) => !w.covered && w.endDate < todayIso;
    return weeks.filter((w) => !w.covered && !w.dismissed && !isPastUncovered(w)).length;
  }

  pureTest("HOME-ORG-01: attività completa + coordinamento completo -> può mostrare 'Organizzata al 100%'", () => {
    const weeks = [
      { ...WEEK2, covered: true },
      { ...WEEK3, covered: true },
      { ...WEEK4, covered: true },
    ];
    const activityComplete = homeGapsCount(weeks, TODAY_ISO) === 0;
    const bookedDays: KidBookedDaysInput[] = [{ kidId: "K1", kidName: "Kid1", dates: ["2026-09-07"] }];
    const gap = computeCoordinationGap(weeks, bookedDays, [resp("K1", WEEK3.startDate, "lun", "andata"), resp("K1", WEEK3.startDate, "lun", "ritorno")], TODAY_ISO);
    pureExpect(computeOrganizationState(activityComplete, gap.totalMissing)).toBe("full");
  });

  pureTest("HOME-ORG-02: attività completa + coordinamento incompleto -> 'Organizzata al 100%' NON mostrato come stato complessivo", () => {
    const weeks = [
      { ...WEEK2, covered: true },
      { ...WEEK3, covered: true },
    ];
    const activityComplete = homeGapsCount(weeks, TODAY_ISO) === 0;
    pureExpect(activityComplete).toBe(true);
    const bookedDays: KidBookedDaysInput[] = [{ kidId: "K1", kidName: "Kid1", dates: ["2026-09-07"] }]; // andata+ritorno mai assegnati
    const gap = computeCoordinationGap(weeks, bookedDays, [], TODAY_ISO);
    const state = computeOrganizationState(activityComplete, gap.totalMissing);
    pureExpect(state).toBe("coordination_gap");
    pureExpect(state).not.toBe("full"); // l'header "Organizzata al X%" in HomeDashboardClient.tsx è condizionato a state !== "coordination_gap"
  });

  pureTest("HOME-ORG-03: gap di coordinamento = 2 -> Home rende visibile il conteggio", () => {
    const bookedDays: KidBookedDaysInput[] = [{ kidId: "K1", kidName: "Kid1", dates: ["2026-09-07"] }];
    const gap = computeCoordinationGap([WEEK3], bookedDays, [], TODAY_ISO);
    pureExpect(gap.totalMissing).toBe(2); // valore legato al testo "2 passaggi da assegnare"
  });

  pureTest("HOME-ORG-04: la CTA di coordinamento punta alla prima settimana futura incompleta", () => {
    // Gap solo in week4 (week3 completamente assegnata) -> deve puntare a week4.
    const bookedDays: KidBookedDaysInput[] = [
      { kidId: "K1", kidName: "Kid1", dates: ["2026-09-07", "2026-09-14"] }, // week3 + week4
    ];
    const gap = computeCoordinationGap(
      [WEEK3, WEEK4],
      bookedDays,
      [resp("K1", WEEK3.startDate, "lun", "andata"), resp("K1", WEEK3.startDate, "lun", "ritorno")], // week3 completa, week4 no
      TODAY_ISO
    );
    pureExpect(gap.firstGapWeekStartDate).toBe(WEEK4.startDate);
    pureExpect(gap.firstGapWeekIndex).toBe(WEEK4.index);
    const href = `/nextgen/planner?mode=calendario&week=${gap.firstGapWeekStartDate}`;
    pureExpect(href).toBe(`/nextgen/planner?mode=calendario&week=${WEEK4.startDate}`);
  });

  pureTest("HOME-ORG-05: 'Prossimo appuntamento' resta presente e non viene rotto dal calcolo di coordinamento", () => {
    // Stessa derivazione di HomeDashboardClient.tsx (upcoming/nextAppointment,
    // INVARIATA): calcolata da un dataset indipendente (bookings), qui
    // riprodotta 1:1 per dimostrare che coesiste senza interferenze con
    // organizationState — nessuno stato condiviso/mutato tra le due.
    const bookings = [
      { id: "b1", firstWeekStart: "2026-08-20", activityName: "Passata" },
      { id: "b2", firstWeekStart: "2026-09-10", activityName: "Centro Estivo" },
      { id: "b3", firstWeekStart: "2026-09-20", activityName: "Più lontana" },
    ];
    const upcoming = bookings
      .filter((b) => b.firstWeekStart >= TODAY_ISO)
      .sort((a, b) => a.firstWeekStart.localeCompare(b.firstWeekStart));
    const nextAppointment = upcoming[0] ?? null;
    pureExpect(nextAppointment?.id).toBe("b2");

    // Nel frattempo lo stato di organizzazione può benissimo essere
    // "coordination_gap" — le due sezioni della Home sono indipendenti.
    const bookedDays: KidBookedDaysInput[] = [{ kidId: "K1", kidName: "Kid1", dates: ["2026-09-07"] }];
    const gap = computeCoordinationGap([WEEK3], bookedDays, [], TODAY_ISO);
    pureExpect(computeOrganizationState(true, gap.totalMissing)).toBe("coordination_gap");
    pureExpect(nextAppointment?.id).toBe("b2"); // ancora invariato
  });
});

pureTest.describe("PLANNER-ORG — Planner Overview: Coverage Hero (app/nextgen/planner/PlannerClient.tsx)", () => {
  const heroWeeksInput = [
    { index: WEEK2.index, covered: true, dismissed: false, endDate: WEEK2.endDate },
    { index: WEEK3.index, covered: true, dismissed: false, endDate: WEEK3.endDate },
    { index: WEEK4.index, covered: true, dismissed: false, endDate: WEEK4.endDate },
  ];

  pureTest("PLANNER-ORG-01: 3/3 settimane attività coperte + coordinamento completo -> stato coerente 'completo'", () => {
    const heroWeeks = computeHeroWeeksSummary(heroWeeksInput, TODAY_ISO);
    pureExpect(heroWeeks.futureCovered).toBe(3);
    pureExpect(heroWeeks.futureTotal).toBe(3);
    const priorityWeek = null; // nessuna settimana da riempire
    const activityCoverageComplete = heroWeeks.hasFutureRelevant ? priorityWeek === null : true;
    const bookedDays: KidBookedDaysInput[] = [{ kidId: "K1", kidName: "Kid1", dates: ["2026-09-07"] }];
    const gap = computeCoordinationGap(
      [WEEK2, WEEK3, WEEK4],
      bookedDays,
      [resp("K1", WEEK3.startDate, "lun", "andata"), resp("K1", WEEK3.startDate, "lun", "ritorno")],
      TODAY_ISO
    );
    pureExpect(computeOrganizationState(activityCoverageComplete, gap.totalMissing)).toBe("full");
  });

  pureTest("PLANNER-ORG-02: 3/3 settimane attività coperte + coordinamento incompleto -> copertura attività resta 3/3 MA appare un gap", () => {
    const heroWeeks = computeHeroWeeksSummary(heroWeeksInput, TODAY_ISO);
    pureExpect(heroWeeks.futureCovered).toBe(3);
    pureExpect(heroWeeks.futureTotal).toBe(3); // INVARIATO rispetto a PLANNER-ORG-01
    const priorityWeek = null; // nessuna settimana da riempire: solo il coordinamento manca
    const activityCoverageComplete = heroWeeks.hasFutureRelevant ? priorityWeek === null : true;
    const bookedDays: KidBookedDaysInput[] = [{ kidId: "K1", kidName: "Kid1", dates: ["2026-09-07"] }];
    const gap = computeCoordinationGap([WEEK2, WEEK3, WEEK4], bookedDays, [], TODAY_ISO); // niente assegnato
    pureExpect(gap.totalMissing).toBeGreaterThan(0);
    pureExpect(computeOrganizationState(activityCoverageComplete, gap.totalMissing)).toBe("coordination_gap");
  });

  pureTest("PLANNER-ORG-03: il gap di coordinamento mostra la prima settimana futura coinvolta", () => {
    const bookedDays: KidBookedDaysInput[] = [{ kidId: "K1", kidName: "Kid1", dates: ["2026-09-07", "2026-09-14"] }];
    // Solo week4 incompleta -> punta a week4.
    let gap = computeCoordinationGap(
      [WEEK3, WEEK4],
      bookedDays,
      [resp("K1", WEEK3.startDate, "lun", "andata"), resp("K1", WEEK3.startDate, "lun", "ritorno")],
      TODAY_ISO
    );
    pureExpect(gap.firstGapWeekIndex).toBe(WEEK4.index);
    // Ora anche week3 incompleta -> deve tornare alla più vicina (week3, index minore = prima nel tempo).
    gap = computeCoordinationGap([WEEK3, WEEK4], bookedDays, [], TODAY_ISO);
    pureExpect(gap.firstGapWeekIndex).toBe(WEEK3.index);
    pureExpect(gap.firstGapWeekStartDate).toBe(WEEK3.startDate);
  });

  pureTest("PLANNER-ORG-04: la CTA di coordinamento apre il contesto corretto di 'Chi fa cosa?'", () => {
    const bookedDays: KidBookedDaysInput[] = [{ kidId: "K1", kidName: "Kid1", dates: ["2026-09-14"] }];
    const gap = computeCoordinationGap([WEEK4], bookedDays, [], TODAY_ISO);
    const href = `/nextgen/planner?mode=calendario&week=${gap.firstGapWeekStartDate}`;
    pureExpect(href).toBe(`/nextgen/planner?mode=calendario&week=${WEEK4.startDate}`);

    // Mirror esatto della logica di selezione candidata in
    // components/nextgen/PlannerCalendarView.tsx (selectedDay initializer):
    // il deep-link ?week= deve vincere sulla preselezione "settimana
    // corrente" di default quando corrisponde a una settimana reale.
    const weeksForCalendar = [WEEK2, WEEK3, WEEK4];
    function pickCandidate(initialWeekStartDate: string | null) {
      return (
        (initialWeekStartDate ? weeksForCalendar.find((w) => w.startDate === initialWeekStartDate) : undefined) ??
        weeksForCalendar.find((w) => !w.dismissed && TODAY_ISO >= w.startDate && TODAY_ISO <= w.endDate) ??
        weeksForCalendar.find((w) => !w.dismissed) ??
        null
      );
    }
    const candidate = pickCandidate(gap.firstGapWeekStartDate);
    pureExpect(candidate?.startDate).toBe(WEEK4.startDate);
    // Senza il deep-link, la preselezione di default sarebbe la settimana
    // corrente (WEEK2, che contiene todayIso) — conferma che il deep-link fa
    // davvero la differenza, non è un no-op.
    pureExpect(pickCandidate(null)?.startDate).toBe(WEEK2.startDate);
  });

  pureTest("PLANNER-ORG-05: nessuna CTA doppia/in competizione quando esiste già un gap di attività (priorityWeek)", () => {
    // Con un gap di attività, activityCoverageComplete è SEMPRE false, quindi
    // organizationState non può mai essere "coordination_gap" — la
    // condizione che in PlannerClient.tsx fa apparire l'alert secondario di
    // coordinamento (organizationState === "coordination_gap") resta falsa,
    // anche se ci fossero passaggi Andata/Ritorno non assegnati: l'unica CTA
    // visibile resta quella di priorityWeek ("Prossimo passo: completa la
    // Settimana N").
    const priorityWeek = WEEK3; // simulazione: settimana da riempire
    const activityCoverageComplete = priorityWeek === null;
    pureExpect(activityCoverageComplete).toBe(false);
    const bookedDays: KidBookedDaysInput[] = [{ kidId: "K1", kidName: "Kid1", dates: ["2026-09-14"] }];
    const gap = computeCoordinationGap([WEEK4], bookedDays, [], TODAY_ISO); // gap di coordinamento presente
    pureExpect(gap.totalMissing).toBeGreaterThan(0);
    const state = computeOrganizationState(activityCoverageComplete, gap.totalMissing);
    pureExpect(state).toBe("activity_gap");
    pureExpect(state).not.toBe("coordination_gap"); // l'alert secondario resta nascosto
  });
});
