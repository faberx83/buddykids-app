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

  const { data: parent } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", TEST_PARENT_EMAIL)
    .maybeSingle();

  const { data: gestore } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", TEST_CENTER_ADMIN_EMAIL)
    .maybeSingle();

  const { data: seedCenter } = await supabase
    .from("centers")
    .select("id")
    .eq("slug", SEED_CENTER_SLUG)
    .maybeSingle();

  const { data: seedActivity } = await supabase
    .from("activities")
    .select("id")
    .eq("slug", SEED_ACTIVITY_SLUG)
    .maybeSingle();

  let removed = {
    bookings: 0,
    groups: 0,
    groupRequests: 0,
    invites: 0,
    extraKids: 0,
    extraActivities: 0,
    accountStatusReset: 0,
  };

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

  if (parent) {
    // Prenotazioni del genitore di test (cascade -> booking_weeks, booking_kids)
    const { data: bookings } = await supabase
      .from("bookings")
      .delete()
      .eq("parent_id", parent.id)
      .select("id");
    removed.bookings = bookings?.length || 0;

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
  }

  if (gestore) {
    // Inviti creati dal gestore di test (feature Inviti)
    const { data: invites } = await supabase
      .from("invites")
      .delete()
      .eq("created_by", gestore.id)
      .select("id");
    removed.invites = invites?.length || 0;
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

  console.log("✅ Pulizia completata:", removed);

  // ─────────────────────────────────────────────
  // Ricrea una prenotazione "fixture" per il Registro presenze del Gestore
  // (tests/gestore/attendance.spec.ts, TC-139/TC-140): il bambino di test
  // iscritto alla prima settimana dell'attività di test. Va ricreata ad ogni
  // run perché la pulizia sopra elimina TUTTE le prenotazioni del genitore di
  // test, fixture inclusa — è economico e idempotente (nessun rischio di
  // duplicati "sporchi" perché ripartiamo sempre da zero).
  // ─────────────────────────────────────────────
  if (parent && seedActivity) {
    const { data: testKid } = await supabase
      .from("kids")
      .select("id")
      .eq("parent_id", parent.id)
      .eq("name", SEED_KID_NAME)
      .maybeSingle();

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
}

main().catch((err) => {
  console.error("⚠️  Pulizia dati di test fallita (i test proseguono comunque):", err.message);
  process.exit(0);
});
