@echo off
chcp 65001 > nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js is not installed.
  echo         Install the LTS version from https://nodejs.org/ko/download
  echo         then restart your computer and run this again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo [skipper-cuk cu12] First run - installing required files. This can take 5-10 minutes.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] Install failed. Check your internet connection and try again.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo [skipper-cuk cu12] Starting with auto login. A browser window will open shortly...
echo.
set LOGIN_FILE=login.txt
call npm run start:cu12

echo.
echo [skipper-cuk cu12] Finished. Press any key to close this window.
pause > nul
