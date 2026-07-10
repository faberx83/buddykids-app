#!/bin/bash
# Deploy BuddyKids in produzione + riallineamento alias temporanei
# partner/admin (finché non si ha il dominio buddykids.app vero) + suite di
# test Playwright automatica contro il deploy appena pubblicato.
#
# Uso: dalla cartella del progetto, esegui:
#   bash deploy.sh
#   SKIP_TESTS=1 bash deploy.sh    # salta i test (deploy rapido, senza verifica)

set -e

echo "📤 Push su GitHub (origin/main)..."
git push origin main || echo "⚠️  Push saltato/fallito (magari non c'è nulla di nuovo da inviare, o va autenticato la prima volta) — continuo comunque col deploy."

echo ""
echo "🚀 Deploy in produzione su Vercel..."
npx vercel --prod

echo ""
echo "🔗 Riallineo gli alias temporanei all'ultimo deploy..."
npx vercel alias set buddykids-app.vercel.app buddykids-partner.vercel.app
npx vercel alias set buddykids-app.vercel.app buddykids-admin.vercel.app

echo ""
echo "✅ Fatto! Deploy pubblicato e alias aggiornati:"
echo "   https://buddykids-app.vercel.app"
echo "   https://buddykids-partner.vercel.app"
echo "   https://buddykids-admin.vercel.app"

if [ -n "$SKIP_TESTS" ]; then
  echo ""
  echo "⏭️  Test saltati (SKIP_TESTS impostato)."
else
  echo ""
  echo "🧪 Verifico lo stato dell'arte con la suite di test..."
  bash test-deploy.sh https://buddykids-app.vercel.app
fi
