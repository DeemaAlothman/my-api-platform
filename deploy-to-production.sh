#!/bin/bash

# Deployment Script for Evaluation Service Updates
# Run this script on the production server (217.76.53.136)

set -e  # Exit on any error

SERVER_USER="root"
SERVER_IP="217.76.53.136"
PROJECT_DIR="/root/my-api-platform"

echo "🚀 Starting deployment to production server..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Pull latest code from repository${NC}"
cd $PROJECT_DIR
git pull origin main

echo -e "${YELLOW}Step 2: Stop evaluation service${NC}"
docker-compose stop evaluation

echo -e "${YELLOW}Step 3: Rebuild evaluation service${NC}"
docker-compose build evaluation

echo -e "${YELLOW}Step 4: Start evaluation service${NC}"
docker-compose up -d evaluation

echo -e "${YELLOW}Step 5: Wait for service to be healthy${NC}"
sleep 10

echo -e "${YELLOW}Step 6: Check evaluation service status${NC}"
docker logs myapiplatform-evaluation --tail 20

echo -e "${GREEN}✅ Evaluation service deployed successfully!${NC}"

echo -e "${YELLOW}Step 7: Check if gateway needs restart${NC}"
docker-compose restart gateway

echo -e "${YELLOW}Step 8: Wait for gateway to be ready${NC}"
sleep 5

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Run the SQL script to add evaluation permissions"
echo "2. Test the new endpoints using Postman"
