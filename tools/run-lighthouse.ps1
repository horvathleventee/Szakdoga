param(
  [Parameter(Mandatory = $true)]
  [string]$Url,

  [string]$Mode = "desktop",

  [string]$OutputDir = ".\\docs\\measurements",

  [string]$ChromePath = ""
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$preset = if ($Mode -eq "mobile") { "perf" } else { "desktop" }
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$baseName = "lighthouse-$Mode-$timestamp"
$htmlOut = Join-Path $OutputDir "$baseName.html"
$jsonOut = Join-Path $OutputDir "$baseName.json"

$args = @(
  "lighthouse",
  $Url,
  "--preset=$preset",
  "--output=html",
  "--output=json",
  "--output-path=$htmlOut"
)

if ($ChromePath) {
  $args += "--chrome-path=$ChromePath"
}

Write-Host "Running Lighthouse for $Url ($Mode)..."
& npx.cmd @args

if (Test-Path $htmlOut) {
  Write-Host "HTML report: $htmlOut"
}

$jsonGenerated = [System.IO.Path]::ChangeExtension($htmlOut, ".report.json")
if (Test-Path $jsonGenerated) {
  Move-Item -Force $jsonGenerated $jsonOut
  Write-Host "JSON report: $jsonOut"
}
