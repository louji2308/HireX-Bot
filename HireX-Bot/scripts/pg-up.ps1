# Starts the disposable PostgreSQL 16 verification container used by tests/phase2.
# Docker is only reachable through the Ubuntu WSL distribution on this host.
$ErrorActionPreference = 'Stop'

$container = 'hirex-pg'
$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Docker {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$DockerArgs)
    & wsl -d Ubuntu -e docker @DockerArgs
    if ($LASTEXITCODE -ne 0) {
        throw "docker $($DockerArgs -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Send-SqlFile {
    param([string]$RelativePath)
    $path = Join-Path $repoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path)) {
        throw "SQL file not found: $path"
    }
    $previousEncoding = $OutputEncoding
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    try {
        Get-Content -LiteralPath $path -Raw | & wsl -d Ubuntu -e docker exec -i $container psql `
            -U postgres -d hirex_test -v ON_ERROR_STOP=1 --single-transaction -f -
        if ($LASTEXITCODE -ne 0) {
            throw "psql failed while applying $RelativePath"
        }
    }
    finally {
        $OutputEncoding = $previousEncoding
    }
}

Write-Host 'Recreating hirex-pg (PostgreSQL 16, tmpfs data directory)...'
& cmd /c "wsl -d Ubuntu -e docker rm -f $container 2>nul" | Out-Null
Invoke-Docker -DockerArgs @('run', '-d', '--name', $container,
    '-e', 'POSTGRES_PASSWORD=hirex',
    '-e', 'POSTGRES_DB=hirex_test',
    '-e', 'TZ=UTC',
    '-p', '127.0.0.1:55432:5432',
    '--tmpfs', '/var/lib/postgresql/data',
    'postgres:16-alpine', 'postgres', '-c', 'timezone=UTC', '-c', 'log_timezone=UTC') | Out-Null

$ready = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    & wsl -d Ubuntu -e docker exec $container pg_isready -U postgres -d hirex_test *> $null
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
    }
    Start-Sleep -Milliseconds 500
}

if (-not $ready) {
    throw 'hirex-pg did not become ready within 15 seconds'
}

Write-Host 'Applying local auth shim, schema and RLS...'
Send-SqlFile 'supabase/local/0000_auth_shim.sql'
Send-SqlFile 'supabase/migrations/0001_hirex_bot_schema.sql'
Send-SqlFile 'supabase/migrations/0002_triggers_and_rls.sql'
Send-SqlFile 'supabase/migrations/0003_function_privilege_hardening.sql'
Send-SqlFile 'supabase/migrations/0004_phase2_contract_refinements.sql'

Write-Host 'hirex-pg ready at postgres://postgres:hirex@127.0.0.1:55432/hirex_test (database is empty; tests seed it).'
