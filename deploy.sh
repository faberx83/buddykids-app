#!/bin/bash
# Deploy BuddyKids in produzione + riallineamento alias temporanei
# partner/admin (finché non si ha il dominio buddykids.app vero).
#
# Uso: dalla cartella del progetto, esegui:
#   bash deploy.sh

set -e

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
