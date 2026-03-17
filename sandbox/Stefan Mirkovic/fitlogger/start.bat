@echo off
echo Starting FitLogger...

start "FitLogger Backend" cmd /k "cd /d "%~dp0backend\FitLogger" && dotnet run"

timeout /t 3 /nobreak >nul

start "FitLogger Frontend" cmd /k "cd /d "%~dp0frontend" && ng serve"


echo.
echo Svi servisi pokrenuti!
echo Backend:    http://localhost:5000
echo Frontend:   http://localhost:4200
echo MCP Server: aktivan
echo.
pause
