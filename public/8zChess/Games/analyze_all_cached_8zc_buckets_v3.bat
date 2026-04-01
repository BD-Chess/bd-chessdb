@echo off
setlocal

set SCRIPT=8zc-headless_v0.6.2.js
set CACHE=./8zc_cache
set OUT=./8zc_results
set DEPTH=10
set TOP=5
set FLOOR=80

echo ============================================================
echo 8ZC OFFLINE ANALYZE ^(cache-only^)  [v0.6.2]
echo Script: %SCRIPT%
echo Cache : %CACHE%
echo Out   : %OUT%
echo Depth : %DEPTH%
echo Top   : %TOP%
echo Floor : %FLOOR% cp
echo ============================================================
echo.

if not exist "%OUT%\by_group\players" mkdir "%OUT%\by_group\players" >nul 2>nul
if not exist "%OUT%\by_group\openings" mkdir "%OUT%\by_group\openings" >nul 2>nul

call :ANALYZE "AnandV_Selected.pgn" players
call :ANALYZE "AronianL_Selected.pgn" players
call :ANALYZE "CapablancaJ_Selected.pgn" players
call :ANALYZE "CarlsenM_Selected.pgn" players
call :ANALYZE "CaruanaF_Selected.pgn" players
call :ANALYZE "DingL_Selected.pgn" players
call :ANALYZE "FirouzjaA_Selected.pgn" players
call :ANALYZE "FischerB_Selected.pgn" players
call :ANALYZE "GukeshD_Selected.pgn" players
call :ANALYZE "KasparovG_Selected.pgn" players
call :ANALYZE "KramnikV_Selected.pgn" players
call :ANALYZE "Chess_Openings_Top_Lines.pgn" openings

echo.
echo ============================================================
echo Aggregating summary CSVs...
echo ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File ".\aggregate_8zc_results_v3.ps1" -Root "%OUT%"

echo.
echo Done.
echo Outputs per PGN are under %OUT%\by_group\...
echo Aggregates are under %OUT%\aggregates\
echo.
pause
exit /b 0

:ANALYZE
set FILE=%~1
set GROUP=%~2

echo ------------------------------------------------------------
echo Analyzing %FILE%  [group=%GROUP%]
echo ------------------------------------------------------------
echo.

bun run "%SCRIPT%" analyze "%FILE%" --cache "%CACHE%" --out "%OUT%\by_group\%GROUP%\%~n1_dcc" --depth %DEPTH% --top %TOP% --floor %FLOOR%
echo.
exit /b 0
