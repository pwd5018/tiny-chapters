Set-StrictMode -Version Latest

$script:AndroidStudioJbr = "C:\Program Files\Android\Android Studio\jbr"
$script:IntelliJJbr = "C:\Program Files\JetBrains\IntelliJ IDEA 2025.3.3\jbr"
$script:DefaultAndroidSdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$script:DefaultGradleUserHome = Join-Path $env:LOCALAPPDATA "tc-gradle"
$script:MetroPort = 8081
$script:AndroidPackage = "com.anonymous.tinychapters"
$script:AppScheme = "tinychapters"

function Get-WorkspaceRoot {
  return Split-Path -Parent $PSScriptRoot
}

function Test-CommandAvailable {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Set-JavaHomeIfNeeded {
  if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
    return $env:JAVA_HOME
  }

  foreach ($candidate in @($script:AndroidStudioJbr, $script:IntelliJJbr)) {
    if (Test-Path (Join-Path $candidate "bin\java.exe")) {
      $env:JAVA_HOME = $candidate
      return $env:JAVA_HOME
    }
  }

  return $null
}

function Initialize-AndroidEnvironment {
  $javaHome = Set-JavaHomeIfNeeded
  if ($javaHome) {
    $env:Path = "$javaHome\bin;$env:Path"
  }

  $env:GRADLE_USER_HOME = $script:DefaultGradleUserHome

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

  if (Test-Path $script:DefaultAndroidSdkRoot) {
    $env:ANDROID_HOME = $script:DefaultAndroidSdkRoot
    $env:ANDROID_SDK_ROOT = $script:DefaultAndroidSdkRoot
    $env:Path = "$script:DefaultAndroidSdkRoot\platform-tools;$script:DefaultAndroidSdkRoot\emulator;$env:Path"
  }
}

function Get-ExpoCliPath {
  $expoCli = Join-Path (Get-WorkspaceRoot) "node_modules\.bin\expo.cmd"
  if (Test-Path $expoCli) {
    return $expoCli
  }

  return $null
}

function Get-NpmCommand {
  $npmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
  if ($npmCommand) {
    return $npmCommand.Source
  }

  $npmCommand = Get-Command "npm" -ErrorAction SilentlyContinue
  if ($npmCommand) {
    return $npmCommand.Source
  }

  return $null
}

function Get-AdbPath {
  $adbCommand = Get-Command "adb" -ErrorAction SilentlyContinue
  if ($adbCommand) {
    return $adbCommand.Source
  }

  $sdkAdb = Join-Path $script:DefaultAndroidSdkRoot "platform-tools\adb.exe"
  if (Test-Path $sdkAdb) {
    return $sdkAdb
  }

  return $null
}

function Get-JavaPath {
  $javaCommand = Get-Command "java" -ErrorAction SilentlyContinue
  if ($javaCommand) {
    return $javaCommand.Source
  }

  if ($env:JAVA_HOME) {
    $javaPath = Join-Path $env:JAVA_HOME "bin\java.exe"
    if (Test-Path $javaPath) {
      return $javaPath
    }
  }

  return $null
}

function Read-EnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $values = @{}
  if (-not (Test-Path $Path)) {
    return $values
  }

  foreach ($rawLine in Get-Content $Path) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      continue
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    if ($value.Length -ge 2) {
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }

    $values[$key] = $value
  }

  return $values
}

function Get-ConfigValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Key
  )

  $processValue = [Environment]::GetEnvironmentVariable($Key)
  if (-not [string]::IsNullOrWhiteSpace($processValue)) {
    return $processValue
  }

  $envPath = Join-Path (Get-WorkspaceRoot) ".env"
  $appEnv = Read-EnvFile -Path $envPath

  if ($appEnv.ContainsKey($Key) -and -not [string]::IsNullOrWhiteSpace($appEnv[$Key])) {
    return $appEnv[$Key]
  }

  return $null
}

function Get-PortListener {
  param(
    [int]$Port = $script:MetroPort
  )

  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
  } catch {
    return $null
  }

  if (-not $connections) {
    return $null
  }

  $connection = @($connections | Sort-Object -Property OwningProcess)[0]
  $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue

  return [pscustomobject]@{
    Port = $Port
    Pid = $connection.OwningProcess
    ProcessName = if ($process) { $process.ProcessName } else { "Unknown" }
  }
}

function Test-MetroOnPort {
  param(
    [int]$Port = $script:MetroPort
  )

  $listener = Get-PortListener -Port $Port
  if (-not $listener) {
    return [pscustomobject]@{
      IsRunning = $false
      IsMetro = $false
      Listener = $null
    }
  }

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/status" -TimeoutSec 2
    $content = ($response.Content | Out-String).Trim()
    $isMetro = $content -like "*packager-status:running*"
  } catch {
    $isMetro = $false
  }

  return [pscustomobject]@{
    IsRunning = $true
    IsMetro = $isMetro
    Listener = $listener
  }
}

