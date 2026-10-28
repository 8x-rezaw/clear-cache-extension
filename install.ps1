# Installs Clear Cache from GitHub and keeps it up to date (Windows).
#   irm https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.ps1 | iex
# Uninstall:
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.ps1))) -Uninstall
param([switch]$Update, [switch]$Uninstall)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = '8x-rezaw/clear-cache-extension'
$Dir = Join-Path $env:LOCALAPPDATA 'ClearCacheExtension'
$TaskName = 'ClearCacheExtensionUpdate'

function Get-LocalVersion {
  $manifest = Join-Path $Dir 'manifest.json'
  if (Test-Path $manifest) { return (Get-Content $manifest -Raw -Encoding UTF8 | ConvertFrom-Json).version }
  return $null
}

function Install-Latest {
  $json = (Invoke-WebRequest "https://raw.githubusercontent.com/$Repo/main/manifest.json" -UseBasicParsing).Content
  $remote = ($json | ConvertFrom-Json).version
  if ($remote -eq (Get-LocalVersion)) { return $false }

  $tmp = Join-Path $env:TEMP ("ccx-" + [guid]::NewGuid())
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    $zip = Join-Path $tmp 'repo.zip'
    Invoke-WebRequest "https://codeload.github.com/$Repo/zip/refs/heads/main" -OutFile $zip -UseBasicParsing
    Expand-Archive $zip -DestinationPath $tmp -Force
    $src = Get-ChildItem $tmp -Directory | Select-Object -First 1
    New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    robocopy $src.FullName $Dir /MIR /XD _metadata /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copy failed ($LASTEXITCODE)" }
  } finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
  return $true
}

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host 'Automatic updates removed.'
  Write-Host 'Remove the extension in chrome://extensions, then delete this folder:'
  Write-Host "  $Dir"
  return
}

if ($Update) {
  Install-Latest | Out-Null
  return
}

Install-Latest | Out-Null

$script = Join-Path $Dir 'install.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" -Update"
$hourly = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) `
  -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$logon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $hourly, $logon -Settings $settings -Force | Out-Null
} catch {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $hourly -Settings $settings -Force | Out-Null
}

try { Set-Clipboard -Value $Dir } catch {}

Write-Host ''
Write-Host "Installed to: $Dir" -ForegroundColor Green
Write-Host '(The path has been copied to the clipboard.)'
Write-Host ''
Write-Host 'One time in Chrome:'
Write-Host '  1. Open chrome://extensions and turn on Developer mode.'
Write-Host '  2. Click Load unpacked and paste the path above into the folder picker.'
Write-Host ''
Write-Host 'New versions are downloaded hourly and applied automatically.'
