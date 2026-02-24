#!/usr/bin/env bash
# Delete all tables except users and re-run 001_initial.sql.
# Uses DATABASE_URL from environment or server/.env. Requires psql.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"

# Load DATABASE_URL from server/.env if present
if [ -f "$SERVER_DIR/.env" ]; then
  set -a
  source "$SERVER_DIR/.env"
  set +a
fi

if [ -z "${DATABASE_URL}" ]; then
  echo "DATABASE_URL is not set. Set it in the environment or in server/.env"
  exit 1
fi

echo "Dropping tables (keeping users)..."

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- Drop tables that use enums (keep users)
DROP TABLE IF EXISTS recipient_audit_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS recipients CASCADE;
DROP TABLE IF EXISTS files CASCADE;

-- Drop enum types used by files so 001_initial.sql can recreate them (user_role stays for users table)
DROP TYPE IF EXISTS file_status CASCADE;
DROP TYPE IF EXISTS expiry_type_enum CASCADE;

-- So the migration runner will re-apply 001 on next run (optional; we run it below)
DELETE FROM schema_migrations WHERE name = '001_initial.sql';
SQL

echo "Re-running 001_initial.sql..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/001_initial.sql"

# Record that 001 was run (schema_migrations is created by runMigrations; ensure it exists)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO schema_migrations (name) VALUES ('001_initial.sql')
ON CONFLICT (name) DO NOTHING;
SQL

echo "Done. Users table unchanged; files, recipients, and audit tables recreated."
