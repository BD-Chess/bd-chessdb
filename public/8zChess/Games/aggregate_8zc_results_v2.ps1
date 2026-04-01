param(
  [string]$Root = ".\8zc_results"
)

$rootPath = (Resolve-Path $Root).Path
$agg = Join-Path $rootPath 'aggregates'
New-Item -ItemType Directory -Force -Path $agg | Out-Null

$csvs = Get-ChildItem -Path (Join-Path $rootPath 'by_group') -Recurse -File -Filter '*_summary.csv' -ErrorAction SilentlyContinue
if (-not $csvs -or $csvs.Count -eq 0) {
  Write-Host "No summary CSVs found under $rootPath\by_group"
  exit 0
}

$rows = New-Object System.Collections.Generic.List[object]
foreach ($f in $csvs) {
  $group = 'misc'
  if ($f.FullName -match [regex]::Escape((Join-Path $rootPath 'by_group')) + '\\([^\\]+)\\') { $group = $matches[1] }
  $imports = Import-Csv -Path $f.FullName
  foreach ($row in $imports) {
    $row | Add-Member -NotePropertyName source_group -NotePropertyValue $group -Force
    $row | Add-Member -NotePropertyName source_csv -NotePropertyValue $f.Name -Force
    $row | Add-Member -NotePropertyName source_path -NotePropertyValue $f.FullName -Force
    $rows.Add($row) | Out-Null
  }
}

$all = $rows
$all | Export-Csv -Path (Join-Path $agg 'all_games_summary.csv') -NoTypeInformation -Encoding UTF8
$all | Where-Object { $_.result -eq '1-0' } | Export-Csv -Path (Join-Path $agg 'white_wins_summary.csv') -NoTypeInformation -Encoding UTF8
$all | Where-Object { $_.result -eq '0-1' } | Export-Csv -Path (Join-Path $agg 'black_wins_summary.csv') -NoTypeInformation -Encoding UTF8
$all | Where-Object { $_.result -eq '1/2-1/2' } | Export-Csv -Path (Join-Path $agg 'draws_summary.csv') -NoTypeInformation -Encoding UTF8
$all | Where-Object { $_.result -notin @('1-0','0-1','1/2-1/2') } | Export-Csv -Path (Join-Path $agg 'unknown_result_summary.csv') -NoTypeInformation -Encoding UTF8
$all | Where-Object { $_.source_group -eq 'players' } | Export-Csv -Path (Join-Path $agg 'players_summary.csv') -NoTypeInformation -Encoding UTF8
$all | Where-Object { $_.source_group -eq 'openings' } | Export-Csv -Path (Join-Path $agg 'openings_summary.csv') -NoTypeInformation -Encoding UTF8

Write-Host ("Aggregated rows: " + $all.Count)
Write-Host ("Aggregates written to: " + $agg)
