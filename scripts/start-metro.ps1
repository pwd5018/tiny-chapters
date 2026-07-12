param(
  [switch]$Clear
)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot\common.ps1"

$workspaceRoot = Get-WorkspaceRoot
Initialize-AndroidEnvironment

$expoCli = Get-ExpoCliPath
if (-not $expoCli) {
  throw "Expo CLI was not found at $(Join-Path $workspaceRoot 'node_modules\.bin\expo.cmd'). Run npm install first."
}

$hostInfo = Get-PreferredDevHost
if (-not $hostInfo.Host) {
  throw "Could not determine a usable dev-server host. Check EXPO_DEV_SERVER_MODE / EXPO_DEV_SERVER_HOST in .env and rerun."
}

$env:REACT_NATIVE_PACKAGER_HOSTNAME = $hostInfo.Host

$expoArgs = @("start", "--dev-client", "--port", "$($script:MetroPort)")
if ($Clear) {
  $expoArgs += "-c"
}

Write-Host "Starting Metro on port $($script:MetroPort)"
Write-Host "Using dev server host $($hostInfo.Host) ($($hostInfo.Source); mode=$($hostInfo.Mode))"

& $expoCli @expoArgs
exit $LASTEXITCODE
