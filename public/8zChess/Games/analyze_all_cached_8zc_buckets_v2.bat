@echo off
setlocal EnableExtensions EnableDelayedExpansion

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
powershell -NoProfile -ExecutionPolicy Bypass -File ".\aggregate_8zc_results.ps1" -Root "%OUT%"
if errorlevel 1 (
  echo [warn] aggregation step failed
)

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
