param(
  [string]$Root = ".\8zc_results"
)

$rootPath = Resolve-Path $Root
$agg = Join-Path $rootPath 'aggregates'
New-Item -ItemType Directory -Force -Path $agg | Out-Null

$csvs = Get-ChildItem (Join-Path $rootPath 'by_group') -Recurse -Filter '*_summary.csv' -ErrorAction SilentlyContinue
if (-not $csvs -or $csvs.Count -eq 0) {
  Write-Host 'No summary CSVs found.'
  exit 0
}

$all = foreach ($f in $csvs) {
  $group = if ($f.FullName -match '\\by_group\\([^\\]+)\\') { $matches[1] } else { 'misc' }
  Import-Csv $f | Select-Object *,
    @{Name='source_group';Expression={$group}},
    @{Name='source_csv';Expression={$f.Name}},
    @{Name='source_path';Expression={$f.FullName}}
}

$all | Export-Csv (Join-Path $agg 'all_games_summary.csv') -NoTypeInformation -Encoding UTF8
$all | Where-Object { $_.result -eq '1-0' } | Export-Csv (Join-Path $agg 'white_wins_summary.csv') -NoTypeInformation -Encoding UTF8
$all | Where-Object { $_.result -eq '0-1' } | Export-Csv (Join-Path $agg 'black_wins_summary.csv') -NoTypeInformation -Encoding UTF8
$all | Where-Object { $_.result -eq '1/2-1/2' } | Export-Csv (Join-Path $agg 'draws_summary.csv') -NoTypeInformation -Encoding UTF8
$all | Where-Object { $_.result -notin @('1-0','0-1','1/2-1/2') } | Export-Csv (Join-Path $agg 'unknown_result_summary.csv') -NoTypeInformation -Encoding UTF8
$all | Where-Object { $_.source_group -eq 'players' } | Export-Csv (Join-Path $agg 'players_summary.csv') -NoTypeInformation -Encoding UTF8
$all | Where-Object { $_.source_group -eq 'openings' } | Export-Csv (Join-Path $agg 'openings_summary.csv') -NoTypeInformation -Encoding UTF8

Write-Host ("Aggregated rows: " + $all.Count)
Write-Host ("Aggregates written to: " + $agg)
