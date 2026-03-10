# Backend/Frontend 同時起動スクリプト
Write-Host "Starting Backend and Frontend..." -ForegroundColor Green

# 現在のディレクトリを保存
$rootDir = $PSScriptRoot
if (-not $rootDir) {
    $rootDir = Get-Location
}

# バックエンドとフロントエンドのジョブを開始
$backendJob = Start-Job -ScriptBlock {
    param($rootDir)
    Set-Location "$rootDir\Backend"
    Write-Host "Starting Backend on http://localhost:8000" -ForegroundColor Cyan
    python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
} -ArgumentList $rootDir

$frontendJob = Start-Job -ScriptBlock {
    param($rootDir)
    Set-Location "$rootDir\Frontend"
    Write-Host "Starting Frontend on http://localhost:5000" -ForegroundColor Cyan
    python app.py
} -ArgumentList $rootDir

Write-Host ""
Write-Host "================================" -ForegroundColor Yellow
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5000" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers..." -ForegroundColor Yellow
Write-Host ""

# ジョブの出力を表示
try {
    while ($true) {
        # バックエンドの出力
        $backendOutput = Receive-Job -Job $backendJob -ErrorAction SilentlyContinue
        if ($backendOutput) {
            $backendOutput | ForEach-Object {
                Write-Host "[Backend] $_" -ForegroundColor Blue
            }
        }

        # フロントエンドの出力
        $frontendOutput = Receive-Job -Job $frontendJob -ErrorAction SilentlyContinue
        if ($frontendOutput) {
            $frontendOutput | ForEach-Object {
                Write-Host "[Frontend] $_" -ForegroundColor Green
            }
        }

        # ジョブが終了しているかチェック
        if ($backendJob.State -ne 'Running' -and $frontendJob.State -ne 'Running') {
            break
        }

        Start-Sleep -Milliseconds 100
    }
}
finally {
    # クリーンアップ
    Write-Host "`nStopping servers..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Write-Host "All servers stopped." -ForegroundColor Green
}
