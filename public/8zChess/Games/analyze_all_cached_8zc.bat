@echo off
setlocal
cd /d "%~dp0"

REM 8ZC offline analiza iz lokalnega cache-a (brez novega fetchanja)
REM Prilagodi po želji:
set CACHE=./8zc_cache
set OUT=./8zc_results
set DEPTH=10
set TOP=5
set FLOOR=80

if not exist "%OUT%" mkdir "%OUT%"

echo.
echo 8ZC offline analyze iz cache-a
echo Cache: %CACHE%
echo Out:   %OUT%
echo Depth: %DEPTH%  Top: %TOP%  Floor: %FLOOR%
echo.

call bun run 8zc-headless.js analyze "AnandV_Selected.pgn"              --cache "%CACHE%" --out "%OUT%/AnandV_Selected_dcc"              --depth %DEPTH% --top %TOP% --floor %FLOOR%
call bun run 8zc-headless.js analyze "AronianL_Selected.pgn"            --cache "%CACHE%" --out "%OUT%/AronianL_Selected_dcc"            --depth %DEPTH% --top %TOP% --floor %FLOOR%
call bun run 8zc-headless.js analyze "CapablancaJ_Selected.pgn"         --cache "%CACHE%" --out "%OUT%/CapablancaJ_Selected_dcc"         --depth %DEPTH% --top %TOP% --floor %FLOOR%
call bun run 8zc-headless.js analyze "CarlsenM_Selected.pgn"            --cache "%CACHE%" --out "%OUT%/CarlsenM_Selected_dcc"            --depth %DEPTH% --top %TOP% --floor %FLOOR%
call bun run 8zc-headless.js analyze "CaruanaF_Selected.pgn"            --cache "%CACHE%" --out "%OUT%/CaruanaF_Selected_dcc"            --depth %DEPTH% --top %TOP% --floor %FLOOR%
call bun run 8zc-headless.js analyze "Chess_Openings_Top_Lines.pgn"     --cache "%CACHE%" --out "%OUT%/Chess_Openings_Top_Lines_dcc"     --depth %DEPTH% --top %TOP% --floor %FLOOR%
call bun run 8zc-headless.js analyze "DingL_Selected.pgn"               --cache "%CACHE%" --out "%OUT%/DingL_Selected_dcc"               --depth %DEPTH% --top %TOP% --floor %FLOOR%
call bun run 8zc-headless.js analyze "FirouzjaA_Selected.pgn"           --cache "%CACHE%" --out "%OUT%/FirouzjaA_Selected_dcc"           --depth %DEPTH% --top %TOP% --floor %FLOOR%
call bun run 8zc-headless.js analyze "FischerB_Selected.pgn"            --cache "%CACHE%" --out "%OUT%/FischerB_Selected_dcc"            --depth %DEPTH% --top %TOP% --floor %FLOOR%
call bun run 8zc-headless.js analyze "GukeshD_Selected.pgn"             --cache "%CACHE%" --out "%OUT%/GukeshD_Selected_dcc"             --depth %DEPTH% --top %TOP% --floor %FLOOR%
call bun run 8zc-headless.js analyze "KasparovG_Selected.pgn"           --cache "%CACHE%" --out "%OUT%/KasparovG_Selected_dcc"           --depth %DEPTH% --top %TOP% --floor %FLOOR%
call bun run 8zc-headless.js analyze "KramnikV_Selected.pgn"            --cache "%CACHE%" --out "%OUT%/KramnikV_Selected_dcc"            --depth %DEPTH% --top %TOP% --floor %FLOOR%

echo.
echo Koncano. Rezultati so v %OUT%
pause
