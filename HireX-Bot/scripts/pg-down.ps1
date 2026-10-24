# Stops and removes the disposable PostgreSQL verification container.
$ErrorActionPreference = 'Stop'

& wsl -d Ubuntu -e pkill -fx 'sleep 2147482' *> $null
& cmd /c "wsl -d Ubuntu -e docker rm -f hirex-pg 2>nul" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host 'hirex-pg removed.'
}
else {
    Write-Host 'hirex-pg was not running.'
}
