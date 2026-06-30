param(
  [switch]$ForcePortKill
)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot\common.ps1"

$workspaceRoot = Get-WorkspaceRoot
Initialize-AndroidEnvironment

$javaPath = Get-JavaPath
if (-not $javaPath) {
  throw "Java is not available. Install Android Studio or set JAVA_HOME first."
}

$adbPath = Get-AdbPath
if (-not $adbPath) {
  throw "adb was not found. Install Android SDK Platform Tools first."
}

$authorizedDevices = @(Get-AuthorizedAdbDevices)
if ($authorizedDevices.Count -eq 0) {
  throw "No authorized Android device found. Connect your phone, accept the RSA prompt, and rerun the command."
}

$metroOutcome = Ensure-MetroRunning -ForcePortKill:$ForcePortKill
if ($metroOutcome.StartedMetro) {
  Write-Host "Started Metro in a new PowerShell window on port 8081."
} else {
  Write-Host "Reusing existing Metro on port 8081."
}

$expoCli = Get-ExpoCliPath
if (-not $expoCli) {
  throw "Expo CLI was not found at $(Join-Path $workspaceRoot 'node_modules\.bin\expo.cmd'). Run npm install first."
}

$expoArgs = @("run:android", "--device")

Write-Host "Using JAVA_HOME=$env:JAVA_HOME"
if ($env:ANDROID_HOME) {
  Write-Host "Using ANDROID_HOME=$env:ANDROID_HOME"
}
Write-Host "Running expo $($expoArgs -join ' ')"

& $expoCli @expoArgs
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& (Join-Path $PSScriptRoot "launch-android.ps1")
exit $LASTEXITCODE
