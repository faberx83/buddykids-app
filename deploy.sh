#!/bin/bash
# Deploy BuddyKids/TRAMA in produzione + riallineamento alias temporanei
# partner/admin (finché non si ha il dominio buddykids.app vero) + suite di
# test Playwright automatica contro il deploy appena pubblicato.
#
# Uso: dalla cartella del progetto, esegui:
#   bash deploy.sh
#   SKIP_TESTS=1 bash deploy.sh                    # salta i test (deploy rapido, senza verifica)
#   ONLY_SITEMAP=1 bash deploy.sh                  # SOLO sitemap, nessun deploy (vedi sotto)
#   ALLOW_TEST_FAILURES=1 bash deploy.sh           # non blocca su test falliti (passato a test-deploy.sh)
#   TEST_SCOPE=smoke|journeys|all bash deploy.sh   # scope dei test (passato a test-deploy.sh)
#   ALLOW_PROD_FROM_NON_MAIN=1 bash deploy.sh      # override esplicito per deployare da un branch diverso da main
#
# TRAMA ONE Build Sprint 0 — adattamenti rispetto alla versione precedente
# (vedi docs/trama-one/analysis/SPRINT_0_TECH_NOTES.md per il dettaglio):
#  1. ONLY_SITEMAP intercettato QUI, prima di push/deploy/alias — non produce
#     più un deploy production solo per generare la sitemap.
#  2. Preflight di sicurezza sul branch: blocca il deploy production se il
#     branch corrente non è "main", salvo override esplicito
#     ALLOW_PROD_FROM_NON_MAIN=1.
#  3. TEST_SCOPE/ALLOW_TEST_FAILURES sono semplicemente inoltrati a
#     test-deploy.sh (che li gestisce, vedi quello script).

set -e

# ────────────────────────────────────────────────────────────────
# ONLY_SITEMAP: intercettato PRIMA di qualunque git push / vercel --prod /
# alias set / cleanup completo / suite Playwright ordinaria. Delega
# interamente a test-deploy.sh (che già supporta ONLY_SITEMAP in modo
# deploy-free, non chiama mai vercel) contro l'URL di produzione corrente.
# Nessun nuovo deploy applicativo viene prodotto in questo ramo.
# ────────────────────────────────────────────────────────────────
if [ -n "$ONLY_SITEMAP" ]; then
  echo "🗺️  ONLY_SITEMAP impostato: genero SOLO la sitemap, nessun deploy production."
  echo ""
  bash test-deploy.sh https://buddykids-app.vercel.app
  exit $?
fi

# ────────────────────────────────────────────────────────────────
# Preflight di sicurezza branch/commit prima di push+deploy production.
# Vedi docs/trama-one/analysis/TRAMA_ONE_Impact_Assessment_v1.0.md e il
# Final Plan Correction dello Sprint 0 per l'analisi del rischio: questo
# script esegue "git push origin main" (il ramo LOCALE letteralmente
# chiamato "main", non il branch corrente) e poi "vercel --prod" (che
# pubblica il WORKING TREE corrente, indipendentemente dal branch) — da un
# branch diverso da main questi due passi possono pubblicare in produzione
# contenuto diverso da quanto risulta pushato su GitHub main.
# ────────────────────────────────────────────────────────────────
CURRENT_BRANCH="$(git branch --show-current)"
CURRENT_COMMIT="$(git rev-parse --short HEAD)"
if [ -z "$(git status --porcelain)" ]; then
  TREE_STATUS="clean"
else
  TREE_STATUS="dirty"
fi

echo "🔎 Preflight branch/deploy:"
echo "   branch corrente:       $CURRENT_BRANCH"
echo "   commit corrente:       $CURRENT_COMMIT"
echo "   working tree:          $TREE_STATUS"
echo "   comando di push:       git push origin main (pubblica il ramo locale 'main', NON il branch corrente se diverso)"
echo "   contenuto pubblicato:  vercel --prod pubblica il working tree di '$CURRENT_BRANCH', indipendentemente da cosa viene pushato"

if [ "$CURRENT_BRANCH" != "main" ]; then
  if [ -n "$ALLOW_PROD_FROM_NON_MAIN" ]; then
    echo ""
    echo "⚠️  ATTENZIONE: branch corrente '$CURRENT_BRANCH' diverso da 'main'."
    echo "⚠️  Override ALLOW_PROD_FROM_NON_MAIN=1 utilizzato — procedo comunque."
    echo "⚠️  Il push pubblicherà il ramo locale 'main' (probabilmente NON allineato a '$CURRENT_BRANCH')."
    echo "⚠️  La produzione Vercel riceverà invece il working tree di '$CURRENT_BRANCH'."
  else
    echo ""
    echo "🛑 Deploy production bloccato: branch corrente '$CURRENT_BRANCH' diverso da 'main'."
    echo "🛑 Per procedere comunque (sconsigliato salvo motivo esplicito): ALLOW_PROD_FROM_NON_MAIN=1 bash deploy.sh"
    echo "🛑 Nessun push, nessun deploy, nessun alias eseguito."
    exit 1
  fi
fi

echo ""
echo "📤 Push su GitHub (origin/main)..."
git push origin main || echo "⚠️  Push saltato/fallito (magari non c'è nulla di nuovo da inviare, o va autenticato la prima volta) — continuo comunque col deploy."

echo ""
echo "🔎 Deployment precedentemente live (per riferimento rollback manuale):"
npx vercel ls buddykids-app --prod 2>&1 | head -5 || echo "   (non disponibile — usare 'vercel ls buddykids-app' o la dashboard Vercel per il rollback manuale)"

echo ""
echo "🚀 Deploy in produzione su Vercel..."
npx vercel --prod

echo ""
echo "🔗 Riallineo gli alias temporanei all'ultimo deploy..."
ALIAS_PARTNER_OK=1
ALIAS_ADMIN_OK=1
npx vercel alias set buddykids-app.vercel.app buddykids-partner.vercel.app || ALIAS_PARTNER_OK=0
npx vercel alias set buddykids-app.vercel.app buddykids-admin.vercel.app || ALIAS_ADMIN_OK=0

echo ""
echo "✅ Riepilogo alias:"
if [ "$ALIAS_PARTNER_OK" = "1" ]; then
  echo "   buddykids-partner.vercel.app: OK"
else
  echo "   buddykids-partner.vercel.app: FALLITO — verificare manualmente, stato potenzialmente incoerente"
fi
if [ "$ALIAS_ADMIN_OK" = "1" ]; then
  echo "   buddykids-admin.vercel.app: OK"
else
  echo "   buddykids-admin.vercel.app: FALLITO — verificare manualmente, stato potenzialmente incoerente"
fi

echo ""
echo "✅ Fatto! Deploy pubblicato:"
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
