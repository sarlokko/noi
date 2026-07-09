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
  echo ============================================
  goto :fine
)

for /f "delims=" %%F in ('node -e "console.log(JSON.parse(require('fs').readFileSync('config.json','utf8')).sourceFolder)"') do set "SOURCE=%%F"

if not exist "%SOURCE%" (
  echo [ERRORE] Cartella foto non trovata: %SOURCE%
  goto :fine
)

echo.
echo [5/5] Import / aggiornamento gallery...
echo Cartella sorgente: %SOURCE%
echo.

if exist ".cache\photo-index.json" (
  echo Indice trovato — modalita' INCREMENTALE ^(solo foto nuove^).
  echo Tempo atteso: pochi minuti se hai aggiunto poche foto.
  echo.
  set /p CONFERMA=Avviare aggiornamento? [S/N]: 
  if /i not "%CONFERMA%"=="S" goto :fine
  call npm run import:update -- "%SOURCE%"
) else (
  echo PRIMA VOLTA — serve indicizzare tutte le foto ^(1-2 ore^).
  echo Puoi interrompere con Ctrl+C: l'indice salva i progressi ogni 50 foto.
  echo Al termine rilancia il bat per aggiornare la gallery.
  echo.
  set /p CONFERMA=Avviare indicizzazione? [S/N]: 
  if /i not "%CONFERMA%"=="S" goto :fine
  call npm run import:scan -- "%SOURCE%"
  echo.
  set /p CONFERMA2=Indicizzazione finita. Creare gallery adesso? [S/N]: 
  if /i not "%CONFERMA2%"=="S" goto :fine
  call npm run import:update -- "%SOURCE%"
)

if errorlevel 1 (
  echo [ERRORE] Operazione fallita.
  goto :fine
)

echo.
echo ============================================
echo  COMPLETATO
echo  Gallery in public\ — anteprima: npm run serve
echo.
echo  Prossime volte: doppio click su import-auto.bat
echo  analizza SOLO le foto nuove ^(minuti, non ore^).
echo ============================================

:fine
echo.
pause
