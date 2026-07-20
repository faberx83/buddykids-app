#!/bin/bash
#
# Esegue la suite Playwright contro il deploy di produzione reale, subito
# dopo averlo pubblicato — dà lo "stato dell'arte" (cosa funziona/cosa no)
# sulla stessa versione appena andata online. Non chiama mai "vercel" e non
# produce mai un deploy: può essere invocato direttamente (senza passare da
# deploy.sh) per testare in sicurezza contro un deployment già esistente.
#
# Uso:
#   bash test-deploy.sh                                       # contro l'URL di produzione stabile, suite intera
#   bash test-deploy.sh https://altro-url.vercel.app           # contro un altro URL (es. un preview)
#   TEST_SCOPE=smoke bash test-deploy.sh                       # solo smoke cross-portale (lista esplicita, vedi sotto)
#   TEST_SCOPE=journeys bash test-deploy.sh                    # solo journey cross-portale approvate (vuoto in Sprint 0)
#   TEST_SCOPE=all bash test-deploy.sh                         # suite intera, esplicito (= comportamento di default)
#   ALLOW_TEST_FAILURES=1 bash test-deploy.sh                  # non blocca sull'esito test (comportamento esplicito, non più il default)
#   RUN_SITEMAP=1 bash test-deploy.sh                          # esegue ANCHE la sitemap dopo la suite (skip di default, vedi sotto)
#   ONLY_SITEMAP=1 SITEMAP_OPEN_BROWSER=1 bash test-deploy.sh  # solo sitemap, apertura browser opzionale
#
# Richiede le credenziali degli account di test in ".env.test" (copia
# ".env.test.example" e compilalo una volta sola — vedi quel file).
# Senza ".env.test" i test che richiedono login reale falliscono (i test
# di sola lettura in modalità mock/pubblica girano comunque).
#
# Sitemap NON più generata di default ad ogni deploy (richiesta esplicita di
# Fabrizio, luglio 2026): il crawl di 3 portali x 2 browser produce centinaia
# di pagine analizzate ad ogni singolo deploy, un costo non giustificato
# quando non serve verificarla. Ora serve RUN_SITEMAP=1 esplicito per
# includerla nella suite ordinaria; resta comunque disponibile standalone in
# qualsiasi momento con ONLY_SITEMAP=1 (vedi sopra), senza bisogno di un
# deploy completo.
#
# TRAMA ONE Build Sprint 0 — adattamenti rispetto alla versione precedente
# (vedi docs/trama-one/analysis/SPRINT_0_TECH_NOTES.md):
#  1. ALLOW_TEST_FAILURES=1 è ora ESPLICITO: senza impostarlo, l'exit code
#     riflette l'esito reale della suite Playwright (prima era sempre 0).
#  2. TEST_SCOPE=smoke|journeys|all seleziona una lista ESPLICITA di file
#     (non tag, non modifica ai 53 spec esistenti in
#     tests/genitori|gestore|admin|nextgen — nessuno di essi viene toccato).
#  3. ONLY_SITEMAP è intercettato PRIMA del cleanup dati e della suite
#     ordinaria (prima ancora era dopo il cleanup).
#  4. SITEMAP_OPEN_BROWSER=1 controlla l'apertura del browser, con fallback
#     esplicito se "open" non è disponibile (compatibilità headless/non-macOS).

BASE_URL="${1:-https://buddykids-app.vercel.app}"

if [ -f .env.test ]; then
  set -a
  source .env.test
  set +a
else
  echo "⚠️  Nessun .env.test trovato — i test che richiedono login reale (Gestore/Admin/prenotazioni) verranno saltati o falliranno."
  echo "   Copia .env.test.example in .env.test e compilalo con le credenziali di test (vedi README)."
  echo ""
fi

# Lista esplicita e documentata di smoke test (TRAMA ONE Build Sprint 0,
# Final Plan Correction punto 4): NESSUN tag, NESSUNA modifica ai file
# esistenti. Un file rappresentativo per ciascun portale AS-IS più i due
# nuovi smoke TRAMA ONE.
SMOKE_TEST_FILES="tests/genitori/login.spec.ts tests/nextgen/smoke.spec.ts tests/gestore/dashboard.spec.ts tests/admin/dashboard.spec.ts tests/one/smoke.spec.ts"

# Nessuna journey cross-portale di business è nello scope Sprint 0 (Request
# lifecycle, Booking e Offering sono tutti fuori scope) — lista vuota,
# popolata a partire da Build Sprint 3-4.
JOURNEY_TEST_FILES=""

