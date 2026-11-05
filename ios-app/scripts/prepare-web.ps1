$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$source = [System.IO.Path]::GetFullPath((Join-Path $project '..\dist'))
$target = [System.IO.Path]::GetFullPath((Join-Path $project 'www'))
if (-not $source.StartsWith([System.IO.Path]::GetFullPath('D:\pokecatch'), [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unexpected game source: $source"
}
New-Item -ItemType Directory -Force -Path $target | Out-Null
robocopy $source $target /MIR /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -gt 7) { throw "robocopy failed with exit code $LASTEXITCODE" }
Copy-Item -LiteralPath (Join-Path $source 'index.local.html') -Destination (Join-Path $target 'index.html') -Force
Write-Output "Prepared offline iOS web assets in $target"
