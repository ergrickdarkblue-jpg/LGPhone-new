@echo off
echo Installing dependencies...
call npm install
echo.
echo Starting LGPhone Agent...
node src/index.js
pause
