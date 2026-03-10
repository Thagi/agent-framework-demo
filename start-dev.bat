@echo off
chcp 65001 >nul
echo Starting Backend and Frontend (DEV: auto-reload)...
echo.

REM 現在のディレクトリを保存
set ROOT_DIR=%~dp0

REM Backend を起動（--reload でコード変更を自動反映）
start "Backend (DEV)" cmd /k "cd /d %ROOT_DIR%Backend && echo Starting Backend (reload) on http://localhost:8000 && set PYTHONUNBUFFERED=1 && python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload"

REM Frontend を起動（Flask debug + reloader でコード/テンプレ変更を自動反映）
start "Frontend (DEV)" cmd /k "cd /d %ROOT_DIR%Frontend && echo Starting Frontend (debug/reload) on http://localhost:5000 && set FLASK_DEBUG=1 && set PYTHONUNBUFFERED=1 && python app.py"

echo.
echo ================================
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5000
echo ================================
echo.
echo コード編集後は自動で再読み込みされます。
echo 停止するには各ウィンドウで Ctrl+C を押してください。
echo.
pause
