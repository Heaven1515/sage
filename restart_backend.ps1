Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object {
    $procId = $_.OwningProcess
    Write-Host "Matando PID $procId en puerto 8000"
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2
Set-Location "C:\Users\javie\OneDrive\Desktop\SAGE\backend"
Start-Process -FilePath "python" -ArgumentList "-m uvicorn main:app --host 0.0.0.0 --port 8000" -WindowStyle Normal
Write-Host "Backend iniciado"
