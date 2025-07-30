
@echo off
cd /d %~dp0
echo Iniciando servidor de WhatsApp...
call npm install
node index.js
pause
