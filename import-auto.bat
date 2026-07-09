@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ============================================
echo   Vetrina Foto - Import automatico
echo  ============================================
echo   Cartella progetto: %CD%
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERRORE] Git non trovato. Installalo da https://git-scm.com
  goto :fine
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRORE] Node.js non trovato. Installa la versione LTS da https://nodejs.org
  goto :fine
)

echo [1/5] Aggiornamento codice da GitHub...
git pull
if errorlevel 1 (
  echo [ERRORE] git pull fallito.
  goto :fine
)

echo.
echo [2/5] Installazione dipendenze...
call npm install
if errorlevel 1 (
  echo [ERRORE] npm install fallito.
  goto :fine
)

echo.
echo [3/5] Verifica filtro famiglia...
call npm run family:verify
if errorlevel 1 (
  echo [ERRORE] Filtro famiglia non pronto.
  goto :fine
)

echo.
echo [4/5] Test riconoscimento su campione foto...
call npm run family:test
if errorlevel 1 (
  echo.
  echo ============================================
  echo  TEST FALLITO - NON avviare l'import.
  echo  Controlla reports\family-test-report.txt
  echo  e rigenera config\family\ se necessario.
  echo ============================================
  goto :fine
)

echo.
echo [5/5] Import completo gallery...
for /f "delims=" %%F in ('node -e "console.log(JSON.parse(require('fs').readFileSync('config.json','utf8')).sourceFolder)"') do set "SOURCE=%%F"

if not exist "%SOURCE%" (
  echo [ERRORE] Cartella foto non trovata: %SOURCE%
  echo Modifica sourceFolder in config.json e rilancia.
  goto :fine
)

echo Cartella sorgente: %SOURCE%
echo ATTENZIONE: l'import puo' richiedere 15-40 minuti.
echo.
set /p CONFERMA=Avviare import completo? [S/N]: 
if /i not "%CONFERMA%"=="S" (
  echo Import annullato. Rilancia import-auto.bat quando vuoi.
  goto :fine
)

call npm run import -- "%SOURCE%"
if errorlevel 1 (
  echo [ERRORE] Import fallito. Controlla il messaggio sopra.
  goto :fine
)

echo.
echo ============================================
echo  IMPORT COMPLETATO
echo  Gallery in public\ — anteprima: npm run serve
echo.
echo  Per pubblicare su GitHub:
echo    git add public\
echo    git commit -m "Gallery famiglia aggiornata"
echo    git push
echo ============================================

:fine
echo.
pause
