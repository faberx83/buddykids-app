#!/usr/bin/env bash
# TRAMA — Copia di sicurezza del database (Supabase), dal Mac di Fabrizio.
#
# Perché (26/10/2026, punto I6 del lancio beta): il piano gratuito di
# Supabase non dà copie scaricabili. Questo script ne fa una completa
# (struttura + dati) in ~/TRAMA_backup, con data e ora nel nome. Sola
# lettura: non cambia niente nel database.
#
# Una volta sola:
#   brew install libpq && brew link --force libpq     # pg_dump (versione 17 o più)
#   Supabase → progetto → Connect → "Session pooler" → copia la stringa
#   (postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-…pooler.supabase.com:5432/postgres)
#   e metti la password del database al posto di [YOUR-PASSWORD].
#
# Ogni volta (consigliato: prima del lancio e poi una volta a settimana):
#   bash scripts/backup-db.sh
# La stringa la incolli quando la chiede (non si vede e non viene salvata),
# oppure: SUPABASE_DB_URL='postgresql://…' bash scripts/backup-db.sh
#
# Ripristino (solo in emergenza, su un progetto Supabase NUOVO e vuoto):
#   pg_restore --no-owner --no-privileges -d '<stringa del progetto nuovo>' ~/TRAMA_backup/<file>.dump
#
# Non salva i file caricati (Storage: foto del Radar, loghi): sono a parte.

set -euo pipefail

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "❌ pg_dump non trovato. Installa con: brew install libpq && brew link --force libpq"
  exit 1
fi
MAJOR=$(pg_dump --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')
if [ "${MAJOR:-0}" -lt 17 ]; then
  echo "❌ pg_dump $MAJOR: serve la 17 o più (il database è Postgres 17). Aggiorna con: brew upgrade libpq"
  exit 1
fi

URL="${SUPABASE_DB_URL:-}"
if [ -z "$URL" ]; then
  printf "Incolla la stringa 'Session pooler' di Supabase (con la password): "
  read -rs URL
  echo ""
fi
case "$URL" in
  postgresql://*|postgres://*) ;;
  *) echo "❌ Non sembra una stringa di connessione (deve iniziare con postgresql://)"; exit 1 ;;
esac
if printf '%s' "$URL" | grep -q 'YOUR-PASSWORD'; then
  echo "❌ Nella stringa c'è ancora [YOUR-PASSWORD]: mettici la password del database."
  exit 1
fi

DIR="$HOME/TRAMA_backup"
mkdir -p "$DIR"
STAMP=$(date +%Y%m%d-%H%M)
DUMP="$DIR/trama-$STAMP.dump"
SCHEMA="$DIR/trama-$STAMP-struttura.sql"

echo "💾 Copia completa (struttura + dati) → $DUMP"
pg_dump "$URL" --format=custom --no-owner --no-privileges --schema=public --schema=auth --file="$DUMP"
echo "📐 Solo struttura, leggibile → $SCHEMA"
pg_dump "$URL" --schema-only --no-owner --no-privileges --schema=public --file="$SCHEMA"

SIZE=$(du -h "$DUMP" | cut -f1)
echo "✅ Fatto: $DUMP ($SIZE)"
echo "   Tienine una copia anche fuori dal Mac (es. Google Drive). Le copie più vecchie di 2 mesi si possono cancellare."
