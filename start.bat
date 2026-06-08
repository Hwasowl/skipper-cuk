@echo off
chcp 65001 > nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [오류] Node.js가 설치되어 있지 않습니다.
  echo        https://nodejs.org/ko/download 에서 LTS 버전을 설치한 뒤,
  echo        설치가 끝나면 컴퓨터를 한 번 재시작하고 다시 실행하세요.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo [skipper-cuk] 첫 실행 — 필요한 파일을 설치합니다.
  echo            ^(npm install + Chromium 다운로드, 5~10분 걸릴 수 있습니다. 인터넷 연결 필요^)
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [오류] 설치에 실패했습니다. 인터넷 연결을 확인하고 다시 실행하세요.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo [skipper-cuk] 매크로를 시작합니다. 브라우저 창이 곧 열립니다...
echo.
call npm start

echo.
echo [skipper-cuk] 종료되었습니다. 이 창을 닫으려면 아무 키나 누르세요.
pause > nul