apri_sitemap_se_richiesto() {
  if [ -n "$SITEMAP_OPEN_BROWSER" ]; then
    if command -v open >/dev/null 2>&1; then
      echo "🌐 Apro le sitemap..."
      open sitemap-output/chromium/index.html
    else
      echo "ℹ️  SITEMAP_OPEN_BROWSER impostato ma il comando 'open' non è disponibile su questo sistema (non-macOS/headless)."
      echo "ℹ️  Percorso del file generato: sitemap-output/chromium/index.html"
    fi
  else
    echo "ℹ️  Sitemap generata in sitemap-output/chromium/index.html (imposta SITEMAP_OPEN_BROWSER=1 per aprirla automaticamente)."
  fi
}

# ────────────────────────────────────────────────────────────────
# ONLY_SITEMAP: intercettato QUI, PRIMA del cleanup dati e della suite
# Playwright ordinaria. Esegue esclusivamente: validazione variabili (solo
# BASE_URL, già risolta sopra con default), generazione sitemap, output,
# apertura opzionale, exit code coerente. Nessun deploy, nessun cleanup
# completo, nessuna suite ordinaria.
# ────────────────────────────────────────────────────────────────
if [ -n "$ONLY_SITEMAP" ]; then
  echo "🗺️  ONLY_SITEMAP impostato: genero SOLO la sitemap contro $BASE_URL (nessun deploy, nessun cleanup, nessuna suite ordinaria)."
  echo ""
  TEST_BASE_URL="$BASE_URL" npx playwright test tests/sitemap.spec.ts
  SITEMAP_EXIT_CODE=$?
  echo ""
  apri_sitemap_se_richiesto
  exit $SITEMAP_EXIT_CODE
fi

node tests/cleanup-test-data.mjs || echo "⚠️  Cleanup dati di test fallito o parziale — proseguo comunque (non bloccante), ma i test successivi potrebbero leggere dati non ripuliti."
echo ""

echo "🧪 Eseguo la suite Playwright contro: $BASE_URL"
if [ -n "$TEST_SCOPE" ]; then
  echo "   TEST_SCOPE=$TEST_SCOPE"
fi
if [ -n "$ALLOW_TEST_FAILURES" ]; then
  echo "⚠️  ALLOW_TEST_FAILURES=1 impostato: i test falliti NON bloccheranno l'esito di questo script (modalità permissiva esplicita)."
fi
echo ""

case "$TEST_SCOPE" in
  smoke)
    TEST_TARGET="$SMOKE_TEST_FILES"
    ;;
  journeys)
    if [ -z "$JOURNEY_TEST_FILES" ]; then
      echo "ℹ️  TEST_SCOPE=journeys ma nessuna journey cross-portale è nello scope di questo sprint (Request/Booking/Offering fuori scope) — nessun test eseguito."
      TEST_TARGET="__EMPTY__"
    else
      TEST_TARGET="$JOURNEY_TEST_FILES"
    fi
    ;;
  all|"")
    TEST_TARGET="" # nessun argomento = intera suite, comportamento invariato
    ;;
  *)
    echo "⚠️  TEST_SCOPE sconosciuto: '$TEST_SCOPE' — eseguo l'intera suite (comportamento di default 'all')."
    TEST_TARGET=""
    ;;
esac

if [ "$TEST_TARGET" = "__EMPTY__" ]; then
  TEST_EXIT_CODE=0
elif [ -n "$ALLOW_TEST_FAILURES" ]; then
  TEST_BASE_URL="$BASE_URL" npx playwright test $TEST_TARGET || true
  TEST_EXIT_CODE=0
else
  TEST_BASE_URL="$BASE_URL" npx playwright test $TEST_TARGET
  TEST_EXIT_CODE=$?
fi

echo ""
if [ -n "$RUN_SITEMAP" ]; then
  echo "🗺️ Genero la sitemap (RUN_SITEMAP=1)..."
  # La generazione sitemap resta sempre "best effort": è un report accessorio,
  # non un gate di qualità — un suo fallimento non deve mai far fallire questo
  # script, ma va comunque segnalato in modo visibile (prima era silenzioso).
  TEST_BASE_URL="$BASE_URL" npx playwright test tests/sitemap.spec.ts || echo "⚠️  Generazione sitemap fallita o parziale — non bloccante."
else
  echo "🗺️ Sitemap NON generata (skip di default — imposta RUN_SITEMAP=1 se ti serve verificarla, oppure ONLY_SITEMAP=1 per generarla da sola senza deploy)."
fi

echo ""
echo "📊 Report dettagliato: npx playwright show-report  (oppure: bash report.sh)"

if [ -n "$RUN_SITEMAP" ]; then
  echo ""
  apri_sitemap_se_richiesto
fi

if [ "$TEST_EXIT_CODE" != "0" ]; then
  echo ""
  echo "❌ La suite Playwright ha test falliti (exit code $TEST_EXIT_CODE)."
fi

exit $TEST_EXIT_CODE
