import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=new URL('../public/Trip/new/',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const context={window:{}};
vm.runInNewContext(read('tsp-catalog.js'),context);
vm.runInNewContext(read('tsp-library.js'),context);
vm.runInNewContext(read('trips.js'),context);
const catalog=context.window.TRIP_TSP_CATALOG;
const expected={wi29:[29,1,-1],dj38:[38,1,1],qa194:[194,1,1],uy734:[734,-1,-1],zi929:[929,-1,1],lu980:[980,1,1],rw1621:[1621,-1,1],mu1979:[1979,1,1],nu3496:[3496,1,-1]};

test('complete supplied collection: every original node and signed Maps conversion verified',()=>{
  assert.equal(catalog.length,9);
  assert.equal(catalog.reduce((n,e)=>n+e.count,0),10000);
  assert.equal(readdirSync(new URL('tsp/',root)).filter(n=>n.endsWith('.tsp')).length,9);
  for(const e of catalog) {
    const raw=readFileSync(new URL('tsp/'+e.id+'.tsp',root));
    assert.equal(createHash('sha256').update(raw).digest('hex'),e.originalSha256);
    const [count,latSign,lonSign]=expected[e.id];assert.equal(e.count,count);
    const nodes=raw.toString().split('NODE_COORD_SECTION')[1].trim().split(/\r?\n/).filter(r=>r.trim()&&r.trim()!=='EOF').map(r=>r.trim().split(/\s+/).map(Number));
    const data=JSON.parse(read('tsp/'+e.id+'.json'));assert.equal(data.points.length,count);
    nodes.forEach((p,i)=>{
      assert.equal(data.points[i][0],p[0]);
      assert.ok(Math.abs(data.points[i][1]-latSign*p[1]/1000)<1e-10);
      assert.ok(Math.abs(data.points[i][2]-lonSign*p[2]/1000)<1e-10);
    });
    assert.equal(new Set(data.points.map(p=>p.slice(1).join(','))).size,e.distinctCoordinates);
    const text=context.window.TripTspLibrary.toEditor(e,data);
    assert.equal(text.split('\n').filter(r=>!r.startsWith('#')).length,count);
    assert.match(text,/original EUC_2D units, not kilometres/);
    assert.equal(e.mapsMetric,'great-circle-km');
  }
});

test('TSP adapter rejects truncated, duplicate-ID, and invalid coordinate data',()=>{
  const entry=catalog[0],valid=JSON.parse(read('tsp/wi29.json'));
  for(const mutate of [d=>d.points.pop(),d=>d.points[1][0]=d.points[0][0],d=>d.points[0][1]=91,d=>d.id='unknown']) {
    const data=structuredClone(valid);mutate(data);
    assert.throws(()=>context.window.TripTspLibrary.toEditor(entry,data),/unchanged/);
  }
  assert.equal(context.window.TripTspLibrary.get('../../unknown'),undefined);
});

test('library includes every dataset and walking presets carry their intended travel mode',()=>{
  const lib=context.window.TRIP_LIBRARY;
  const collection=lib[0].categories.find(c=>c.name==='🧩 TSP country collection');
  assert.deepEqual(Array.from(collection.items,t=>t.tspPreset),Object.keys(expected));
  const walking=lib.flatMap(r=>r.categories).find(c=>c.name.includes('All 27'));
  assert.equal(walking.items.length,27);assert.equal(walking.mode,'WALKING');
  const ny=lib.flatMap(r=>r.categories).flatMap(c=>c.items).find(t=>t.id==='NY');
  assert.equal(ny.mode,'WALKING');
  assert.match(context.window.TripTspLibrary.label(catalog[0],'sl'),/Zahodna Sahara · 29 točk/);
  assert.match(context.window.TripTspLibrary.label(catalog[0],'en'),/Western Sahara · 29 points/);
});
