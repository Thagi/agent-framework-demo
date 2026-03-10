# Backend/Frontend 同時起動スクリプト (DEV: auto-reload)
Write-Host "Starting Backend and Frontend (DEV: auto-reload)..." -ForegroundColor Green

$rootDir = $PSScriptRoot
if (-not $rootDir) {
    $rootDir = Get-Location
}

$backendCmd = "cd /d `"$rootDir\Backend`" & set PYTHONUNBUFFERED=1 & python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload"
$frontendCmd = "cd /d `"$rootDir\Frontend`" & set FLASK_DEBUG=1 & set PYTHONUNBUFFERED=1 & python app.py"

$backendJob = Start-Job -ScriptBlock {
    param($cmd)
    cmd.exe /c $cmd
} -ArgumentList $backendCmd

$frontendJob = Start-Job -ScriptBlock {
    param($cmd)
    cmd.exe /c $cmd
} -ArgumentList $frontendCmd

Write-Host "" 
Write-Host "================================" -ForegroundColor Yellow
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5000" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Yellow
Write-Host "" 
Write-Host "DEVモード: コード編集後は自動で再読み込みされます。" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop both servers..." -ForegroundColor Yellow
Write-Host ""

try {
    while ($true) {
        $backendOutput = Receive-Job -Job $backendJob -ErrorAction SilentlyContinue
        if ($backendOutput) {
            $backendOutput | ForEach-Object { Write-Host "[Backend] $_" -ForegroundColor Blue }
        }

        $frontendOutput = Receive-Job -Job $frontendJob -ErrorAction SilentlyContinue
        if ($frontendOutput) {
            $frontendOutput | ForEach-Object { Write-Host "[Frontend] $_" -ForegroundColor Green }
        }

        if ($backendJob.State -ne 'Running' -and $frontendJob.State -ne 'Running') { break }
        Start-Sleep -Milliseconds 100
    }
}
finally {
    Write-Host "`nStopping servers..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Write-Host "All servers stopped." -ForegroundColor Green
}
