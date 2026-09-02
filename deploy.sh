#!/bin/bash
# Deploy BuddyKids/TRAMA in produzione + riallineamento alias temporanei
# partner/admin (finché non si ha il dominio buddykids.app vero) + suite di
# test Playwright automatica contro il deploy appena pubblicato.
#
# Uso: dalla cartella del progetto, esegui:
#   bash deploy.sh                                 # deploy normale — [5/5] E2E live NON eseguiti (vedi RUN_E2E sotto)
#   RUN_E2E=1 bash deploy.sh                       # deploy + E2E live post-deploy, TEST_SCOPE=critical (default)
#   RUN_E2E=1 TEST_SCOPE=all bash deploy.sh        # deploy + suite Playwright live INTERA (entrambi i browser) —
#                                                   # usarlo prima di un rilascio o periodicamente, non ad ogni deploy
#   SKIP_TESTS=1 bash deploy.sh                    # override esplicito: forza lo skip di [5/5] anche con RUN_E2E=1
#   ONLY_SITEMAP=1 bash deploy.sh                  # SOLO sitemap, nessun deploy (vedi sotto)
#   TEST_BASE_URL=<url> ONLY_SITEMAP=1 bash deploy.sh  # sitemap contro <url> invece della produzione
#   ALLOW_TEST_FAILURES=1 bash deploy.sh           # non blocca su test falliti (passato a test-deploy.sh)
#   TEST_SCOPE=smoke|journeys|critical|all bash deploy.sh  # scope dei test (passato a test-deploy.sh)
#   INCLUDE_MOBILE=1 bash deploy.sh                # include il progetto mobile-chrome anche in TEST_SCOPE=critical
#   ALLOW_PROD_FROM_NON_MAIN=1 bash deploy.sh      # override esplicito per deployare da un branch diverso da main
#   ALLOW_DIRTY_PROD=1 bash deploy.sh              # override esplicito per deployare con working tree sporco
#   ALLOW_PUSH_FAILURES=1 bash deploy.sh           # override esplicito per proseguire anche se il push fallisce
#   DEPLOY_NOTIFY_SECRET=<secret> bash deploy.sh   # abilita la notifica di fine deploy (ok/ko) sul banner
#                                                   # dell'app Admin (/admin) — stesso secret impostato come
#                                                   # variabile d'ambiente DEPLOY_NOTIFY_SECRET su Vercel.
#                                                   # Se non impostato (né qui né in .env.deploy sotto), la
#                                                   # notifica viene semplicemente saltata (nessun impatto sul
#                                                   # deploy). Vedi supabase/migration_33_deploy_events.sql
#                                                   # (applicata) e app/internal/deploy-notify/route.ts.
#   (una tantum) cp .env.deploy.example .env.deploy, poi compila DEPLOY_NOTIFY_SECRET
#                                                   # nel file — da quel momento "bash deploy.sh" da solo invia
#                                                   # la notifica ad ogni deploy, senza doverlo scrivere ogni
#                                                   # volta sul comando (file gitignored, mai su GitHub).
#
# Ottimizzazione tempo/costo (28/07, richiesta di Fabrizio): il passo [5/5]
# di verifica post-deploy usa TEST_SCOPE=critical di default — 18 journey
# critiche, solo browser desktop — invece della suite intera x2 browser
# (~880 test), che restava la scelta giusta prima ma era troppo lenta ad ogni
# singolo deploy e pesava sull'Active CPU del piano gratuito Vercel (4h/mese
# incluse su Hobby — vedi https://vercel.com/docs/functions/usage-and-pricing).
# La suite intera resta disponibile con TEST_SCOPE=all, da usare prima di un
# rilascio o con una cadenza periodica a scelta, non dopo ogni deploy.
#
# RUN_E2E opt-in (02/09/2026, richiesta esplicita di Fabrizio: "voglio
# evitare che [i test E2E live] accada[no] automaticamente ad ogni deploy"):
# il passo [5/5] — che include cleanup dei dati di test
# (tests/cleanup-test-data.mjs, chiamata Supabase con la service_role key) E
# la suite Playwright vera e propria contro produzione — ora NON parte più
# di default. Senza RUN_E2E=1, "bash deploy.sh" esegue solo il deploy vero e
# proprio (preflight branch/tree, push GitHub, vercel --prod, alias): zero
# traffico di test verso Supabase/produzione. RUN_E2E=1 riattiva l'intero
# ciclo [5/5] così com'era prima (stesso identico comportamento, stesso
# default TEST_SCOPE=critical, stessa gestione di TEST_SCOPE/
# ALLOW_TEST_FAILURES/INCLUDE_MOBILE — nessuna logica di test-deploy.sh
# toccata). SKIP_TESTS resta un override esplicito che forza lo skip anche
# con RUN_E2E=1 (nessun meccanismo duplicato: SKIP_TESTS continua a
# significare esattamente quello che significava prima, RUN_E2E aggiunge
# solo il nuovo default "spento").
#
# TRAMA ONE Build Sprint 0 — Pre-Migration Hardening (vedi
# docs/trama-one/analysis/SPRINT_0_TECH_NOTES.md per il dettaglio):
#  1. ONLY_SITEMAP intercettato QUI, prima di push/deploy/alias — non produce
#     più un deploy production solo per generare la sitemap, e usa
#     TEST_BASE_URL se valorizzato invece dell'URL di produzione hardcoded.
#  2. Preflight di sicurezza sul branch: blocca il deploy production se il
#     branch corrente non è "main", salvo override esplicito
#     ALLOW_PROD_FROM_NON_MAIN=1.
#  3. Preflight working tree: blocca il deploy production se il working tree
#     ha modifiche non committate, salvo override esplicito
#     ALLOW_DIRTY_PROD=1. Non si applica al ramo ONLY_SITEMAP (non deploya).
#  4. git push origin main è ora bloccante per default: se fallisce, lo
#     script si ferma PRIMA di vercel --prod, salvo override esplicito
#     ALLOW_PUSH_FAILURES=1.
#  5. TEST_SCOPE/ALLOW_TEST_FAILURES sono semplicemente inoltrati a
#     test-deploy.sh (che li gestisce, vedi quello script).

