# PROPOSTA — NON APPLICATA AL CODICE LIVE

Questo file descrive come `lib/data/school-calendar.ts` andrebbe modificato
DOPO che `PART_D2_migration_proposed_comune_scope.sql` è stata applicata.
Non è stato scritto nel repository: referenzia la colonna
`school_calendar_events.comune`, che oggi non esiste — se questo codice
venisse deployato ora, ogni query a `school_calendar_events` fallirebbe
(colonna non trovata). Va applicato SOLO dopo la migration, come commit
separato.

## Principio

`getSchoolCalendarPlannerContext` (nome esistente, invariato) continua a
fare UNA query per l'evento-set di tutti i calendari coinvolti (nessun
N+1, stesso principio già seguito oggi) — cambia solo COME gli eventi
vengono filtrati/assegnati per bambino, aggiungendo la dimensione comune
oltre a region.

## Diff concettuale

```ts
// PRIMA (oggi, region-only):
const { data: eventRows } = await supabase
  .from("school_calendar_events")
  .select("calendar_id, start_date, end_date, event_type, label")
  .in("calendar_id", calendarIds);

const eventsByRegion = new Map<string, SchoolCalendarEventInput[]>();
for (const row of eventRows ?? []) {
  const region = regionByCalendarId.get(row.calendar_id);
  if (!region) continue;
  const list = eventsByRegion.get(region) ?? [];
  list.push({ startDate: row.start_date, endDate: row.end_date, eventType: row.event_type, label: row.label ?? "" });
  eventsByRegion.set(region, list);
}
// ... più sotto:
const events = eventsByRegion.get(profile.region) ?? [];
closuresByKidId.set(kidId, buildClosureIntervals(events));


// DOPO (region + comune):
const { data: eventRows } = await supabase
  .from("school_calendar_events")
  .select("calendar_id, start_date, end_date, event_type, label, comune") // + comune
  .in("calendar_id", calendarIds);

// Chiave "region" invariata per la baseline; aggiunta una seconda mappa per
// gli eventi locali, chiave "region|comune" (un comune esiste sempre
// insieme a una regione, mai da solo — evita collisioni tra comuni
// omonimi di regioni diverse).
const regionalEventsByRegion = new Map<string, SchoolCalendarEventInput[]>();
const localEventsByRegionComune = new Map<string, SchoolCalendarEventInput[]>();
for (const row of eventRows ?? []) {
  const region = regionByCalendarId.get(row.calendar_id);
  if (!region) continue;
  const input: SchoolCalendarEventInput = { startDate: row.start_date, endDate: row.end_date, eventType: row.event_type, label: row.label ?? "" };
  if (row.comune === null) {
    const list = regionalEventsByRegion.get(region) ?? [];
    list.push(input);
    regionalEventsByRegion.set(region, list);
  } else {
    const key = `${region}|${row.comune}`;
    const list = localEventsByRegionComune.get(key) ?? [];
    list.push(input);
    localEventsByRegionComune.set(key, list);
  }
}

// ... più sotto, per bambino:
const regionalEvents = regionalEventsByRegion.get(profile.region) ?? [];
const localEvents = profile.comune
  ? localEventsByRegionComune.get(`${profile.region}|${profile.comune}`) ?? []
  : [];
// Composizione: unione semplice, nessun dedup a livello di riga necessario
// (buildClosureIntervals unisce già gli intervalli — due eventi che
// coprono lo stesso giorno non creano un doppio conteggio, closedWeekdayCount
// verifica "il giorno ricade in ALMENO UN intervallo", non li somma).
const events = [...regionalEvents, ...localEvents];
closuresByKidId.set(kidId, buildClosureIntervals(events));
```

## Punti di attenzione

- **Match `comune`**: testuale esatto (case-sensitive) tra
  `school_calendar_events.comune` e `kid_school_profiles.comune`. Nessuna
  normalizzazione proposta in questo V1 (stesso principio "minimo
  necessario" già seguito nel resto del modulo) — se in futuro serve
  gestire varianti ("Milano" vs "MILANO" vs "milano"), va aggiunta una
  normalizzazione esplicita a un livello successivo, non qui.
- **`profile.comune` può essere `null`** (colonna opzionale in
  `kid_school_profiles`, "solo per chiusure/ponti locali"): in quel caso
  `localEvents` resta sempre `[]` — un bambino senza comune impostato
  riceve SOLO la baseline regionale, comportamento sicuro e prevedibile
  (nessun errore, nessun evento locale "indovinato").
- **Nessuna nuova query**: stesso numero di round-trip di oggi (una singola
  `.select()` su `school_calendar_events` per tutti i `calendarIds`
  coinvolti) — la colonna `comune` viaggia nella stessa riga, non serve una
  seconda tabella/join.
- **Multi-child**: già supportato dal loop esistente su `kidIds` — ogni
  bambino risolve la propria combinazione region+comune indipendentemente,
  nessuna modifica strutturale al loop.
- **`getKidSchoolProfilesForParent`** (usata da Profilo/Child School
  Profile) non necessita modifiche: non legge mai `school_calendar_events`,
  resta invariata.
- **Admin UI** (`SchoolCalendarAdminClient.tsx`): il form "Nuovo evento"
  andrebbe esteso con un campo opzionale "Comune (vuoto = evento
  regionale)" — fuori scope di questo audit (nessuna modifica al codice
  applicativo in questa sessione), ma necessario prima che Fabrizio possa
  inserire eventi locali dalla UI invece che via SQL diretto.
