@echo off
setlocal
title Screensavers
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to start the collection.
  echo Install Node.js, then double-click Start.bat again.
  pause
  exit /b 1
)
node "%~dp0tools\serve.js" --open %*
if errorlevel 1 pause
