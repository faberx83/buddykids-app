# TRAMA ONE — Feature Inventory Complete (Sezione 3)

Ricerca sistematica nel codice (non dalla documentazione) di ogni funzionalità nascosta, spenta/disabilitata o mock/demo — perimetro escluso `node_modules`, `.next`, `tests/`. Metodologia: ricerca testuale mirata (`isSupabaseConfigured`, "Non ancora attiv", "Coming soon", "in arrivo", `TRAMA_ONE_ENABLED`, fallback a `lib/mock-data.ts`, bottoni `disabled` hardcoded, pagine senza link in navigazione) più lettura diretta dei file trovati.

## ⚠️ Rischio reale da segnalare prima della tabella

Alcune funzioni dati (`lib/data/activities.ts`, `groups.ts`, `calendar.ts`, `tags.ts`, `kids.ts`) ricadono su `lib/mock-data.ts` **anche quando Supabase è configurato**, se la query ritorna 0 righe o un errore — commento esplicito nel codice: *"Nessun dato reale ancora... non rompiamo l'app, mostriamo comunque i dati demo."* Questo è un rischio concreto per l'MVP: un centro o un'attività reale ma temporaneamente vuota (es. appena creata, zero righe scritte) mostrerebbe dati FINTI a un utente vero, senza alcun avviso — comportamento diverso e più rischioso del semplice "demo mode" quando Supabase non è affatto configurato (quello è innocuo, riguarda solo ambienti locali/di test).

## Funzionalità NASCOSTE (esistono, non raggiungibili da un link/voce di menu per un utente normale)

| # | File | Cosa fa | Nota |
|---|---|---|---|
| 1 | `app/admin/layout.tsx:66-77` | Voce menu "Command Center" (`/admin/one`) compare solo se `resolveFeatureFlag(TRAMA_ONE_ENABLED)` risolve `true` per l'admin loggato | Corretto per design (DEC-62): prima non c'era proprio nessun link, ora è condizionato |
| 2 | `app/center/account/preferenze/page.tsx:16-34` | Bottone "Riavvia tour guidato" visibile solo se il flag risolve `true` per l'utente Partner | Coerente: nessun senso a mostrarlo se il tour stesso non è attivo |
| 3 | `app/nextgen/planner/logistica/page.tsx` | Route storica (hub Logistica pre-Sprint 7): nessun link in nessuna nav, esiste solo come redirect a `/nextgen/profile/famiglia` per non rompere bookmark salvati | Comportamento voluto, non un gap da chiudere |

## Funzionalità SPENTE (esistono nel codice, deliberatamente disattivate o mostrate come "in arrivo")

