// Explicit manual helper; not included in npm test. Never uses a real user profile.
import { createRequire } from 'node:module';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const require=createRequire(import.meta.url);
const {boot,fixture,fixtureSolution,until,NS}=require('./support/native-harness.cjs');
const cleanups=[];
const old=process.argv[2];
if(!old)throw Error('Pass the exact old generated index.html');
const h=await boot({after:f=>cleanups.push(f)}, {}, {width:402,height:874}, {htmlPath:old});
try {
 const {w,el}=h;
 el('navLearn').click(); el('navTutor').click();
 // Exercise the old generator, model observation and tutor recording paths.
 await w.SudokuNavigator.createGame('easy',0);
 if(!h.get('!!playerGrid'))throw Error('Old native fixture generation failed');
 await w.SudokuNavigator.analyze('nudge');
 const C=w.SudokuNavigator.core;
 const q=C.enumerate(w.SudokuNavigator.state(),'P0',new C.Work(200000)).out.find(q=>q.t===0&&q.c>=0);
 if(!q)throw Error('No old native practice move');
 w.selectCell(q.c); w.placeNumber(q.v);
 await w.SudokuNavigator.whenReviewed();
 const noteCell=h.get('playerGrid.flat().findIndex(v=>v===0)');
 w.selectCell(noteCell); w.toggleNotes(); w.placeNumber(6); w.placeNumber(7);
 w.eval('timerSeconds=83');
 w.SudokuMobileSession.pause();
 await until(()=>w.localStorage.getItem(NS+'.session'),'old native saved');
 const stored=h.store();
 // Previous game is the native export snapshot, with its origin recorded.
 const previous=w.SudokuNavigator.export().session;
 stored[NS+'.previousGame']=JSON.stringify(previous);
 await writeFile(new URL('./fixtures/old-native-upgrade.json',import.meta.url),JSON.stringify({
   sourceCommit:'4a6d0bc19dd2ac2de06c89aecaf3748f5d8630c2',
   generatedHtmlSha256:createHash('sha256').update(await readFile(old)).digest('hex'),
   provenance:'Disposable game played in actual old generated native HTML. previousGame uses its exported snapshot. No BD data.',
   limitations:'Old snapshot omitted selectedCell, notesMode and timerRunning. Those unsaved fields cannot be recovered by an upgrade.',
   observedBeforePause:h.get('({selectedCell,notesMode})'),noteCell,stored
 },null,2)+'\n');
 console.log('Old native fixture saved; session schema',JSON.parse(stored[NS+'.session']).schema);
} finally {for(const f of cleanups)await f();}
