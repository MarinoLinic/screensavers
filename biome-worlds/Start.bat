@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Biome Worlds needs Node.js. Install Node.js, then try again.
  pause
  exit /b 1
)
node tools/serve.js --open
if errorlevel 1 pause
