param(
  [switch]$Device
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$androidStudioJbr = "C:\Program Files\Android\Android Studio\jbr"
$intellijJbr = "C:\Program Files\JetBrains\IntelliJ IDEA 2025.3.3\jbr"
$androidSdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$gradleUserHome = Join-Path $env:LOCALAPPDATA "tc-gradle"

function Set-JavaHomeIfNeeded {
  if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
    return
  }

  foreach ($candidate in @($androidStudioJbr, $intellijJbr)) {
    if (Test-Path (Join-Path $candidate "bin\java.exe")) {
      $env:JAVA_HOME = $candidate
      return
    }
  }

  throw "JAVA_HOME is not set and no bundled JDK was found. Install Android Studio or set JAVA_HOME manually."
}

Set-JavaHomeIfNeeded
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:GRADLE_USER_HOME = $gradleUserHome
$gradleFlags = @(
  "-Dorg.gradle.daemon=false",
  "-Dorg.gradle.caching=false",
  "-Dorg.gradle.parallel=false",
  "-Dorg.gradle.vfs.watch=false"
)

if ($env:GRADLE_OPTS) {
  $env:GRADLE_OPTS = "$($gradleFlags -join ' ') $env:GRADLE_OPTS"
} else {
  $env:GRADLE_OPTS = $gradleFlags -join " "
}

if (Test-Path $androidSdkRoot) {
  $env:ANDROID_HOME = $androidSdkRoot
  $env:ANDROID_SDK_ROOT = $androidSdkRoot
  $env:Path = "$androidSdkRoot\platform-tools;$androidSdkRoot\emulator;$env:Path"
}

$expoCli = Join-Path $workspaceRoot "node_modules\.bin\expo.cmd"
if (-not (Test-Path $expoCli)) {
  throw "Expo CLI was not found at $expoCli. Run npm install first."
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
