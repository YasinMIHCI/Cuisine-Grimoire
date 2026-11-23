#!/usr/bin/env bash
# Teste les scripts de supabase/ sur un PostgreSQL local jetable (16 ou plus) :
# imitation de Supabase, scripts exécutés deux fois (ils doivent pouvoir être
# relancés), puis vérifications de sécurité.
#   bash supabase/tests/lancer.sh
set -euo pipefail
ici="$(cd "$(dirname "$0")" && pwd)"
scripts="$ici/.."
bin="$(dirname "$(command -v pg_ctl 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")"
dossier="$(mktemp -d)"
trap '"$bin/pg_ctl" -D "$dossier/donnees" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$dossier"' EXIT

utilisateur="$(id -un)"
if [ "$utilisateur" = root ]; then
  # PostgreSQL refuse de tourner en root : on passe par un compte ordinaire
  id postgres >/dev/null 2>&1 || useradd -m postgres
  chown -R postgres "$dossier"
  executer() { su postgres -s /bin/bash -c "$*"; }
else
  executer() { bash -c "$*"; }
fi

executer "'$bin/initdb' -D '$dossier/donnees' -U postgres -A trust >/dev/null"
executer "'$bin/pg_ctl' -D '$dossier/donnees' -o '-k $dossier -p 54329 -c listen_addresses=' -l '$dossier/journal' start >/dev/null"
psql_() { executer "psql -X -q -h '$dossier' -p 54329 -U postgres -d postgres -v ON_ERROR_STOP=1 $*"; }

psql_ "-f '$ici/imitation_supabase.sql'"
for tour in 1 2; do
  for f in "$scripts"/0*.sql; do
    psql_ "-f '$f'" >/dev/null 2>&1 || { echo "Échec de $(basename "$f") (passage $tour)"; psql_ "-f '$f'"; exit 1; }
  done
done
echo "Scripts exécutés deux fois sans erreur."
psql_ "-f '$ici/verifications.sql'" 2>&1 | sed -n 's/^.*NOTICE:  //p; /Toutes/p'
