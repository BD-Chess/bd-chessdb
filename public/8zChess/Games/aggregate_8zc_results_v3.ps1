param(
  [string]$Root = ".\8zc_results"
)

$ErrorActionPreference = 'Stop'

$rootPath = Resolve-Path $Root
$agg = Join-Path $rootPath 'aggregates'
New-Item -ItemType Directory -Force -Path $agg | Out-Null

$files = Get-ChildItem -Path (Join-Path $rootPath 'by_group') -Filter '*_dcc_summary.csv' -Recurse -File

$rows = foreach ($f in $files) {
  $group = Split-Path $f.DirectoryName -Leaf
  Import-Csv $f.FullName | Select-Object *,
    @{Name='source_file';Expression={$f.Name}},
    @{Name='source_path';Expression={$f.FullName}},
    @{Name='group';Expression={$group}}
}

$rows = @($rows)

$allPath = Join-Path $agg 'all_games_summary.csv'
$rows | Export-Csv -NoTypeInformation -Encoding UTF8 $allPath

$whiteWins   = @($rows | Where-Object { $_.Result -eq '1-0' })
$blackWins   = @($rows | Where-Object { $_.Result -eq '0-1' })
$draws       = @($rows | Where-Object { $_.Result -eq '1/2-1/2' })
$unknown     = @($rows | Where-Object { $_.Result -ne '1-0' -and $_.Result -ne '0-1' -and $_.Result -ne '1/2-1/2' })

$whiteWins | Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path $agg 'white_wins_summary.csv')
$blackWins | Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path $agg 'black_wins_summary.csv')
$draws     | Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path $agg 'draws_summary.csv')
$unknown   | Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path $agg 'unknown_result_summary.csv')

$players = @($rows | Where-Object { $_.group -eq 'players' })
$openings = @($rows | Where-Object { $_.group -eq 'openings' })

$players | Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path $agg 'players_summary.csv')
$openings | Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path $agg 'openings_summary.csv')

Write-Host ("Aggregated rows: {0}" -f $rows.Count)
Write-Host ("Aggregates written to: {0}" -f $agg)
