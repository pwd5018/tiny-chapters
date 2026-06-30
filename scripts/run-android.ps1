param(
  [switch]$Device
)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot\common.ps1"

$workspaceRoot = Get-WorkspaceRoot
Initialize-AndroidEnvironment

if (-not $env:JAVA_HOME) {
  throw "JAVA_HOME is not set and no bundled JDK was found. Install Android Studio or set JAVA_HOME manually."
}

$expoCli = Get-ExpoCliPath
if (-not $expoCli) {
  throw "Expo CLI was not found at $(Join-Path $workspaceRoot 'node_modules\.bin\expo.cmd'). Run npm install first."
}

$expoArgs = @("run:android")
if ($Device) {
  $expoArgs += "--device"
}

Write-Host "Using JAVA_HOME=$env:JAVA_HOME"
if ($env:ANDROID_HOME) {
  Write-Host "Using ANDROID_HOME=$env:ANDROID_HOME"
}
Write-Host "Using GRADLE_USER_HOME=$env:GRADLE_USER_HOME"
Write-Host "Using GRADLE_OPTS=$env:GRADLE_OPTS"
Write-Host "Running expo $($expoArgs -join ' ')"

& $expoCli @expoArgs
exit $LASTEXITCODE
