@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

if "%~2"=="" (
  echo.
  echo  Uso: update-family-ref.bat NOME "percorso\foto.jpg"
  echo.
  echo  Esempio:
  echo    update-family-ref.bat marco "C:\Users\mvmc\Downloads\marco.jpg"
  echo.
  pause
  exit /b 1
)

set "NAME=%~1"
set "PHOTO=%~2"

if not exist "%PHOTO%" (
  echo [ERRORE] Foto non trovata: %PHOTO%
  pause
  exit /b 1
)

echo.
echo  Aggiornamento riferimento: %NAME%
echo  Da: %PHOTO%
echo.

call npm run family:setup -- %NAME% "%PHOTO%"
if errorlevel 1 goto :fine

echo.
echo  Rigenerazione descrittori per tutti i riferimenti...
call npm run family:refresh-sidecars
if errorlevel 1 goto :fine

echo.
echo  Reset indice (serve per rianalizzare con il nuovo volto)...
call npm run family:reset-index

echo.
echo  Test riconoscimento...
call npm run family:test
if errorlevel 1 (
  echo.
  echo  Test fallito — controlla reports\family-test-report.txt
  goto :fine
)

echo.
echo  ============================================
echo   Riferimento %NAME% aggiornato.
echo   Prossimo passo: import-auto.bat o npm run import:scan
echo  ============================================

:fine
echo.
pause
