# Runs the Phase 1 gate (tsc + vitest) inside a Linux container.
#
# Why: the developer machine is Windows with Node 24, while the deployed runtime
# is Linux. A local green run does not prove the gate passes on the target OS.
# This script mounts the repository into node:20-bookworm-slim, installs the
# locked dependency tree into a named volume, and runs the same commands CI will.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/verify-container.ps1
# Requires: WSL2 with Docker reachable from the default distribution.

$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script = @'
set -e
cd "$1"
docker volume create first-mile-node-modules >/dev/null
docker run --rm \
  -v "$1":/app \
  -v first-mile-node-modules:/app/node_modules \
  -w /app \
  node:20-bookworm-slim \
  sh -lc 'npm ci --no-audit --no-fund && npx tsc --noEmit && npx vitest run'
'@

$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($script -replace "`r`n", "`n")))
$wslPath = '/mnt/' + $repo.Substring(0, 1).ToLower() + $repo.Substring(2).Replace('\', '/')

wsl -d Ubuntu -- bash -c "echo $b64 | base64 -d | bash -s -- '$wslPath'"
exit $LASTEXITCODE
