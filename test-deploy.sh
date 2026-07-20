#!/bin/bash
#
# Esegue la suite Playwright contro il deploy di produzione reale, subito
# dopo averlo pubblicato — dà lo "stato dell'arte" (cosa funziona/cosa no)
# sulla stessa versione appena andata online.
#
# Uso:
#   bash test-deploy.sh                                    # contro l'URL di produzione stabile
#   bash test-deploy.sh https://altro-url.vercel.app        # contro un altro URL (es. un preview)
#
# Richiede le credenziali degli account di test in ".env.test" (copia
# ".env.test.example" e compilalo una volta sola — vedi quel file).
# Senza ".env.test" i test che richiedono login reale falliscono (i test
# di sola lettura in modalità mock/pubblica girano comunque).
#
# Nota: questo script NON blocca/annulla nulla — il deploy è già avvenuto,
# qui stiamo solo verificando lo stato. Il codice di uscita resta 0 anche
# se dei test falliscono, così può stare in coda a deploy.sh senza farlo
# sembrare "rotto".

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

node tests/cleanup-test-data.mjs || true
echo ""

echo "🧪 Eseguo la suite Playwright contro: $BASE_URL"
echo ""

if [ -n "$ONLY_SITEMAP" ]; then
  echo ""
  echo "🗺️ Genero solo la sitemap..."

  TEST_BASE_URL="$BASE_URL" \
  npx playwright test tests/sitemap.spec.ts || true

  exit 0
fi

TEST_BASE_URL="$BASE_URL" npx playwright test || true

echo ""
echo "🗺️ Genero la sitemap..."

TEST_BASE_URL="$BASE_URL" \
npx playwright test tests/sitemap.spec.ts || true

echo ""
echo "📊 Report dettagliato: npx playwright show-report  (oppure: bash report.sh)"

echo ""
echo "🌐 Apro le sitemap..."

open sitemap-output/chromium/index.html

# Se esiste anche la versione mobile
#if [ -f sitemap-output/mobile-chrome/index.html ]; then
#  open sitemap-output/mobile-chrome/index.html
#fi
