@echo off
cd /d "%~dp0"
set PORT=3456
echo Painel Macumba ^& Recreio em http://127.0.0.1:%PORT%
echo 14 cameras ao vivo + 5 snapshots (10s refresh)
start "" http://127.0.0.1:%PORT%
node src\server.mjs
pause
