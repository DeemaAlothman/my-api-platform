#!/bin/bash
echo "=== Checking Postgres ==="
docker compose -f docker-compose.prod.yml logs postgres --tail=20

echo -e "\n=== Checking Auth Service ==="
docker compose -f docker-compose.prod.yml logs auth --tail=30

echo -e "\n=== Checking Services Status ==="
docker compose -f docker-compose.prod.yml ps

echo -e "\n=== Checking .env file ==="
cat .env

echo -e "\n=== Testing Postgres Connection ==="
docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d platform -c "SELECT version();"
