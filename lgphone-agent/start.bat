@echo off
chcp 65001 >nul
echo.
echo =============================================
echo   LGPhone Agent Tool - Cai dat tu dong
echo =============================================
echo.

REM Kiem tra Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [LOI] Node.js chua duoc cai dat!
    echo Tai Node.js tai: https://nodejs.org
    echo Chon ban LTS (18 hoac 20)
    echo Sau khi cai xong, dong cua so nay va chay lai start.bat
    pause
    exit /b 1
)

echo [OK] Node.js da duoc cai dat.
echo.

REM Kiem tra ADB
adb version >nul 2>&1
if errorlevel 1 (
    echo [CANH BAO] ADB chua co trong PATH
    echo.
    echo Cach cai ADB:
    echo   1. Tai Platform Tools tai:
    echo      https://developer.android.com/tools/releases/platform-tools
    echo   2. Giai nen file zip vao mot thu muc, vi du:
    echo      C:\platform-tools
    echo   3. Them vao PATH:
    echo      - Nhan Win + R, go: sysdm.cpl
    echo      - Tab Advanced -> Environment Variables
    echo      - Tim "Path" -> Edit -> New
    echo      - Dan: C:\platform-tools
    echo      - OK -> OK -> OK
    echo   4. Mo CMD moi va kiem tra: adb version
    echo.
    echo Hoac: Copy file adb.exe vao cung thu muc lgphone-agent
    echo.
    pause
    exit /b 1
)

echo [OK] ADB da san sang.
echo.

REM Cai npm packages neu chua co
if not exist "node_modules" (
    echo [INSTALL] Dang cai dat packages...
    npm install
    if errorlevel 1 (
        echo [LOI] npm install that bai
        pause
        exit /b 1
    )
    echo [OK] Cai dat thanh cong!
    echo.
)

REM Kiem tra .env
if not exist ".env" (
    echo [THONG BAO] Chua co file .env
    copy .env.example .env >nul
    echo Da tao file .env tu .env.example
)

REM Kiem tra xem .env co key that chua
findstr "PASTE_YOUR_SERVICE_ROLE_KEY_HERE" .env >nul
if not errorlevel 1 (
    echo.
    echo =================================================
    echo  QUAN TRONG: Can dien Service Role Key
    echo =================================================
    echo.
    echo  1. Mo file .env bang Notepad:
    echo     notepad .env
    echo.
    echo  2. Tim dong:
    echo     SUPABASE_SERVICE_ROLE_KEY=PASTE_YOUR_...
    echo.
    echo  3. Thay bang key that. Lay key tai:
    echo     https://supabase.com/dashboard/project/
    echo     nyuvpiztruwdmvogtwpz/settings/api
    echo     Muc "service_role" ^> Reveal ^> Copy
    echo.
    echo  4. Luu file (Ctrl+S) va dong Notepad
    echo.
    notepad .env
    echo.
    echo Sau khi dien xong, nhan phim bat ky de tiep tuc...
    pause >nul
)

REM Kiem tra ADB devices
echo [ADB] Kiem tra thiet bi ket noi...
adb devices 2>nul
echo.

REM Chay agent
echo [START] Khoi dong LGPhone Agent...
echo.
node src/index.js

pause
