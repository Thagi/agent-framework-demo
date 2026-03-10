@echo off
chcp 65001 >nul
echo Starting Backend and Frontend...
echo.

REM 現在のディレクトリを保存
set ROOT_DIR=%~dp0

REM Backend を起動（バックグラウンド）
start "Backend" cmd /k "cd /d %ROOT_DIR%Backend && echo Starting Backend on http://localhost:8000 && python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload"

REM Frontend を起動（バックグラウンド）
start "Frontend" cmd /k "cd /d %ROOT_DIR%Frontend && echo Starting Frontend on http://localhost:5000 && python app.py"

echo.
echo ================================
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5000
echo ================================
echo.
echo 2つの新しいウィンドウが開きました。
echo 停止するには各ウィンドウで Ctrl+C を押してください。
echo.
pause
