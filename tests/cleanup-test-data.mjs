// Pulisce i dati generati dagli account di TEST (prenotazioni, gruppi,
// inviti, attività extra create durante i test) PRIMA di ogni run della
// suite Playwright contro il deploy reale — così i test ripetuti in
// produzione non accumulano dati sporchi né falliscono per "doppioni".
//
// NON tocca gli account di test stessi, né il centro/attività/bambino
// "seed" creati da supabase/seed-test-data.sql — solo ciò che i TEST hanno
// generato in più (nuove prenotazioni, gruppi, inviti, eventuali nuove
// attività create dal flusso "Nuova attività" del Gestore di test).
//
// Richiede in ".env.test" (mai committato):
//   NEXT_PUBLIC_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...   <- chiave SEGRETA (Project Settings >
//                                      API > service_role), NON la anon key.
//                                      Bypassa la RLS: usarla solo qui, mai
//                                      esporla al browser/al codice app.
//
// Uso:
//   node tests/cleanup-test-data.mjs
// (richiamato automaticamente da test-deploy.sh prima di "playwright test",
// se SUPABASE_SERVICE_ROLE_KEY è presente in .env.test — altrimenti viene
// saltato con un avviso, senza bloccare i test).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEST_PARENT_EMAIL = process.env.TEST_PARENT_EMAIL || "faberx83+test-genitore@gmail.com";
const TEST_CENTER_ADMIN_EMAIL = process.env.TEST_CENTER_ADMIN_EMAIL || "faberx83+test-gestore@gmail.com";
const SEED_ACTIVITY_SLUG = "attivita-test-buddykids";
const SEED_CENTER_SLUG = "centro-test-buddykids";
const SEED_KID_NAME = "[TEST] Bimbo Prova";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.log(
    "⏭️  Pulizia dati di test saltata: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY " +
      "non presenti in .env.test (vedi commento in cima al file per come configurarli)."
  );
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("🧹 Pulizia dati generati dai test in corso...");

  // Gate C follow-up (28/07): tutte le lookup sotto scartavano silenziosamente
  // `error` (solo `data` destrutturato) — se una fallisce (rete, permessi,
  // >1 riga), `data` risulta `null`/falsy esattamente come "non trovato",
  // e il blocco dipendente viene saltato senza alcuna traccia nel log. Il
  // fixture TC-508 (booking marcatore 0.01) risulta "confirmed" invariato da
  // più run consecutivi nonostante il log finale mostri
  // `partnerResponseFixtureReset: false` — sintomo compatibile con una di
  // queste lookup che fallisce silenziosamente. Log esplicito per rendere
  // la causa verificabile al prossimo run invece di doverla ipotizzare.
  const { data: parent, error: parentError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", TEST_PARENT_EMAIL)
    .maybeSingle();
  if (parentError) {
    console.warn("⚠️  Errore lookup profilo genitore di test:", parentError.message);
  }

  const { data: gestore, error: gestoreError } = await supabase
    .from("profiles")
    .select("id, center_id")
    .eq("email", TEST_CENTER_ADMIN_EMAIL)
    .maybeSingle();
  if (gestoreError) {
    console.warn("⚠️  Errore lookup profilo gestore di test:", gestoreError.message);
  }

  const { data: seedCenter, error: seedCenterError } = await supabase
    .from("centers")
    .select("id")
    .eq("slug", SEED_CENTER_SLUG)
    .maybeSingle();
  if (seedCenterError) {
    console.warn("⚠️  Errore lookup centro seed:", seedCenterError.message);
  }

  const { data: seedActivity, error: seedActivityError } = await supabase
    .from("activities")
    .select("id")
    .eq("slug", SEED_ACTIVITY_SLUG)
    .maybeSingle();
  if (seedActivityError) {
    console.warn("⚠️  Errore lookup attività seed:", seedActivityError.message);
  }

  let removed = {
    bookings: 0,
    groups: 0,
    groupRequests: 0,
    invites: 0,
    extraKids: 0,
    extraActivities: 0,
    accountStatusReset: 0,
    attendanceRecords: 0,
    // Integration Stabilization Sprint (Gate B, luglio 2026):
    testCentersDeleted: 0,
    onboardingPreconditionSet: false,
    // Integration Stabilization Sprint (Gate C, luglio 2026):
    partnerResponseFixtureReset: false,
    // Gate C, quarta ondata (29/07):
    addressLabelsReset: 0,
    walkthroughProgressReset: 0,
  };

  let testKid = null;

  // Riporta account_status a 'active' per gli account di test — TC-136/TC-137
  // (tests/genitori/profilo.spec.ts) disattivano/richiedono la cancellazione
  // dell'account di test durante il test stesso: senza questo reset, i run
  // successivi troverebbero l'account già "deactivated"/"deletion_requested".
  const idsToReset = [parent?.id, gestore?.id].filter(Boolean);
  if (idsToReset.length > 0) {
    const { data: resetRows } = await supabase
      .from("profiles")
      .update({ account_status: "active", deletion_requested_at: null })
      .in("id", idsToReset)
      .select("id");
    removed.accountStatusReset = resetRows?.length || 0;
  }

  if (parent || seedActivity) {
    // Prenotazioni del genitore di test (cascade -> booking_weeks, booking_kids).
    //
    // Gate C follow-up (28/07, run serale): TC-508 in strict-mode violation
    // con 3 righe "Da rispondere" per la stessa attività di test, nonostante
    // questo blocco cancelli tutte le prenotazioni del genitore di test PRIMA
    // di ricreare i fixture. Causa: l'Inbox del Gestore (getBookingsForCenter)
    // mostra le prenotazioni di TUTTI i genitori sulle attività del centro,
    // non solo quelle del genitore di test — altri flussi di test (es.
    // creazione prenotazione reale in tests/genitori/prenotazione.spec.ts,
    // eseguiti da account genitore diversi o falliti a metà senza pulizia)
    // lasciano prenotazioni "pending" accumulate sulla STESSA attività di
    // test, sempre visibili nell'Inbox del centro insieme al marcatore
    // ricreato qui sotto. "[TEST] Attività BuddyKids" è un'attività
    // interamente sintetica (mai una prenotazione reale) — è sicuro
    // cancellare TUTTE le prenotazioni su di essa, non solo quelle del
    // genitore di test, per garantire un solo "Da rispondere" alla volta.
    let bookingsQuery = supabase.from("bookings").delete().select("id");
    if (parent && seedActivity) {
      bookingsQuery = bookingsQuery.or(`parent_id.eq.${parent.id},activity_id.eq.${seedActivity.id}`);
    } else if (parent) {
      bookingsQuery = bookingsQuery.eq("parent_id", parent.id);
    } else {
      bookingsQuery = bookingsQuery.eq("activity_id", seedActivity.id);
    }
    const { data: bookings, error: bookingsDeleteError } = await bookingsQuery;
    if (bookingsDeleteError) {
      console.warn("⚠️  Errore cancellazione prenotazioni genitore di test:", bookingsDeleteError.message);
    }
    removed.bookings = bookings?.length || 0;
  }

  if (parent) {
    // Gruppi creati dal genitore di test (cascade -> group_members, group_kids, group_requests)
    const { data: groups } = await supabase
      .from("groups")
      .delete()
      .eq("created_by", parent.id)
      .select("id");
    removed.groups = groups?.length || 0;

    // Richieste gruppo create dal genitore di test ma su gruppi non suoi (raro, per sicurezza)
    const { data: groupRequests } = await supabase
      .from("group_requests")
      .delete()
      .eq("requested_by", parent.id)
      .select("id");
    removed.groupRequests = groupRequests?.length || 0;

    // Bambini extra creati durante i test, tenendo solo quello "seed"
    const { data: extraKids } = await supabase
      .from("kids")
      .delete()
      .eq("parent_id", parent.id)
      .neq("name", SEED_KID_NAME)
      .select("id");
    removed.extraKids = extraKids?.length || 0;

    // Storico presenze del bambino seed. week_id e kid_id restano stabili tra
    // un run e l'altro (il seed non viene mai ricreato), quindi uno stato
    // "presente"/"in_ritardo" lasciato da un run precedente (fallito prima
    // del reset finale) o da un test manuale in UI persiste indefinitamente e
    // falsa l'assunzione "stato di default: assente" di TC-140/TC-149/TC-152.
    // Va ripulito ad ogni run, non solo alla fine dei test.
    const { data: testKidRow, error: testKidError } = await supabase
      .from("kids")
      .select("id")
      .eq("parent_id", parent.id)
      .eq("name", SEED_KID_NAME)
      .maybeSingle();
    if (testKidError) {
      console.warn("⚠️  Errore lookup bambino seed:", testKidError.message);
    }
    testKid = testKidRow;

    if (testKid) {
      const { data: attendanceRows } = await supabase
        .from("attendance_records")
        .delete()
        .eq("kid_id", testKid.id)
        .select("id");
      removed.attendanceRecords = attendanceRows?.length || 0;
    }

    // Gate C, quarta ondata (29/07) — TC-N56 falliva IN OGNI run dopo il
    // primo: TC-N284 (family-planner-5-3.spec.ts) assegna un nome
    // personalizzato ("Casa della nonna") all'indirizzo kind="casa" e non lo
    // ripristina mai, e cleanup-test-data.mjs non toccava parent_addresses —
    // una volta che TC-N284 girava con successo UNA volta, l'etichetta
    // "Casa" letterale (IndirizziClient.tsx#AddressCard: `saved.label ||
    // ADDRESS_KIND_LABELS[kind]`) spariva per sempre, facendo fallire
    // TC-N56 (`getByText("Casa", {exact:true})`) permanentemente. Reset del
    // nome personalizzato ad ogni run, stesso principio già in uso per
    // attendance_records sopra (stato che un test muta e nessuno ripristina).
    const { data: addressLabelRows } = await supabase
      .from("parent_addresses")
      .update({ label: null })
      .eq("parent_id", parent.id)
      .not("label", "is", null)
      .select("kind");
    removed.addressLabelsReset = addressLabelRows?.length || 0;

    // Gate C, sesta ondata (29/07) — stesso identico pattern: TC-N60/TC-N65
    // (family-planner-5-3.spec.ts) assegnano davvero un responsabile
    // ("Partner", "Nonno", ecc.) a celle giorno/momento della griglia "Chi fa
    // cosa?" e non le ripristinano mai; week_responsibilities non era mai
    // toccata da questo script. Dopo abbastanza run, TUTTE le celle della
    // settimana coperta risultano assegnate — TC-N59/TC-N61 (che cercano
    // esplicitamente una cella "Nessuno assegnato", cioè un giorno/momento
    // ancora senza riga in questa tabella) falliscono per mancanza di celle
    // libere, non per un bug applicativo. Reset ad ogni run.
    const { data: responsibilityRows } = await supabase
      .from("week_responsibilities")
      .delete()
      .eq("parent_id", parent.id)
      .select("id");
    removed.weekResponsibilitiesReset = responsibilityRows?.length || 0;
  }

  if (gestore) {
    // Inviti creati dal gestore di test (feature Inviti)
    const { data: invites } = await supabase
      .from("invites")
      .delete()
      .eq("created_by", gestore.id)
      .select("id");
    removed.invites = invites?.length || 0;

    // Gate C, quarta ondata (29/07) — stesso pattern di TC-N56/TC-N284 ma per
    // il motore Walkthrough: TC-N415 (walkthrough-partner.spec.ts) avvia
    // davvero il primo step del percorso "activity_creation_partner" per
    // verificarne la persistenza (tutorial_progress, non solo useState
    // locale) e non lo resetta mai. TC-N414, eseguito PRIMA nello stesso file
    // ma senza garanzia d'ordine reale (fullyParallel:true, nessun
    // describe.configure serial in questo file), si aspetta lo stato INIZIALE
    // "not_started" (bottone "Inizia"): dopo la prima esecuzione riuscita di
    // TC-N415, il percorso resta "in_progress" per sempre e TC-N414 fallisce
    // da quel momento in poi ("Inizia" sostituito da "Continua").
    const { data: walkthroughRows } = await supabase
      .from("tutorial_progress")
      .delete()
      .eq("user_id", gestore.id)
      .eq("tutorial_key", "activity_creation_partner")
      .select("step_key");
    removed.walkthroughProgressReset = walkthroughRows?.length || 0;
  }

  if (seedCenter && seedActivity) {
    // Eventuali attività extra create dal flusso "Nuova attività" durante i
    // test, tenendo solo quella "seed" (cascade -> activity_weeks, promotions)
    const { data: extraActivities } = await supabase
      .from("activities")
      .delete()
      .eq("center_id", seedCenter.id)
      .neq("id", seedActivity.id)
      .select("id");
    removed.extraActivities = extraActivities?.length || 0;
  }

  // ─────────────────────────────────────────────
  // Gate B (Integration Stabilization Sprint) — punto 1/2: i centri
  // "[TEST] Centro Auto LEAD ..." / "[TEST] Centro Idempotenza ..." creati da
  // tests/one/onboarding-remediation.spec.ts (TC-N407/TC-N408) via il form
  // reale "+ Nuovo centro" non venivano mai ripuliti: si accumulano ad ogni
  // run (ognuno con timestamp diverso nel nome, quindi mai deduplicati) e
  // finiscono nella sezione "Altri stati" di /admin/one/onboarding SEMPRE in
  // cima (ordinati per updated_at desc) — questo è il motivo per cui
  // TC-N409 (che clicca ".first()" sul bottone "Richiedi modifiche", visibile
  // SOLO per il centro in stato SUBMITTED) va in timeout: quel bottone non
  // esiste affatto finché nessun centro è in SUBMITTED (vedi punto 2 sotto).
  // Cascade su center_onboarding_state/checklist/identity/audit_log tramite
  // "on delete cascade" (migration_09) — cancellare da "centers" basta.
  const { data: leftoverCenters } = await supabase
    .from("centers")
    .select("id, slug")
    .neq("slug", SEED_CENTER_SLUG)
    .or("name.ilike.[TEST] Centro Auto LEAD%,name.ilike.[TEST] Centro Idempotenza%");
  if (leftoverCenters && leftoverCenters.length > 0) {
    const { data: deletedCenters } = await supabase
      .from("centers")
      .delete()
      .in("id", leftoverCenters.map((c) => c.id))
      .select("id");
    removed.testCentersDeleted = deletedCenters?.length || 0;
  }

  // Gate B, punto 2/2 — automatizza la precondizione DEC-33 (DECISION_LOG.md)
  // per TC-N409: prima richiedeva un UPDATE manuale in SQL Editor prima di
  // ogni run per riportare il centro di test del gestore a SUBMITTED. Stessa
  // identica operazione, eseguita qui via service-role (stesso principio già
  // in uso in questo script per account_status/attendance_records) — NON
  // aggira la macchina a stati applicativa in produzione (nessun utente reale
  // la attraversa così), è solo il fixture di un test che richiede quello
  // stato di partenza, upsert idempotente sulla unique (center_id) di
  // center_onboarding_state.
  if (gestore?.center_id) {
    const { error: onboardingUpsertError } = await supabase
      .from("center_onboarding_state")
      .upsert(
        { center_id: gestore.center_id, status: "SUBMITTED" },
        { onConflict: "center_id" }
      );
    removed.onboardingPreconditionSet = !onboardingUpsertError;
    if (onboardingUpsertError) {
      console.warn(
        "⚠️  Impossibile impostare la precondizione SUBMITTED per TC-N409:",
        onboardingUpsertError.message
      );
    }
  } else {
    console.log(
      "ℹ️  Nessun center_id sul profilo gestore di test: precondizione TC-N409 non impostata (il test resta skippato/in timeout se eseguito)."
    );
  }

  // ─────────────────────────────────────────────
  // Ricrea una prenotazione "fixture" per il Registro presenze del Gestore
  // (tests/gestore/attendance.spec.ts, TC-139/TC-140): il bambino di test
  // iscritto alla prima settimana dell'attività di test. Va ricreata ad ogni
  // run perché la pulizia sopra elimina TUTTE le prenotazioni del genitore di
  // test, fixture inclusa — è economico e idempotente (nessun rischio di
  // duplicati "sporchi" perché ripartiamo sempre da zero).
  // ─────────────────────────────────────────────
  if (parent && seedActivity) {
    const { data: firstWeek } = await supabase
      .from("activity_weeks")
      .select("id")
      .eq("activity_id", seedActivity.id)
      .order("start_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: activityRow } = await supabase
      .from("activities")
      .select("price_per_week")
      .eq("id", seedActivity.id)
      .maybeSingle();

    if (testKid && firstWeek) {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          parent_id: parent.id,
          activity_id: seedActivity.id,
          status: "confirmed",
          payment_method: "card",
          total_amount: activityRow?.price_per_week ?? 120,
          discount_amount: 0,
          shuttle_included: false,
        })
        .select("id")
        .single();

      if (!bookingError && booking) {
        await supabase.from("booking_weeks").insert({ booking_id: booking.id, week_id: firstWeek.id });
        await supabase.from("booking_kids").insert({ booking_id: booking.id, kid_id: testKid.id });
        console.log("✅ Prenotazione fixture ricreata per il Registro presenze (Settimana 1).");

        // Aggiunge ANCHE la settimana di camp che copre la data ODIERNA (se
        // esiste tra le 13 seminate) alla STESSA prenotazione — serve al
        // check-in MVP lato genitore (tests/genitori/home.spec.ts,
        // CheckinPrompt), che mostra la card solo per prenotazioni la cui
        // settimana include "oggi". "Settimana 1" da sola non basta: è fissa
        // alla prima settimana di giugno dell'anno del seed, quasi mai
        // coincidente con la data di un run reale. Non tocca TC-139/TC-140
        // (che continuano a trovare "Settimana 1" invariata).
        const today = new Date().toISOString().slice(0, 10);
        const { data: todayWeek } = await supabase
          .from("activity_weeks")
          .select("id")
          .eq("activity_id", seedActivity.id)
          .lte("start_date", today)
          .gte("end_date", today)
          .maybeSingle();

        if (todayWeek && todayWeek.id !== firstWeek.id) {
          await supabase.from("booking_weeks").insert({ booking_id: booking.id, week_id: todayWeek.id });
          console.log("✅ Prenotazione fixture estesa alla settimana corrente (check-in MVP).");
        } else if (!todayWeek) {
          console.log("ℹ️  Nessuna settimana seminata copre la data odierna: i test di check-in verranno saltati.");
        }
      } else if (bookingError) {
        console.warn("⚠️  Impossibile ricreare la prenotazione fixture:", bookingError.message);
      }
    }
  }

  // ─────────────────────────────────────────────
  // Gate C (Integration Stabilization Sprint, luglio 2026) — root cause
  // trovata nel run reale del 28/07: il blocco sopra ("bookings.delete
  // .eq(parent_id, parent.id)") cancella INCONDIZIONATAMENTE tutte le
  // prenotazioni del genitore di test, inclusa la prenotazione "pending"
  // marcatore (total_amount = 0.01) seminata una tantum da
  // supabase/seed-test-data.sql STEP 8 per tests/gestore/prenotazioni.spec.ts
  // (TC-508, Inbox Partner "Da rispondere"). A differenza della fixture di
  // Registro presenze qui sopra, questa non veniva mai ricreata — la prima
  // volta che questo script gira, la elimina per sempre e TC-508 non trova
  // più nulla in "Da rispondere" finché qualcuno non rilancia lo STEP 8 a
  // mano in SQL Editor. Stesso principio "ricrea ad ogni run" già in uso
  // sopra, sulla stessa identica settimana (Settimana 2) usata dal seed
  // originale, così da non toccare "Settimana 1"/la settimana odierna già
  // occupate dalla fixture di Registro presenze.
  if (parent && seedActivity && testKid) {
    const { data: week2, error: week2Error } = await supabase
      .from("activity_weeks")
      .select("id")
      .eq("activity_id", seedActivity.id)
      .eq("label", "Settimana 2")
      .maybeSingle();
    if (week2Error) {
      console.warn("⚠️  Errore lookup 'Settimana 2':", week2Error.message);
    }

    if (week2) {
      // total_amount fisso a 0.01: è esattamente il marcatore che
      // supabase/seed-test-data.sql STEP 8 usa per riconoscere questa riga
      // (mai prodotto da createBookingAction in condizioni normali), non un
      // prezzo reale — non serve leggere activities.price_per_week qui.
      const { data: pendingBooking, error: pendingBookingError } = await supabase
        .from("bookings")
        .insert({
          parent_id: parent.id,
          activity_id: seedActivity.id,
          status: "pending",
          total_amount: 0.01,
          discount_amount: 0,
          payment_method: "card",
          shuttle_included: false,
        })
        .select("id")
        .single();

      if (!pendingBookingError && pendingBooking) {
        await supabase.from("booking_weeks").insert({ booking_id: pendingBooking.id, week_id: week2.id });
        await supabase.from("booking_kids").insert({ booking_id: pendingBooking.id, kid_id: testKid.id });
        removed.partnerResponseFixtureReset = true;
        console.log("✅ Prenotazione fixture 'Da rispondere' (marcatore 0.01) ricreata per TC-508.");
      } else if (pendingBookingError) {
        console.warn(
          "⚠️  Impossibile ricreare la prenotazione fixture 'Da rispondere' per TC-508:",
          pendingBookingError.message
        );
      }
    } else {
      console.log(
        "ℹ️  'Settimana 2' non trovata per l'attività di test: prenotazione fixture 'Da rispondere' (TC-508) non ricreata."
      );
    }
  } else {
    // Nessuno dei tre log "⚠️ Errore lookup..." sopra E comunque
    // partnerResponseFixtureReset resta false: questo ramo dice esattamente
    // quale precondizione manca, invece di dover ipotizzare guardando solo
    // il flag finale.
    console.log(
      `ℹ️  Prenotazione fixture 'Da rispondere' (TC-508) non ricreata: ` +
        `parent=${Boolean(parent)} seedActivity=${Boolean(seedActivity)} testKid=${Boolean(testKid)}.`
    );
  }

  // Gate C (Cluster F, luglio 2026) — BUG TROVATO+CORRETTO: questo log di
  // riepilogo veniva stampato PRIMA dei tre blocchi di ricreazione fixture
  // qui sopra (Registro presenze, estensione check-in odierno, TC-508 "Da
  // rispondere"). Il valore di `removed.partnerResponseFixtureReset`
  // stampato era quindi SEMPRE `false` (il default impostato in cima alla
  // funzione), indipendentemente dall'esito reale della ricreazione — un
  // log fuorviante, non una prova di fallimento effettivo. Spostato qui, a
  // fine funzione, dopo che tutti i blocchi hanno avuto modo di aggiornare
  // `removed`.
  console.log("✅ Pulizia completata:", removed);
}

main().catch((err) => {
  console.error("⚠️  Pulizia dati di test fallita (i test proseguono comunque):", err.message);
  process.exit(0);
});
