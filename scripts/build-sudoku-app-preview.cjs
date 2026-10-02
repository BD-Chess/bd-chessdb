'use strict';
const {execFileSync}=require('node:child_process'),path=require('node:path');
execFileSync(process.execPath,[path.join(__dirname,'build-sudoku-app-retirement.cjs'),...process.argv.slice(2)],{stdio:'inherit'});
