@echo off
title ViralFlows Launcher

echo ========================================
echo        ViralFlows - Starting...
echo ========================================
echo.

echo [1/2] Starting Backend (port 5000)...
start "ViralFlows API" cmd /k "title ViralFlows API && cd /d artifacts\api-server && echo [API] Starting on http://localhost:5000 && npx tsx src/index.ts"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend (port 5173)...
start "ViralFlows Web" cmd /k "title ViralFlows Web && cd /d artifacts\web && echo [WEB] Starting on http://localhost:5173 && npm run dev"

echo.
echo ========================================
echo  Both servers are starting up!
echo  Backend:  http://localhost:5000
echo  Frontend: http://localhost:5173
echo  Close the windows to stop.
echo ========================================
echo.
echo  NOTE: OAuth callback needs to be registered in GCP:
echo  http://localhost:5000/api/workspaces/oauth/callback
echo.
pause
