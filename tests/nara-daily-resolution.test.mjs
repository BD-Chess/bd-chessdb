import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),n=path.join(root,'public/Nara');
test('retired Daily resolution shim no longer selects 4K sources',()=>{
 const code=fs.readFileSync(path.join(n,'assets/js/nara-daily-resolution.js'),'utf8');
 assert.match(code,/RETIRED/);assert.doesNotMatch(code,/querySelectorAll|dataset\.naraImage4k/);
});
test('Daily readers do not reference absent 4K assets',()=>{
 for(const name of ['Nara-AI-daily.html','Nara-AI-2026-10.html',...['05','06','07'].flatMap(day=>['Nara-AI-2026-10-'+day+'-format-R1.html','Nara-AI-2026-10-'+day+'-pre-format-R1.html'])]){
  const html=fs.readFileSync(path.join(n,name),'utf8');
  assert.doesNotMatch(html,/data-nara-image-4k=|L_4K|P_4K|assets\/img\/daily\/[^"\s]+\/4K\//,name);
  assert.doesNotMatch(html,/nara-daily-resolution\.js\?v=1/,name);
 }
});
test('responsive viewer uses HD-only slots and rolling orientation cache',()=>{
 const js=fs.readFileSync(path.join(n,'assets/js/nara-daily-responsive.js'),'utf8');
 assert.match(js,/const slots=\['L_HD','P_HD'\]/);assert.match(js,/dataset\.resolution='hd'/);assert.doesNotMatch(js,/_4K|o\+'_4K'|resolution='4k'/);
});