set -e

# ────────────────────────────────────────────────────────────────
# Carica ".env.deploy" (se presente), gitignored — stesso file/scopo di
# ".env.test" per test-deploy.sh, ma con precedenza esplicita in più: un
# valore passato inline sul comando (es. "DEPLOY_NOTIFY_SECRET=xyz bash
# deploy.sh") vince SEMPRE su quanto c'è in ".env.deploy" (un semplice
# "source", come fa test-deploy.sh con .env.test, sovrascriverebbe invece
# qualunque cosa passata inline, perché viene eseguito dopo — qui la
# precedenza viene ripristinata esplicitamente subito dopo il source).
# Risolve la richiesta di Fabrizio (02/09/2026: "non puoi impostarlo sempre
# nel comando di deploy?"): invece di scrivere DEPLOY_NOTIFY_SECRET=<secret>
# davanti a "bash deploy.sh" ogni volta, lo si mette UNA volta in
# ".env.deploy" (copia ".env.deploy.example") e da quel momento "bash
# deploy.sh" da solo lo trova. Il secret resta SOLO su questa macchina (mai
# in git, ".env*" è in .gitignore) e su Vercel (env var di produzione,
# impostata separatamente da Fabrizio) — non è mai stato e non deve mai
# essere scritto dentro deploy.sh stesso, che invece viene pubblicato su
# GitHub ad ogni deploy.
if [ -f .env.deploy ]; then
  _deploy_notify_secret_inline="${DEPLOY_NOTIFY_SECRET:-}"
  set -a
  source .env.deploy
  set +a
  [ -n "$_deploy_notify_secret_inline" ] && DEPLOY_NOTIFY_SECRET="$_deploy_notify_secret_inline"
  unset _deploy_notify_secret_inline
fi

