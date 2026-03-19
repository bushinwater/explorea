@echo off
echo ===================================
echo       TodoApp - Pokretanje
echo ===================================
echo.

REM Proveri da li postoji .NET
where dotnet >nul 2>&1
if %errorlevel% neq 0 (
    echo [GRESKA] .NET SDK nije instaliran!
    echo Preuzmi sa: https://dotnet.microsoft.com/download
    pause
    exit /b 1
)

REM Proveri da li postoji Node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [GRESKA] Node.js nije instaliran!
    echo Preuzmi sa: https://nodejs.org
    pause
    exit /b 1
)

echo [1/3] Instalacija npm paketa za frontend...
cd frontend\todo-frontend
if not exist node_modules (
    call npm install
) else (
    echo      node_modules vec postoji, preskacemo...
)
cd ..\..

echo.
echo [2/3] Pokretanje backend-a (port 5000)...
start "TodoApp Backend" cmd /k "cd backend\TodoApp && dotnet run"

echo.
echo [3/3] Cekam 5 sekundi da se backend pokrene...
timeout /t 5 /nobreak >nul

echo.
echo [4/4] Pokretanje frontend-a (port 4200)...
start "TodoApp Frontend" cmd /k "cd frontend\todo-frontend && npm start"

echo.
echo ===================================
echo  Backend:  http://localhost:5000
echo  Frontend: http://localhost:4200
echo.
echo  Admin:    admin@todoapp.com
echo  Lozinka:  Admin123!
echo ===================================
echo.
pause
