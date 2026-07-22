# BuddyKids — Test automation (Playwright)

Suite generata a partire da `BuddyKids_Test_Case.xlsx` (121 casi). Ogni test e'
taggato con l'ID corrispondente (`TC-xxx`) per tracciabilita' 1:1 con la matrice.

## Come si esegue

```bash
npm install
npx playwright install --with-deps chromium
npx playwright test                 # locale, dati mock (nessuna chiave Supabase necessaria)
npx playwright show-report          # apre il report HTML
```

### Preparazione (una tantum) — centro/attività di test dedicati

I test di scrittura (prenotazione, gruppi, inviti...) girano contro il
database di produzione con gli account di `.env.test`: serve un centro e
un'attività "sandbox" isolati dai dati reali, così i test non toccano mai
clienti veri. Vedi `supabase/seed-test-data.sql`: crea/promuove tutto il
necessario (centro `[TEST]`, attività `[TEST]` con 13 settimane prenotabili,
ruoli `center_admin`/`platform_admin`, un bambino di test) — è idempotente,
si può rilanciare quando serve. Precondizione: i 3 account devono già
esistere (registrati via app), lo script promuove solo i ruoli.

Prima di ogni run, `test-deploy.sh` lancia anche
`tests/cleanup-test-data.mjs`, che ripulisce prenotazioni/gruppi/inviti/
attività extra generati dai test precedenti (tenendo il centro/attività/
bambino "seed" intatti), così i run ripetuti non accumulano dati sporchi.
Richiede `SUPABASE_SERVICE_ROLE_KEY` in `.env.test` (vedi
`.env.test.example`) — se assente viene semplicemente saltata.

### Contro il deploy reale — subito dopo ogni deploy

`bash deploy.sh` lancia la suite in automatico appena finito di pubblicare
(vedi `test-deploy.sh`), usando le credenziali in `.env.test` (copia
`.env.test.example`, compilalo una volta con account di TEST dedicati — non
i tuoi account reali, vedi il file per i motivi). Se `.env.test` manca, i
test che richiedono login reale vengono saltati/falliscono, ma il deploy non
si blocca comunque.

Per saltare i test su un deploy (es. una modifica piccola, vuoi essere
rapido): `SKIP_TESTS=1 bash deploy.sh`.

Per rilanciarli a mano in qualsiasi momento, senza rideployare:
```bash
bash test-deploy.sh                                   # contro l'URL di produzione
bash test-deploy.sh https://un-altro-url.vercel.app    # contro un altro URL (es. preview)
```

## Cosa e' davvero implementato oggi

Non ho potuto eseguire i test in questa sessione (sandbox senza accesso di
rete al deploy e senza permessi per installare le dipendenze di sistema di
Chromium) — il codice e' stato scritto leggendo i sorgenti reali del repo
(selettori, testi, route), ma va verificato con una prima esecuzione vera
prima di fidarsene in CI.

- **~50 test completamente implementati** (asserzioni + interazioni reali),
  in `tests/genitori/home.spec.ts`, `home-planner.spec.ts`, `cerca.spec.ts`,
  `attivita.spec.ts`, `prenotazione.spec.ts` (parziale), `gruppi.spec.ts`,
  `tests/gestore/dashboard.spec.ts`, `attivita.spec.ts`,
  `tests/admin/dashboard.spec.ts`, `gestione.spec.ts`.
- **Aggiornamento**: i test che risultavano "PENDING: funzionalità non
  presente nel repo GitHub ispezionato" (Planner/Per bambino, week-lock,
  formato date, redesign dashboard v6a, condividi/calendario) sono stati
  verificati contro il codice attuale — la funzionalità *è* presente, quel
  commento era ormai superato — e i test sono stati implementati per davvero
  in `home-planner.spec.ts`, `prenotazione.spec.ts` (TC-108/109/110/111/112)
  e `gestore/dashboard.spec.ts` (TC-119/120/121). Nel farlo, TC-072 è stato
  anche corretto: asseriva ancora "Le tue attività" e "Promozioni attive",
  testi che il redesign ha sostituito con "Attività recente" e "Promo
  attive" — sarebbe rimasto verde per il posto sbagliato.
- **~25 test rimasti "scaffold"** (`test.fixme`, saltati di default): un
  blocco per ogni TC-ID rimanente, con precondizioni/passi/risultato atteso
  presi parola per parola dalla matrice come commento, pronti da completare
  seguendo lo stesso pattern degli esempi sopra.
