$ErrorActionPreference = "Stop"

. "$PSScriptRoot\common.ps1"

$workspaceRoot = Get-WorkspaceRoot
Initialize-AndroidEnvironment

$criticalFailures = 0
$warnings = 0
$results = [System.Collections.Generic.List[object]]::new()

function Add-Result {
  param(
    [string]$Label,
    [string]$Status,
    [string]$Details = "",
    [bool]$Critical = $false
  )

  $script:results.Add([pscustomobject]@{
    Label = $Label
    Status = $Status
    Details = $Details
  })

  if ($Critical) {
    $script:criticalFailures++
  } elseif ($Status -eq "WARN") {
    $script:warnings++
  }
}

function Format-Status {
  param([string]$Status)

  switch ($Status) {
    "OK" { return "OK     " }
    "WARN" { return "WARN   " }
    "FAIL" { return "FAIL   " }
    default { return $Status.PadRight(7) }
  }
}

$nodeAvailable = Test-CommandAvailable "node"
Add-Result -Label "Node" -Status $(if ($nodeAvailable) { "OK" } else { "FAIL" }) -Details $(if ($nodeAvailable) { "Available" } else { "node was not found on PATH." }) -Critical (-not $nodeAvailable)

$npmCommand = Get-NpmCommand
Add-Result -Label "npm" -Status $(if ($npmCommand) { "OK" } else { "FAIL" }) -Details $(if ($npmCommand) { "Available" } else { "npm was not found on PATH." }) -Critical (-not $npmCommand)

$javaPath = Get-JavaPath
Add-Result -Label "Java" -Status $(if ($javaPath) { "OK" } else { "FAIL" }) -Details $(if ($javaPath) { "Available" } else { "java.exe was not found. Install Android Studio or set JAVA_HOME." }) -Critical (-not $javaPath)

$javaHomeConfigured = $env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))
Add-Result -Label "JAVA_HOME" -Status $(if ($javaHomeConfigured) { "OK" } else { "FAIL" }) -Details $(if ($javaHomeConfigured) { $env:JAVA_HOME } else { "JAVA_HOME is missing or invalid." }) -Critical (-not $javaHomeConfigured)

$adbPath = Get-AdbPath
Add-Result -Label "ADB" -Status $(if ($adbPath) { "OK" } else { "FAIL" }) -Details $(if ($adbPath) { "Available" } else { "adb was not found. Install Android SDK Platform Tools." }) -Critical (-not $adbPath)

$authorizedDevices = @()
$allDevices = @()
if ($adbPath) {
  $allDevices = @(Get-AdbDevices)
  $authorizedDevices = @($allDevices | Where-Object { $_.IsAuthorized })
}

if (-not $adbPath) {
  Add-Result -Label "Phone" -Status "FAIL" -Details "Skipped because adb is unavailable." -Critical $true
} elseif ($authorizedDevices.Count -gt 0) {
  $deviceSummary = ($authorizedDevices | ForEach-Object { $_.Id }) -join ", "
  Add-Result -Label "Phone" -Status "OK" -Details "Authorized device(s): $deviceSummary"
} elseif ($allDevices.Count -gt 0) {
  $deviceSummary = ($allDevices | ForEach-Object { "$($_.Id) [$($_.State)]" }) -join ", "
  Add-Result -Label "Phone" -Status "FAIL" -Details "No authorized device. Found: $deviceSummary" -Critical $true
} else {
  Add-Result -Label "Phone" -Status "FAIL" -Details "No connected authorized Android device found." -Critical $true
}

$metroStatus = Test-MetroOnPort
if ($metroStatus.IsMetro) {
  Add-Result -Label "Metro 8081" -Status "OK" -Details "Metro is running on port 8081."
} elseif ($metroStatus.IsRunning) {
  Add-Result -Label "Metro 8081" -Status "WARN" -Details "Port 8081 is in use by PID $($metroStatus.Listener.Pid) ($($metroStatus.Listener.ProcessName)), but it does not look like Metro."
} else {
  Add-Result -Label "Metro 8081" -Status "WARN" -Details "Metro is not running on port 8081."
}

$devHostInfo = Get-PreferredDevHost
if ($devHostInfo.Host) {
  Add-Result -Label "Dev host" -Status "OK" -Details "$($devHostInfo.Host) via $($devHostInfo.Source)."
} else {
  Add-Result -Label "Dev host" -Status "WARN" -Details "No explicit EXPO_DEV_SERVER_HOST is configured; launch scripts will auto-detect a host."
}

$envPath = Join-Path $workspaceRoot ".env"
$appEnv = Read-EnvFile -Path $envPath
$requiredAppEnv = @(
  "EXPO_PUBLIC_APP_ENV",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_PHOTO_SOURCE_MODE"
)

