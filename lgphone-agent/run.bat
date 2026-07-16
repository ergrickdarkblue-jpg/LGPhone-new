@echo off
chcp 65001 >nul
echo.
echo =============================================
echo   LGPhone Agent Tool - Chay nhanh
echo =============================================
echo.

REM Kiem tra Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [LOI] Node.js chua duoc cai dat!
    echo Tai Node.js tai: https://nodejs.org
    pause
    exit /b 1
)

REM Cai npm packages neu chua co
if not exist "node_modules" (
    echo [INSTALL] Dang cai dat packages...
    npm install
)

REM Chay agent
echo [START] Khoi dong LGPhone Agent...
echo.
node src/index.js

pause
