@echo off
chcp 65001 > nul
cd /d "%~dp0"

if not exist node_modules (
  echo.
  echo [skipper-cuk] 첫 실행 — 의존성 설치 중...
  echo (npm install + Chromium 다운로드, 5~10분 정도 걸릴 수 있습니다)
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [오류] 설치 실패. Node.js 가 설치되어 있는지 확인하세요.
    echo        https://nodejs.org/ 에서 LTS 버전 다운로드.
    pause
    exit /b 1
  )
)

echo.
echo [skipper-cuk] 매크로 시작합니다...
echo.
call npm start

echo.
echo [skipper-cuk] 종료되었습니다. 창을 닫으려면 아무 키나 누르세요.
pause > nul
