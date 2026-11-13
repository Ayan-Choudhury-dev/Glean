#!/usr/bin/env bash
#
# Restore a dump made by scripts/backend-backup.sh.
#
#   scripts/backend-restore.sh backups/glean-20261113-101500.sql.gz
#
# Stops nothing, but it does overwrite the tables in the running database.
set -euo pipefail

DUMP="${1:-}"
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "usage: scripts/backend-restore.sh <dump.sql.gz>" >&2
  exit 1
fi

cd "$(dirname "${BASH_SOURCE[0]}")/../backend"

gunzip -c "$DUMP" | docker compose exec -T db psql -U glean -d glean -v ON_ERROR_STOP=1 > /dev/null
echo "restored: $DUMP"