- **Test esplicitamente esclusi** (`test.fixme` con motivo commentato):
  richiedono SQL Editor Supabase, domini/alias non pubblicati, o un secondo
  account genitore reale (es. TC-107 multi-bambino end-to-end).
- **3 casi** (TC-098/099/100, area "Fuori scope attuale") non hanno alcun
  test: la funzionalita' non esiste, per tua stessa nota nella matrice.

## Scoperta importante sulla modalita' "Ruolo demo"

Il selettore "Ruolo demo" (in basso a destra) funziona SOLO quando Supabase
NON e' configurato (`isSupabaseConfigured === false`, vedi
`components/RoleSwitcher.tsx`). In quella modalita' anche le azioni di
scrittura via server action (creazione gruppo, promozione, tag, attivita...)
ritornano `{ error: "Supabase non configurato" }` — vedi ad es.
`app/actions/groups.ts`. Significa che:

- i test di **lettura/UI** (navigazione, filtri, visualizzazione dati mock)
  girano bene in locale, senza alcuna chiave;
- i test che **scrivono dati** (prenotazione, creazione gruppo/attivita/tag,
  promozioni, upload immagini) richiedono un deploy con Supabase configurato
  + un login reale (`loginAs()` in `tests/fixtures/roles.ts`) al posto del
  ruolo demo, con account di test gia' promossi ai ruoli giusti (vedi sezione
  README principale "Promuovere un utente").

**Conseguenza pratica**: contro un deploy reale (`test-deploy.sh`, sempre con
Supabase configurato) i test basati su `gotoAsRole()` non troveranno mai
niente di significativo — cercano dati mock che in produzione non esistono.
Da quando è stato scoperto (prima esecuzione vera contro produzione, con ~37
test falliti "a vuoto" su questo), `gotoAsRole()` in `tests/fixtures/roles.ts`
si auto-salta (`test.skip`) quando rileva `TEST_BASE_URL` puntato a un URL
reale (non `localhost`) — quindi nel report li vedrai come **skipped**, non
più **failed**, quando giri contro produzione. Restano eseguibili normalmente
in locale (`npx playwright test` senza `TEST_BASE_URL`, dove Supabase non è
configurato). Se un test ti serve anche contro un deploy reale, va riscritto
per usare `loginAs()` + dati seminati da `supabase/seed-test-data.sql` invece
di `gotoAsRole()` — è il pattern seguito da tutti i test aggiunti dopo questa
scoperta (`home-planner.spec.ts`, TC-108+ in `prenotazione.spec.ts`,
`gestore/invites.spec.ts`).

**`tests/genitori/prenotazione.spec.ts` contro un deploy reale — usare
`--workers=1`**: molti test in questo file (TC-191, TC-292/293/294/295...)
leggono/scrivono DAVVERO le stesse prenotazioni condivise sull'unico account
genitore di test. Il file ha `test.describe.configure({ mode: "serial" })`
per evitare che questi test corrano in ordine sparso all'interno dello
stesso progetto Playwright — ma Playwright esegue comunque il progetto
`chromium` e il progetto `mobile-chrome` in parallelo tra loro di default,
quindi le due esecuzioni seriali possono ancora sovrapporsi UNA CONTRO
L'ALTRA sullo stesso account reale (osservato: TC-293 su mobile-chrome che
legge "nessuna settimana" mentre TC-294 su chromium sta cancellando per
davvero la stessa prenotazione, nello stesso istante). Per un gate
affidabile contro produzione, esegui questo file (da solo o insieme a
`giorni-spot.spec.ts`) con `--workers=1`:

```
TEST_BASE_URL=<url> npx playwright test tests/genitori/prenotazione.spec.ts tests/genitori/giorni-spot.spec.ts --reporter=list --workers=1
```

Con più worker (il default `deploy.sh`/`test-deploy.sh` per la suite
completa) qualche fallimento intermittente su questo file specifico è
possibile per questo motivo — non indica di per se' una regressione
applicativa, ma va comunque confermato con un rerun `--workers=1` prima di
concludere che sia solo rumore.

## Struttura

```
tests/
  fixtures/roles.ts       Helper ruolo demo (mock) + login reale (Supabase)
  setup/                  Auth, promozione ruoli, logout
  genitori/                Home, Cerca, Attivita, Prenotazione, Gruppi,
                           Accompagnamento, Calendario, Profilo
  gestore/                Dashboard, Attivita, Promozioni, Profilo Centro,
                           Richieste Gruppo
  admin/                  Dashboard, Gestione, Analytics, Richieste Gruppo
  manual/                 Multi-tenant/PWA (richiede domini reali, non
                           automatizzabile senza infra pubblicata)
```
