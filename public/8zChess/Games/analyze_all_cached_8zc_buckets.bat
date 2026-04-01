@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================
REM 8ZC offline analysis for already-fetched PGNs in ./8zc_cache
REM - runs ONLY `analyze` (zero API calls)
REM - writes outputs into grouped folders under ./8zc_results
REM - aggregates summary CSVs into all / white wins / black wins / draws / unknown
REM ============================================================

set "CACHE=./8zc_cache"
set "OUT=./8zc_results"
set "DEPTH=10"
set "TOP=5"
set "FLOOR=80"

if not exist "%OUT%" mkdir "%OUT%"
if not exist "%OUT%\by_group" mkdir "%OUT%\by_group"
if not exist "%OUT%\by_group\players" mkdir "%OUT%\by_group\players"
if not exist "%OUT%\by_group\openings" mkdir "%OUT%\by_group\openings"
if not exist "%OUT%\aggregates" mkdir "%OUT%\aggregates"

echo.
echo ============================================================
echo 8ZC OFFLINE ANALYZE (cache-only)
echo Cache : %CACHE%
echo Out   : %OUT%
echo Depth : %DEPTH%
echo Top   : %TOP%
echo Floor : %FLOOR% cp
echo ============================================================
echo.

call :analyze "AnandV_Selected.pgn" players
call :analyze "AronianL_Selected.pgn" players
call :analyze "CapablancaJ_Selected.pgn" players
call :analyze "CarlsenM_Selected.pgn" players
call :analyze "CaruanaF_Selected.pgn" players
call :analyze "DingL_Selected.pgn" players
call :analyze "FirouzjaA_Selected.pgn" players
call :analyze "FischerB_Selected.pgn" players
call :analyze "GukeshD_Selected.pgn" players
call :analyze "KasparovG_Selected.pgn" players
call :analyze "KramnikV_Selected.pgn" players
call :analyze "Chess_Openings_Top_Lines.pgn" openings

echo.
echo ============================================================
echo Aggregating summary CSVs...
echo ============================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = Resolve-Path '.\8zc_results'; ^
    $agg  = Join-Path $root 'aggregates'; ^
    New-Item -ItemType Directory -Force -Path $agg | Out-Null; ^
    $csvs = Get-ChildItem (Join-Path $root 'by_group') -Recurse -Filter '*_summary.csv'; ^
    $all = foreach ($f in $csvs) { ^
      $group = if ($f.FullName -match '\\by_group\\([^\\]+)\\') { $matches[1] } else { 'misc' }; ^
      Import-Csv $f | Select-Object *, ^
        @{Name='source_group';Expression={$group}}, ^
        @{Name='source_csv';Expression={$f.Name}}, ^
        @{Name='source_path';Expression={$f.FullName}} ^
    }; ^
    if ($null -eq $all -or $all.Count -eq 0) { Write-Host 'No summary CSVs found.'; exit 0 }; ^
    $all | Export-Csv (Join-Path $agg 'all_games_summary.csv') -NoTypeInformation -Encoding UTF8; ^
    $all | Where-Object { $_.result -eq '1-0' }     | Export-Csv (Join-Path $agg 'white_wins_summary.csv') -NoTypeInformation -Encoding UTF8; ^
    $all | Where-Object { $_.result -eq '0-1' }     | Export-Csv (Join-Path $agg 'black_wins_summary.csv') -NoTypeInformation -Encoding UTF8; ^
    $all | Where-Object { $_.result -eq '1/2-1/2' } | Export-Csv (Join-Path $agg 'draws_summary.csv') -NoTypeInformation -Encoding UTF8; ^
    $all | Where-Object { $_.result -notin @('1-0','0-1','1/2-1/2') } | Export-Csv (Join-Path $agg 'unknown_result_summary.csv') -NoTypeInformation -Encoding UTF8; ^
    $all | Where-Object { $_.source_group -eq 'players' }  | Export-Csv (Join-Path $agg 'players_summary.csv') -NoTypeInformation -Encoding UTF8; ^
    $all | Where-Object { $_.source_group -eq 'openings' } | Export-Csv (Join-Path $agg 'openings_summary.csv') -NoTypeInformation -Encoding UTF8; ^
    Write-Host ('Aggregated rows: ' + $all.Count);"

echo.
echo Done.
echo Outputs per PGN are under %OUT%\by_group\...
echo Aggregates are under %OUT%\aggregates\
echo.
exit /b 0

:analyze
set "PGN=%~1"
set "GROUP=%~2"
set "BASE=%~n1"

if not exist "%PGN%" (
  echo [skip] Missing file: %PGN%
  goto :eof
)

echo ------------------------------------------------------------
echo Analyzing %PGN%  [group=%GROUP%]
echo ------------------------------------------------------------
bun run 8zc-headless.js analyze "%PGN%" --cache "%CACHE%" --out "%OUT%\by_group\%GROUP%\%BASE%_dcc" --depth %DEPTH% --top %TOP% --floor %FLOOR%
if errorlevel 1 (
  echo [warn] analyze failed for %PGN%
)
goto :eof
