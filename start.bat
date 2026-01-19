@echo off
echo ========================================
echo Starting My API Platform
echo ========================================
echo.

echo Checking Docker Desktop...
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [OK] Docker Desktop is running
echo.

echo Starting PostgreSQL...
docker-compose up -d postgres

echo Waiting for PostgreSQL to be ready...
timeout /t 10 /nobreak >nul

echo.
echo Starting all services...
docker-compose up -d

echo.
echo ========================================
echo Services Status:
echo ========================================
docker-compose ps

echo.
echo ========================================
echo Services are ready!
echo ========================================
echo.
echo Gateway:      http://localhost:8000/api/v1/health
echo Auth Service: http://localhost:4001/api/v1/health
echo Users Service: http://localhost:4002/api/v1/health
echo PgAdmin:      http://localhost:5050
echo.
echo Login credentials:
echo   Username: admin
echo   Password: password123
echo.
echo To view logs: docker-compose logs -f
echo To stop:      docker-compose down
echo.
pause