# ────────────────────────────────────────────────────────────────
# Notifica di fine deploy (ok/ko) sul banner dell'app Admin (richiesta di
# Fabrizio, 02/09/2026). registrata con un `trap ... EXIT` così scatta SEMPRE
# — completamento normale, un blocco preflight (`exit 1` più sotto), o
# qualunque comando che fallisca sotto `set -e` (es. `vercel --prod`) —
# senza dover aggiungere una chiamata a mano ad ogni possibile punto di
# uscita dello script. Best-effort: se DEPLOY_NOTIFY_SECRET non è
# impostato (né inline né via .env.deploy sotto), o l'endpoint non risponde,
# la notifica viene semplicemente saltata — non fa MAI fallire né
# rallentare in modo bloccante il deploy stesso (--max-time 10, `|| true`).
#
# urlencode: nessuna dipendenza esterna (python3/jq potrebbero non esserci
# sulla macchina che lancia lo script) — snippet bash puro standard.
# ────────────────────────────────────────────────────────────────
urlencode() {
  local string="${1}" strlen pos c o encoded=""
  strlen=${#string}
  for (( pos=0; pos<strlen; pos++ )); do
    c=${string:$pos:1}
    case "$c" in
      [-_.~a-zA-Z0-9]) o="${c}" ;;
      *) printf -v o '%%%02X' "'${c}" ;;
    esac
    encoded+="${o}"
  done
  printf '%s' "${encoded}"
}

notify_deploy() {
  local exit_code="${1:-0}"
  local status="ok"
  [ "$exit_code" -ne 0 ] && status="ko"

  if [ -z "$DEPLOY_NOTIFY_SECRET" ]; then
    return 0
  fi

  local target="${TEST_BASE_URL:-https://buddykids-app.vercel.app}"
  local url="${target}/internal/deploy-notify"
  local qs="secret=$(urlencode "$DEPLOY_NOTIFY_SECRET")&status=${status}"
  [ -n "${CURRENT_BRANCH:-}" ] && qs="${qs}&branch=$(urlencode "$CURRENT_BRANCH")"
  [ -n "${CURRENT_COMMIT:-}" ] && qs="${qs}&commit=$(urlencode "$CURRENT_COMMIT")"
  [ -n "${TEST_SCOPE:-}" ] && qs="${qs}&testScope=$(urlencode "$TEST_SCOPE")"
  local test_result="${DEPLOY_TEST_RESULT_SUMMARY:-}"
  [ -n "$test_result" ] && qs="${qs}&testResult=$(urlencode "$test_result")"
  local msg=""
  [ "$status" = "ko" ] && [ -n "${LOG_FILE:-}" ] && msg="Log: ${LOG_FILE}"
  [ -n "$msg" ] && qs="${qs}&message=$(urlencode "$msg")"

  curl -fsS --max-time 10 "${url}?${qs}" >/dev/null 2>&1 \
    && echo "🔔 Notifica banner Admin inviata ($status)." \
    || echo "⚠️  Notifica banner Admin non riuscita (non blocca il deploy — verifica DEPLOY_NOTIFY_SECRET e che supabase/migration_33_deploy_events.sql sia stata applicata)."
}
trap 'notify_deploy $?' EXIT

# ────────────────────────────────────────────────────────────────
# Logging automatico su file: ogni esecuzione di questo script scrive il
# proprio output (stdout+stderr, identico a quanto visto a terminale) in
# logs/deploy-<timestamp>.log, così non serve più copiare a mano l'output dal
# terminale. `tee` mantiene comunque l'output a schermo in tempo reale.
# Override: NO_LOG_FILE=1 bash deploy.sh per disattivare (es. debug rapido).
# ────────────────────────────────────────────────────────────────
if [ -z "$NO_LOG_FILE" ]; then
  mkdir -p logs
  LOG_FILE="logs/deploy-$(date +%Y%m%d-%H%M%S).log"
  exec > >(tee "$LOG_FILE") 2>&1
  echo "📝 Log completo di questa esecuzione salvato in: $LOG_FILE"
  echo ""
fi