function Get-AdbDevices {
  $adbPath = Get-AdbPath
  if (-not $adbPath) {
    return @()
  }

  $lines = & $adbPath devices
  $devices = @()

  foreach ($line in $lines) {
    if (-not $line -or $line.StartsWith("List of devices attached")) {
      continue
    }

    $trimmed = $line.Trim()
    if (-not $trimmed) {
      continue
    }

    $parts = $trimmed -split "\s+"
    if ($parts.Count -lt 2) {
      continue
    }

    $devices += [pscustomobject]@{
      Id = $parts[0]
      State = $parts[1]
      IsAuthorized = $parts[1] -eq "device"
    }
  }

  return $devices
}

function Get-AuthorizedAdbDevices {
  return @(Get-AdbDevices | Where-Object { $_.IsAuthorized })
}

function Get-PreferredDevHost {
  $configuredHost = Get-ConfigValue -Key "EXPO_DEV_SERVER_HOST"
  if ($configuredHost) {
    return [pscustomobject]@{
      Host = $configuredHost
      Source = if (-not [string]::IsNullOrWhiteSpace($env:EXPO_DEV_SERVER_HOST)) {
        "EXPO_DEV_SERVER_HOST env"
      } else {
        ".env EXPO_DEV_SERVER_HOST"
      }
      Candidates = @($configuredHost)
    }
  }

  $candidates = @()

  try {
    $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object {
        $_.IPAddress -ne "127.0.0.1" -and
        $_.IPAddress -notlike "169.254.*"
      }

    foreach ($address in $addresses) {
      $adapter = Get-NetAdapter -InterfaceIndex $address.InterfaceIndex -ErrorAction SilentlyContinue
      if (-not $adapter -or $adapter.Status -ne "Up") {
        continue
      }

      $alias = $adapter.InterfaceAlias
      $score = 50

      if ($alias -match "Wi-?Fi|Wireless") {
        $score = 1
      } elseif ($alias -match "Ethernet") {
        $score = 2
      } elseif ($alias -match "vEthernet|Virtual|VMware|Hyper-V|WSL|Loopback|Bluetooth|Tailscale|ZeroTier") {
        $score = 90
      }

      $candidates += [pscustomobject]@{
        IPAddress = $address.IPAddress
        InterfaceAlias = $alias
        Score = $score
      }
    }
  } catch {
    $candidates = @()
  }

  $ordered = @($candidates | Sort-Object -Property Score, InterfaceAlias, IPAddress)
  if ($ordered.Count -gt 0) {
    return [pscustomobject]@{
      Host = $ordered[0].IPAddress
      Source = "auto-detected"
      Candidates = @($ordered | ForEach-Object { "$($_.IPAddress) ($($_.InterfaceAlias))" })
    }
  }

  return [pscustomobject]@{
    Host = $null
    Source = "not-found"
    Candidates = @()
  }
}

function Start-MetroWindow {
  $workspaceRoot = Get-WorkspaceRoot
  $npmCommand = Get-NpmCommand

  if (-not $npmCommand) {
    throw "npm was not found on PATH."
  }

  $command = "Set-Location '$workspaceRoot'; & '$npmCommand' run dev"
  Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $command
  ) -WorkingDirectory $workspaceRoot | Out-Null
}

function Ensure-MetroRunning {
  param(
    [switch]$ForcePortKill
  )

  $metroStatus = Test-MetroOnPort
  if ($metroStatus.IsMetro) {
    return [pscustomobject]@{
      StartedMetro = $false
      MetroStatus = $metroStatus
    }
  }

  if ($metroStatus.IsRunning -and -not $metroStatus.IsMetro) {
    $listener = $metroStatus.Listener
    $message = "Port $($script:MetroPort) is already in use by PID $($listener.Pid) ($($listener.ProcessName))."
    if (-not $ForcePortKill) {
      throw "$message Stop that process or rerun with -ForcePortKill."
    }

    Stop-Process -Id $listener.Pid -Force
    Start-Sleep -Seconds 1
  }

  Start-MetroWindow

  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Seconds 1
    $metroStatus = Test-MetroOnPort
    if ($metroStatus.IsMetro) {
      return [pscustomobject]@{
        StartedMetro = $true
        MetroStatus = $metroStatus
      }
    }
  }

  throw "Metro did not become ready on port $($script:MetroPort)."
}

function Test-PhotoApiHealth {
  param(
    [string]$BaseUrl,
    [string]$ApiKey
  )

  if (-not $BaseUrl) {
    return [pscustomobject]@{
      Reachable = $false
      StatusCode = $null
      Message = "Photo API base URL is not configured."
    }
  }

  $headers = @{}
  if ($ApiKey) {
    $headers["Authorization"] = "Bearer $ApiKey"
  }

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/health" -Headers $headers -TimeoutSec 3
    return [pscustomobject]@{
      Reachable = $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
      StatusCode = $response.StatusCode
      Message = "OK"
    }
  } catch {
    $statusCode = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }

    return [pscustomobject]@{
      Reachable = $false
      StatusCode = $statusCode
      Message = $_.Exception.Message
    }
  }
}
