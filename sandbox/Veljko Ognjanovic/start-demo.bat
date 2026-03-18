@echo off
title Demo App - Backend + Frontend

echo Pokretanje backend-a...
echo ================================

cd backend
start cmd /k "dotnet run"
timeout /t 3 /nobreak >nul

echo Pokretanje frontend-a...
echo ================================

cd ..
cd frontend
start cmd /k "ng serve --port 4200"

echo Sve je pokrenuto!
echo Frontend: http://localhost:4200
echo Backend: http://localhost:5048
pause