'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../public/S/new/presentation/bootstrap.js');
class Store{constructor(o={}){this.m=new Map(Object.entries(o));}get length(){return this.m.size}key(i){return[...this.m.keys()][i]??null}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
test('canonical LAB state wins conflicts and legacy bytes are never deleted',()=>{
 const s=new Store({'ai8SudokuNavigatorV020.library':'LAB','ai8SudokuAppV030.library':'APP','ai8SudokuAppV030.trace':'TRACE','ai8SudokuNavigatorV020PWA.stats':'PWA','8zSudoku.app.ui.coach':'always'}),r=M.migrate(s);
 assert.equal(s.getItem('ai8SudokuNavigatorV020.library'),'LAB');assert.equal(s.getItem('ai8SudokuAppV030.library'),'APP');assert.equal(s.getItem('ai8SudokuNavigatorV020.trace'),'TRACE');assert.equal(s.getItem('ai8SudokuNavigatorV020.stats'),'PWA');assert.equal(s.getItem('8zSudoku.ui.coach'),'always');assert.equal(r.conflicts.length,1);assert.ok(s.getItem(M.MARKER));
});
test('APP has deterministic priority over legacy PWA when canonical slot is empty',()=>{
 const s=new Store({'ai8SudokuAppV030.library':'APP','ai8SudokuNavigatorV020PWA.library':'PWA'}),r=M.migrate(s);
 assert.equal(s.getItem('ai8SudokuNavigatorV020.library'),'APP');assert.equal(r.conflicts.length,1);assert.equal(s.getItem('ai8SudokuNavigatorV020PWA.library'),'PWA');
});
test('legacy export contains only old APP/PWA namespaces',()=>{
 const s=new Store({'ai8SudokuAppV030.x':'1','ai8SudokuNavigatorV020PWA.y':'2','ai8SudokuNavigatorV020.z':'3','unrelated':'4'}),e=M.legacySnapshot(s);
 assert.deepEqual(Object.keys(e.items).sort(),['ai8SudokuAppV030.x','ai8SudokuNavigatorV020PWA.y']);
});