if (-not (Test-Path $envPath)) {
  Add-Result -Label ".env" -Status "FAIL" -Details ".env is missing at the repo root." -Critical $true
  Add-Result -Label "Supabase env" -Status "FAIL" -Details "Cannot validate Expo env vars until .env exists." -Critical $true
} else {
  Add-Result -Label ".env" -Status "OK" -Details ".env found."
  $missingAppEnv = @($requiredAppEnv | Where-Object { -not $appEnv.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($appEnv[$_]) })
  if ($missingAppEnv.Count -gt 0) {
    Add-Result -Label "Supabase env" -Status "FAIL" -Details ("Missing required Expo env var(s): " + ($missingAppEnv -join ", ")) -Critical $true
  } else {
    Add-Result -Label "Supabase env" -Status "OK" -Details "Required Expo env vars are present."
  }
}

$photoMode = if ($appEnv.ContainsKey("EXPO_PUBLIC_PHOTO_SOURCE_MODE")) { $appEnv["EXPO_PUBLIC_PHOTO_SOURCE_MODE"] } else { $null }
$nasBaseUrl = if ($appEnv.ContainsKey("EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL")) { $appEnv["EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL"] } else { $null }
$nasApiKey = if ($appEnv.ContainsKey("EXPO_PUBLIC_NAS_PHOTO_API_KEY")) { $appEnv["EXPO_PUBLIC_NAS_PHOTO_API_KEY"] } else { $null }

if ($photoMode -eq "nas") {
  $missingNasEnv = @()
  if ([string]::IsNullOrWhiteSpace($nasBaseUrl)) {
    $missingNasEnv += "EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL"
  }
  if ([string]::IsNullOrWhiteSpace($nasApiKey)) {
    $missingNasEnv += "EXPO_PUBLIC_NAS_PHOTO_API_KEY"
  }

  if ($missingNasEnv.Count -gt 0) {
    Add-Result -Label "NAS env" -Status "FAIL" -Details ("NAS mode requires: " + ($missingNasEnv -join ", ")) -Critical $true
  } else {
    Add-Result -Label "NAS env" -Status "OK" -Details "NAS mode env vars are present."
  }
} elseif ([string]::IsNullOrWhiteSpace($nasBaseUrl) -or [string]::IsNullOrWhiteSpace($nasApiKey)) {
  Add-Result -Label "NAS env" -Status "WARN" -Details "NAS env vars are incomplete, but current photo mode is not nas."
} else {
  Add-Result -Label "NAS env" -Status "OK" -Details "NAS env vars are present."
}

if (-not [string]::IsNullOrWhiteSpace($nasBaseUrl)) {
  $health = Test-PhotoApiHealth -BaseUrl $nasBaseUrl -ApiKey $nasApiKey
  if ($health.Reachable) {
    Add-Result -Label "Photo API" -Status "OK" -Details "Health endpoint responded successfully."
  } else {
    $statusCodeText = if ($null -ne $health.StatusCode) { " (HTTP $($health.StatusCode))" } else { "" }
    Add-Result -Label "Photo API" -Status "WARN" -Details "Health endpoint was not reachable$statusCodeText."
  }
} else {
  Add-Result -Label "Photo API" -Status "WARN" -Details "Skipped because EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL is not configured."
}

$photoApiEnvPath = Join-Path $workspaceRoot "photo-api\.env"
$photoApiEnv = Read-EnvFile -Path $photoApiEnvPath
if (-not (Test-Path $photoApiEnvPath)) {
  Add-Result -Label "photo-api/.env" -Status "WARN" -Details "photo-api/.env is missing."
} else {
  Add-Result -Label "photo-api/.env" -Status "OK" -Details "photo-api/.env found."
}

if ($photoApiEnv.ContainsKey("PHOTO_LIBRARY_ROOT") -and -not [string]::IsNullOrWhiteSpace($photoApiEnv["PHOTO_LIBRARY_ROOT"])) {
  Add-Result -Label "PHOTO_LIBRARY_ROOT" -Status "OK" -Details "PHOTO_LIBRARY_ROOT is configured."
} else {
  Add-Result -Label "PHOTO_LIBRARY_ROOT" -Status "WARN" -Details "PHOTO_LIBRARY_ROOT is missing from photo-api/.env."
}

Write-Host ""
Write-Host "Tiny Chapters developer doctor"
Write-Host ""

foreach ($result in $results) {
  $line = "{0,-18} {1}" -f $result.Label, (Format-Status -Status $result.Status)
  if ($result.Details) {
    $line = "$line $($result.Details)"
  }

  Write-Host $line
}

Write-Host ""
if ($criticalFailures -gt 0) {
  Write-Host "Critical failures: $criticalFailures"
}
if ($warnings -gt 0) {
  Write-Host "Warnings: $warnings"
}

exit $(if ($criticalFailures -gt 0) { 1 } else { 0 })
