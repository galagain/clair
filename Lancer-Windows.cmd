@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Installez Node.js 22 ou ulterieur depuis nodejs.org, puis relancez ce fichier.
 pause
 exit /b 1
)
if not exist node_modules\electron\dist\electron.exe (
 call npm ci
 if errorlevel 1 (
  echo Installation impossible. Verifiez la connexion Internet.
  pause
  exit /b 1
 )
)
call npm start
if errorlevel 1 pause
