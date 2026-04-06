#!/bin/bash
set -e

# Start postgres in background using the official entrypoint
/usr/local/bin/docker-entrypoint.sh postgres \
  -c password_encryption=md5 \
  -c hba_file=/etc/postgresql/pg_hba.conf &

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

# Always set password as md5 — local socket uses trust (no password needed)
psql --username=postgres --dbname=postgres \
  -c "SET password_encryption='md5'; ALTER USER postgres WITH PASSWORD 'postgres';" \
  && echo "[postgres-init] Password set to md5 successfully" \
  || echo "[postgres-init] Warning: could not set password"

# Forward signals to postgres for clean shutdown
trap "kill -TERM $PG_PID 2>/dev/null" SIGTERM SIGINT SIGQUIT

# Wait for postgres to exit
wait $PG_PID
exit $?