| # | File | Cosa fa | Nota |
|---|---|---|---|
| 1 | `app/one/layout.tsx`, `app/center/one/layout.tsx`, `app/admin/one/layout.tsx` | Le 3 shell "TRAMA ONE" (Parent/Partner/Admin): `redirect()` verso la home Legacy/`/center`/`/admin` se `TRAMA_ONE_ENABLED=false` (default per chiunque non sia nella Controlled Beta Cohort o `platform_admin`) | Coerente con DEC-57: mai on-by-default |
| 2 | `app/center/layout.tsx` | Overlay Spotlight Partner: se flag off, `spotlightProgress=null`, il componente non renderizza nulla (nessun errore) | Vedi Sezione 2, root cause dello stesso meccanismo per il caso Fabrizio oggi |
| 3 | `components/ProfileSettingsSection.tsx` (lato genitore) | Sottotitolo "tour guidato" nel menu Preferenze presente solo lato Partner — lo Spotlight Parent non è ancora costruito (task #441, pending) | Item di backlog noto, non un bug |
| 4 | `components/RoleSwitcher.tsx:43` | Selettore "ruolo demo" per login senza Supabase: `if (isSupabaseConfigured) return null` | Corretto per design — non deve mai apparire con backend reale |
| 5 | `components/ProfilePreferencesSection.tsx` | "Lingua" e "Tema" mostrano badge "Non ancora attivo" — nessuna persistenza reale | Dichiarato esplicitamente all'utente, non un gap nascosto |
| 6 | `components/ProfileSettingsSection.tsx`, `app/(main)/profile/page.tsx` | "Metodi di pagamento", "Ricevute e fatture" — voci `comingSoon`, nessuna integrazione pagamenti | Coerente con l'assenza di un gateway pagamenti nell'MVP |
| 7 | `app/nextgen/profile/impostazioni/ImpostazioniHubClient.tsx`, `ProfileNextgenClient.tsx` | Stesse voci `comingSoon` replicate lato NEXTGEN | Idem |
| 8 | `app/(main)/prenotazioni/PrenotazioniClient.tsx` | Tab "Vista calendario" — badge "in arrivo", funzione non implementata | Solo UI, nessuna azione dietro |
| 9 | `app/nextgen/planner/promemoria/PromemoriaClient.tsx` | Toggle "Integrazione Google Calendar"/"Integrazione Maps" — "in arrivo", non collegati a nessuna API esterna | Toggle presenti ma inerti |
| 10 | `components/GroupsClient.tsx` | "Scopri gruppi pubblici"/"Inviti ricevuti" — testo statico "funzionalità in arrivo" | Nessuna azione dietro |
| 11 | `app/booking/[id]/BookingClient.tsx` | Badge "in arrivo" su un metodo/opzione di pagamento booking non attiva | Idem |

## Funzionalità MOCK/demo (dati finti invece di Supabase reale)

| # | File | Condizione di attivazione | Rischio |
|---|---|---|---|
| 1 | `lib/data/activities.ts` (righe ~157-166) | Supabase configurato ma `activities` ritorna 0 righe/errore → fallback silenzioso a `mockActivities` | **Alto** — vedi avviso sopra |
| 2 | `lib/data/groups.ts`, `calendar.ts`, `tags.ts`, `kids.ts` | Stesso pattern, ma condizionato SOLO a `!isSupabaseConfigured` (mock strutturale, non attivo se le chiavi sono impostate) | Basso — irrilevante se le env var Vercel sono corrette (da verificare, punto aperto Sezione 2 §6) |
| 3 | `lib/data/profile.ts` | `DEMO_PROFILE`/`demoGestore` se `!isSupabaseConfigured` | Basso, stesso motivo |
| 4 | `lib/data/partner-offers.ts` | `mockOffers` (tutti `active:true` forzato) se `!isSupabaseConfigured` | Basso |
| 5 | `app/admin/centers/page.tsx` | `DemoBadge` esplicito quando Supabase non configurato | Nessuno — badge visibile, non ingannevole |
| 6 | `app/(main)/profile/page.tsx` | `DemoBadge` su contatori profilo genitore | Nessuno — badge visibile |
| 7 | `app/nextgen/planner/promemoria/PromemoriaClient.tsx` | `DemoBadge "Anteprima"` — promemoria mostrati sono solo anteprima statica | Nessuno — dichiarato |
| 8 | `PromotionsClient.tsx`, `CenterProfileClient.tsx`, `ActivityEditForm.tsx`, `AvailabilityCalendar.tsx` | `DemoBadge` per-record quando l'attività/centro specifico non ha un `dbId` reale | Nessuno — badge visibile, per-record non per-app |

## Aree cercate senza risultati

- **Bottoni incondizionatamente disabilitati** (`disabled` hardcoded a `true` indipendentemente da stato/dati): nessuno trovato. I 2 unici `disabled` letterali nel codice (`DetailClient.tsx`, `BookingSuccessActions.tsx`) vivono dentro rami ternari condizionali, non sono sempre-attivi.
- **Pagine realmente orfane** (nessun link raggiungibile da nessuna navigazione): nessuna trovata. Route apparentemente non in bottom-nav (`/prenotazioni`, `/presenze`, `/richieste`, `/preferiti`) sono comunque linkate da `MenuItem` in `app/(main)/profile/page.tsx`; `/center-leads` è raggiungibile da NEXTGEN anche se non da LEGACY.

## Conclusione

Nessuna funzionalità "fantasma" (costruita ma mai collegata a nulla) trovata oltre a quanto già noto e documentato. L'unico rischio da chiudere prima di settembre è il fallback silenzioso a mock data con Supabase configurato ma tabella vuota/in errore (item Mock #1) — da valutare se sostituire con uno stato vuoto esplicito invece di dati finti, in particolare per centri/attività reali appena creati.
