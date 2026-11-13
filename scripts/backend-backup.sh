#!/usr/bin/env bash
#
# Back up the self-hosted pantry.
#
#   scripts/backend-backup.sh            # writes ./backups/glean-<date>.sql.gz
#   scripts/backend-backup.sh /mnt/nas   # writes into another directory
#
# Plain SQL dump, restorable with scripts/backend-restore.sh. The database is a
# few hundred rows, so the dump is small and can be kept forever.
set -euo pipefail

DEST="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups}"
mkdir -p "$DEST"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DEST/glean-$STAMP.sql.gz"

# Compose project lives in backend/; --env-file keeps it independent of cwd.
cd "$(dirname "${BASH_SOURCE[0]}")/../backend"

docker compose exec -T db pg_dump -U glean -d glean --clean --if-exists \
  | gzip > "$OUT"

echo "backup: $OUT ($(du -h "$OUT" | cut -f1))"
