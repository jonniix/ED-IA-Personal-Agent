@echo off
setlocal ENABLEDELAYEDEXPANSION

REM Avvio/Install/Build/Preview/Deploy helper per pv-event-toolkit
if not exist node_modules (
  echo [INFO] node_modules non trovata: eseguo npm install...
  npm install
  if errorlevel 1 (
    echo [ERRORE] npm install fallito.
    pause
    exit /b 1
  )
)

:menu
echo.
echo ===== PV EVENT TOOLKIT =====
echo 1) Dev (npm run dev)
echo 2) Build (npm run build)
echo 3) Preview (npm run preview)
echo 4) Deploy (gh-pages)
echo 5) Esci
set /p choice=Seleziona opzione: 

if "%choice%"=="1" (
  npm run dev
  goto menu
) else if "%choice%"=="2" (
  npm run build
  goto menu
) else if "%choice%"=="3" (
  npm run preview
  goto menu
) else if "%choice%"=="4" (
  npm run build
  npx gh-pages -d dist -t true
  goto menu
) else if "%choice%"=="5" (
  exit /b 0
) else (
  echo Opzione non valida.
  goto menu
)
