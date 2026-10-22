# Full Phase 2 database gate: fresh PG16 container, migrations, then all tests/phase2 suites.
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot

& (Join-Path $PSScriptRoot 'pg-up.ps1')
if ($LASTEXITCODE -ne 0) {
    throw 'pg-up.ps1 failed'
}

$env:HIREX_DB_REQUIRED = '1'
$env:HIREX_DB_URL = 'postgres://hirex_app:hirex@127.0.0.1:55432/hirex_test'
$env:HIREX_DB_ADMIN_URL = 'postgres://postgres:hirex@127.0.0.1:55432/hirex_test'

Push-Location $repoRoot
try {
    & npx vitest run tests/phase2 --reporter=verbose
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

if ($exitCode -ne 0) {
    throw "tests/phase2 failed with exit code $exitCode"
}

Write-Host 'Phase 2 database gate passed.'
