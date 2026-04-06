#!/bin/bash
set -e

# Start postgres in background using the official entrypoint
/usr/local/bin/docker-entrypoint.sh postgres &

PG_PID=$!

# Wait for postgres to be ready via local socket (no password needed)
echo "[postgres-init] Waiting for PostgreSQL to start..."
until pg_isready --username=postgres --quiet 2>/dev/null; do
  if ! kill -0 $PG_PID 2>/dev/null; then
    echo "[postgres-init] PostgreSQL exited unexpectedly"
    exit 1
  fi
  sleep 0.5
done

echo "[postgres-init] PostgreSQL is ready. Ensuring md5 password..."

# Always reset password via local socket (trust auth — no password needed)
# Uses scram-sha-256 (postgres default) — consistent with default pg_hba.conf
psql --username=postgres --dbname=postgres \
  -c "ALTER USER postgres WITH PASSWORD 'postgres';" \
  && echo "[postgres-init] Password reset successfully" \
  || echo "[postgres-init] Warning: could not reset password"

# Forward signals to postgres for clean shutdown
trap "kill -TERM $PG_PID 2>/dev/null" SIGTERM SIGINT SIGQUIT

# Wait for postgres to exit
wait $PG_PID
exit $?
