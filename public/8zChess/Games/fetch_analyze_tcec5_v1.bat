@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "HEADLESS=8zc-headless_v0.6.2.js"
set "CACHE=./8zc_cache"
set "OUT=./8zc_results_tcec5"
set "DEPTH=10"
set "TOP=5"
set "FLOOR=80"

if not exist "%CACHE%" mkdir "%CACHE%"
if not exist "%OUT%" mkdir "%OUT%"
if not exist "%OUT%\by_group\cup" mkdir "%OUT%\by_group\cup"
if not exist "%OUT%\by_group\sufi" mkdir "%OUT%\by_group\sufi"

if not exist "%HEADLESS%" (
  echo ERROR: %HEADLESS% not found in current folder.
  echo Put this BAT into the same folder as %HEADLESS% and the PGN files.
  pause
  exit /b 1
)

echo ============================================================
echo 8ZC TCEC5 - FETCH + ANALYZE
echo Cache : %CACHE%
echo Out   : %OUT%
echo Depth : %DEPTH%
echo Top   : %TOP%
echo Floor : %FLOOR% cp
echo ============================================================

call :run "TCEC-S27-Cup-14.pgn" "cup" || goto :fail
call :run "TCEC-S26-Cup-13.pgn" "cup" || goto :fail
call :run "TCEC-S25-Cup-12.pgn" "cup" || goto :fail
call :run "TCEC-S16-LCZero-VS-Redfish-S15-Sufi-Decisive-Bonus.pgn" "sufi" || goto :fail
call :run "TCEC-S16-LCZero-VS-Redfish-S15-Sufi-Undecisive-Bonus.pgn" "sufi" || goto :fail

echo.
echo Done. Results are under %OUT%\by_group\...
pause
exit /b 0

:run
set "PGN=%~1"
set "GROUP=%~2"
set "BASE=%~n1"

echo.
echo ------------------------------------------------------------
echo FETCH   %PGN%  [group=%GROUP%]
echo ------------------------------------------------------------
bun run "%HEADLESS%" fetch "%PGN%" --cache "%CACHE%"
if errorlevel 1 exit /b 1

echo.
echo ------------------------------------------------------------
echo ANALYZE %PGN%  [group=%GROUP%]
echo ------------------------------------------------------------
bun run "%HEADLESS%" analyze "%PGN%" --cache "%CACHE%" --out "%OUT%\by_group\%GROUP%\%BASE%_dcc" --depth %DEPTH% --top %TOP% --floor %FLOOR%
if errorlevel 1 exit /b 1
exit /b 0

:fail
echo.
echo FAILED. See error above.
pause
exit /b 1