# ────────────────────────────────────────────────────────────────
# ONLY_SITEMAP: intercettato PRIMA di qualunque git push / vercel --prod /
# alias set / cleanup completo / suite Playwright ordinaria, e PRIMA dei
# preflight branch/working-tree sottostanti (non produce un deploy, quindi
# non ha bisogno di essere su main né di un working tree pulito). Delega
# interamente a test-deploy.sh (che già supporta ONLY_SITEMAP in modo
# deploy-free, non chiama mai vercel). Target: TEST_BASE_URL se valorizzato,
# altrimenti l'URL di produzione corrente — mai hardcoded incondizionatamente.
# ────────────────────────────────────────────────────────────────
if [ -n "$ONLY_SITEMAP" ]; then
  SITEMAP_TARGET="${TEST_BASE_URL:-https://buddykids-app.vercel.app}"
  echo "🗺️  ONLY_SITEMAP impostato: genero SOLO la sitemap contro $SITEMAP_TARGET, nessun deploy production."
  echo ""
  bash test-deploy.sh "$SITEMAP_TARGET"
  exit $?
fi

# ────────────────────────────────────────────────────────────────
# Preflight di sicurezza branch/commit/working-tree prima di push+deploy
# production. Vedi docs/trama-one/analysis/TRAMA_ONE_Impact_Assessment_v1.0.md
# per l'analisi del rischio: questo script esegue "git push origin main" (il
# ramo LOCALE letteralmente chiamato "main", non il branch corrente) e poi
# "vercel --prod" (che pubblica il WORKING TREE corrente, indipendentemente
# dal branch) — da un branch diverso da main, o con modifiche non
# committate, questi due passi possono pubblicare in produzione contenuto
# diverso da quanto risulta pushato su GitHub main, o contenuto mai
# committato da nessuna parte.
# ────────────────────────────────────────────────────────────────
CURRENT_BRANCH="$(git branch --show-current)"
CURRENT_COMMIT="$(git rev-parse --short HEAD)"
DIRTY_FILES="$(git status --porcelain)"
if [ -z "$DIRTY_FILES" ]; then
  TREE_STATUS="clean"
else
  TREE_STATUS="dirty"
fi

echo "[1/5] 🔎 Verifica di sicurezza — branch: $CURRENT_BRANCH · commit: $CURRENT_COMMIT · working tree: $TREE_STATUS"

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

if [ "$TREE_STATUS" = "dirty" ]; then
  if [ -n "$ALLOW_DIRTY_PROD" ]; then
    echo ""
    echo "⚠️  ATTENZIONE: working tree sporco (modifiche non committate)."
    echo "⚠️  Override ALLOW_DIRTY_PROD=1 utilizzato — procedo comunque."
    echo "⚠️  File modificati/non tracciati:"
    echo "$DIRTY_FILES" | sed 's/^/⚠️     /'
  else
    echo ""
    echo "🛑 Deploy production bloccato: working tree sporco (modifiche non committate)."
    echo "🛑 File modificati/non tracciati:"
    echo "$DIRTY_FILES" | sed 's/^/🛑    /'
    echo "🛑 Per procedere comunque (sconsigliato salvo motivo esplicito): ALLOW_DIRTY_PROD=1 bash deploy.sh"
    echo "🛑 Nessun push, nessun deploy, nessun alias eseguito."
    exit 1
  fi
fi

echo ""
echo "[2/5] 📤 Pubblico su GitHub (origin/main)..."
if git push origin main; then
  echo "✅ Push completato."
else
  PUSH_EXIT_CODE=$?
  if [ -n "$ALLOW_PUSH_FAILURES" ]; then
    echo ""
    echo "⚠️  Push fallito (exit code $PUSH_EXIT_CODE)."
    echo "⚠️  Override ALLOW_PUSH_FAILURES=1 utilizzato — procedo comunque col deploy."
    echo "⚠️  GitHub e produzione potrebbero risultare DISALLINEATI: il codice pubblicato da vercel --prod non sarà rintracciabile su origin/main."
  else
    echo ""
    echo "🛑 Push fallito (exit code $PUSH_EXIT_CODE) — deploy interrotto PRIMA di vercel --prod."
    echo "🛑 Nessun deploy è stato eseguito."
    echo "🛑 Per procedere comunque (sconsigliato: GitHub e produzione risulterebbero disallineati): ALLOW_PUSH_FAILURES=1 bash deploy.sh"
    exit $PUSH_EXIT_CODE
  fi
