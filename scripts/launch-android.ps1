$ErrorActionPreference = "Stop"

. "$PSScriptRoot\common.ps1"

Initialize-AndroidEnvironment

$adbPath = Get-AdbPath
if (-not $adbPath) {
  throw "adb was not found. Install Android SDK Platform Tools first."
}

$authorizedDevices = @(Get-AuthorizedAdbDevices)
if ($authorizedDevices.Count -eq 0) {
  throw "No authorized Android device found. Connect your phone, accept the RSA prompt, and rerun this command."
}

$hostInfo = Get-PreferredDevHost
if (-not $hostInfo.Host) {
  throw "Could not determine a usable LAN IPv4 address. Set EXPO_DEV_SERVER_HOST and rerun the command."
}

$metroStatus = Test-MetroOnPort
if (-not $metroStatus.IsMetro) {
  if ($metroStatus.IsRunning) {
    throw "Port 8081 is occupied by PID $($metroStatus.Listener.Pid) ($($metroStatus.Listener.ProcessName)), but it does not look like Metro."
  }

  throw "Metro is not running on port 8081. Start it with npm run dev first."
}

$devServerUrl = "http://$($hostInfo.Host):$($script:MetroPort)"
$encodedDevServerUrl = [System.Uri]::EscapeDataString($devServerUrl)
$deepLink = "$($script:AppScheme)://expo-development-client/?url=$encodedDevServerUrl"

Write-Host "Launching Tiny Chapters on $($authorizedDevices[0].Id)"
Write-Host "Using dev server host $($hostInfo.Host) ($($hostInfo.Source))"
if ($hostInfo.Candidates.Count -gt 1) {
  Write-Host "Detected IPv4 candidates: $($hostInfo.Candidates -join ', ')"
}
Write-Host "Opening $devServerUrl"

& $adbPath shell am start -a android.intent.action.VIEW -d $deepLink $script:AndroidPackage | Out-Null
exit $LASTEXITCODE
