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

Contro un deploy reale (Supabase configurato):

```bash
TEST_BASE_URL=https://buddykids-app.vercel.app \
TEST_PARENT_EMAIL=... TEST_PARENT_PASSWORD=... \
TEST_CENTER_ADMIN_EMAIL=... TEST_CENTER_ADMIN_PASSWORD=... \
TEST_PLATFORM_ADMIN_EMAIL=... TEST_PLATFORM_ADMIN_PASSWORD=... \
npx playwright test
```

Il workflow `.github/workflows/playwright.yml` fa gia' girare tutto ad ogni
push/PR (modalita' mock) e pubblica il report come artifact scaricabile.
Per farlo girare anche contro il deploy reale, aggiungi le stesse variabili
come Secrets del repo e lancialo manualmente (workflow_dispatch) passando
`base_url`.

## Cosa e' davvero implementato oggi

Non ho potuto eseguire i test in questa sessione (sandbox senza accesso di
rete al deploy e senza permessi per installare le dipendenze di sistema di
Chromium) — il codice e' stato scritto leggendo i sorgenti reali del repo
(selettori, testi, route), ma va verificato con una prima esecuzione vera
prima di fidarsene in CI.

- **~28 test completamente implementati** (asserzioni + interazioni reali),
  in `tests/genitori/home.spec.ts`, `cerca.spec.ts`, `attivita.spec.ts`,
  `gruppi.spec.ts`, `tests/gestore/dashboard.spec.ts`, `attivita.spec.ts`,
  `tests/admin/dashboard.spec.ts`, `gestione.spec.ts`.
- **~37 test "scaffold"** (`test.fixme`, saltati di default): un blocco per
  ogni TC-ID rimanente, con precondizioni/passi/risultato atteso presi
  parola per parola dalla tua matrice come commento, pronti da completare
  seguendo lo stesso pattern degli esempi sopra.
- **~28 test esplicitamente esclusi** (`test.fixme` con motivo commentato):
  richiedono SQL Editor Supabase, domini/alias non pubblicati, un secondo
  account genitore reale, o dipendono da funzionalita' che risultano non
  ancora presenti nel repo GitHub ispettato (Planner/Per bambino, upload
  immagini, redesign dashboard v6a — probabilmente sviluppate in una sessione
  locale non ancora pushata: verificarle dopo il push).
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
