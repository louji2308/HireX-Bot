<#
    Brings the self-hosted Piston code-execution sandbox up and verifies that it
    is reachable *from Windows*, which is where the Next.js server runs.

    Why this exists: the sandbox lives in WSL2 and Docker publishes its port
    inside the WSL network namespace. Windows can reach it only while the WSL
    VM is alive, and the VM shuts itself down after a short idle period. Without
    this script the first request from the app fails until someone happens to
    open a WSL shell, which looks like "the sandbox is broken".

    Usage:
      powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sandbox-up.ps1
      ... -KeepAlive     keep the WSL VM awake (needed for a live demo)
      ... -Down          stop the container and the keep-alive process
      ... -RunTests      run the opt-in live integration tests after the check
#>
param(
    [switch]$KeepAlive,
    [switch]$Down,
    [switch]$RunTests
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$BaseUrl = if ($env:PISTON_BASE_URL) { $env:PISTON_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:2000/api/v2' }
$Distro = 'Ubuntu'
$Container = 'piston'
$Image = 'ghcr.io/engineer-man/piston'
$KeepAliveMarker = 'sleep 2147483'

function Invoke-Wsl {
    param([string]$Command)
    $output = & wsl -d $Distro -u root -- bash -lc $Command 2>&1
    return ($output | Out-String).Trim()
}

function Test-Sandbox {
    for ($attempt = 1; $attempt -le 60; $attempt++) {
        try {
            $runtimes = Invoke-RestMethod -Uri "$BaseUrl/runtimes" -TimeoutSec 5
            if ($null -ne $runtimes) { return $runtimes }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    return $null
}

function Stop-KeepAlive {
    Invoke-Wsl "pkill -fx '$KeepAliveMarker'" | Out-Null
}

if ($Down) {
    Stop-KeepAlive
    Invoke-Wsl "docker stop $Container" | Out-Null
    Write-Output 'Sandbox stopped: keep-alive process and container are down.'
    exit 0
}

# 1. Wake the WSL VM (a Windows-side HTTP request cannot do this by itself).
Invoke-Wsl 'echo awake' | Out-Null

# 2. Make sure the Docker daemon is running inside the distro.
$dockerState = Invoke-Wsl 'systemctl is-active docker'
if ($dockerState -ne 'active') {
    $dockerState = Invoke-Wsl 'systemctl start docker; systemctl is-active docker'
}
if ($dockerState -ne 'active') {
    throw "Docker is not active inside WSL ($Distro): $dockerState"
}

# 3. The Piston entrypoint creates /sys/fs/cgroup/isolate without -p, so a stale
#    directory from a previous run makes the container restart-loop.
Invoke-Wsl 'rm -rf /sys/fs/cgroup/isolate' | Out-Null

$exists = Invoke-Wsl "docker inspect -f '{{.State.Running}}' $Container 2>/dev/null"
if ($exists -eq 'true') {
    Write-Output 'Container already running.'
} elseif ($exists -eq 'false') {
    Invoke-Wsl "docker start $Container" | Out-Null
} else {
    $run = "docker run -d --privileged --name $Container --restart unless-stopped -p 2000:2000 -v piston_data:/piston $Image"
    Invoke-Wsl $run | Out-Null
}

# 4. Verify from Windows, not from inside WSL: that is the path the app uses.
$runtimes = Test-Sandbox
if ($null -eq $runtimes) {
    throw "Piston never became reachable at $BaseUrl. Run 'wsl -d $Distro -u root -- docker logs $Container' for details."
}

$languages = @($runtimes | ForEach-Object { "$($_.language) $($_.version)" })
if ($languages.Count -eq 0) {
    throw "Piston is reachable at $BaseUrl but no language runtime is installed, so nothing can execute."
}

if ($KeepAlive) {
    $alive = (Invoke-Wsl "pgrep -fx '$KeepAliveMarker' | wc -l")
    if ($alive -eq '0') {
        Start-Process -FilePath 'wsl' -ArgumentList '-d', $Distro, '--', 'sleep', '2147483' -WindowStyle Hidden
        Write-Output 'Keep-alive started: the WSL VM will stay up until you run this script with -Down.'
    } else {
        Write-Output 'Keep-alive already running.'
    }
}

Write-Output "Sandbox ready at $BaseUrl"
Write-Output ("Runtimes: " + ($languages -join ', '))

if ($RunTests) {
    $env:PISTON_LIVE = '1'
    Push-Location $RepoRoot
    try {
        & npx vitest run tests/integration/piston-live.test.ts
        exit $LASTEXITCODE
    } finally {
        Pop-Location
    }
}