fi

echo "(deployment precedente, per rollback manuale: npx vercel ls buddykids-app --prod)"

echo ""
echo "[3/5] 🚀 Pubblico in produzione su Vercel..."
npx vercel --prod

echo ""
echo "[4/5] 🔗 Riallineo gli alias (partner/admin) all'ultimo deploy..."
ALIAS_PARTNER_OK=1
ALIAS_ADMIN_OK=1
npx vercel alias set buddykids-app.vercel.app buddykids-partner.vercel.app >/dev/null || ALIAS_PARTNER_OK=0
npx vercel alias set buddykids-app.vercel.app buddykids-admin.vercel.app >/dev/null || ALIAS_ADMIN_OK=0

if [ "$ALIAS_PARTNER_OK" = "1" ] && [ "$ALIAS_ADMIN_OK" = "1" ]; then
  echo "✅ Alias partner + admin: OK"
else
  [ "$ALIAS_PARTNER_OK" = "1" ] || echo "🛑 buddykids-partner.vercel.app: FALLITO — verificare manualmente, stato potenzialmente incoerente"
  [ "$ALIAS_ADMIN_OK" = "1" ] || echo "🛑 buddykids-admin.vercel.app: FALLITO — verificare manualmente, stato potenzialmente incoerente"
fi

echo ""
echo "✅ Deploy pubblicato: https://buddykids-app.vercel.app (+ alias partner/admin)"

if [ -n "$SKIP_TESTS" ]; then
  echo ""
  echo "⏭️  [5/5] Test saltati (SKIP_TESTS impostato)."
elif [ "$RUN_E2E" = "1" ]; then
  # Ottimizzazione tempo/costo (28/07): il default di questo passo era
  # sempre TEST_SCOPE=all (~880 test x 2 browser) DOPO OGNI SINGOLO DEPLOY —
  # troppo lento e pesante sull'Active CPU Vercel del piano gratuito.
  # Default ora "critical" (18 journey critiche, solo chromium — vedi
  # test-deploy.sh), pensato apposta per un controllo veloce post-deploy.
  # La suite intera resta un comando esplicito quando serve una copertura
  # completa (prima di un rilascio, o periodicamente): RUN_E2E=1
  # TEST_SCOPE=all bash deploy.sh. Se TEST_SCOPE è già valorizzato
  # (dall'utente) non viene toccato: questo default si applica solo quando
  # non specificato.
  TEST_SCOPE="${TEST_SCOPE:-critical}"
  echo ""
  echo "[5/5] 🧪 RUN_E2E=1: eseguo cleanup dati test + suite Playwright live contro produzione (TEST_SCOPE=$TEST_SCOPE — usa RUN_E2E=1 TEST_SCOPE=all bash deploy.sh per la suite intera)..."
  TEST_SCOPE="$TEST_SCOPE" bash test-deploy.sh https://buddykids-app.vercel.app
else
  # RUN_E2E opt-in (vedi commento in testa al file): default ora "spento" —
  # nessun cleanup/seed di dati di test, nessuna chiamata Supabase
  # preparatoria, nessuna suite Playwright contro produzione. Il deploy
  # vero e proprio (push/vercel/alias, sopra) è comunque già completo a
  # questo punto.
  echo ""
  echo "[5/5] ⏭️  E2E live saltati (default — nessun cleanup/seed fixture, nessuna chiamata Supabase di test, nessun Playwright contro produzione)."
  echo "      Per eseguirli:"
  echo "        RUN_E2E=1 bash deploy.sh"
  echo "      Suite completa:"
  echo "        RUN_E2E=1 TEST_SCOPE=all bash deploy.sh"
fi
