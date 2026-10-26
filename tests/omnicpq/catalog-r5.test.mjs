import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogExtracts, resolveCatalogQuery,categoryQuestion } from '../../functions/lib/omnicpq/catalog.mjs';
// Entirely synthetic public fixture. Real workbook assertions run privately.
const shard='references/plm/B2B_01.json';
const offers=[{code:'SYNTH.RACK',name:'Synthetic rack',shard},{code:'SYNTH.FREE',name:'Synthetic free capacity',shard}];
const files={
  'references/PLM_B2B_INDEX.json':JSON.stringify({date:'2026-01-01',offers_count:2,offers}),
  [shard]:JSON.stringify({source:'SYNTHETIC_FIXTURE.xlsx',sheet:'Synthetic',snapshot:'2026-01-01',columns:['KODA_PONUDBE','ZNESEK','ENOTA_MERE'],rows:[
    {row:2,values:['SYNTH.RACK','12,3400','month']},{row:3,values:['SYNTH.RACK','56,7800','piece']},
    {row:4,values:['SYNTH.FREE',null,'month']},{row:5,values:['SYNTH.FREE','0,0000','month']}]})
};
test('exact code returns all alternative price rows and source locators',()=>{
  const r=catalogExtracts(files,'Cena SYNTH.RACK?');assert.equal(r.length,1);const d=JSON.parse(r[0].text);
  assert.equal(d.source,'SYNTHETIC_FIXTURE.xlsx');assert.deepEqual(d.rows.map(r=>r.row),[2,3]);
  assert.deepEqual(d.rows.map(r=>r.values[1]),['12,3400','56,7800']);assert(d.exactCodeMatch);
});
test('source null, zero and billing units remain distinct',()=>{
  const d=JSON.parse(catalogExtracts(files,'SYNTH.FREE')[0].text);
  assert.equal(d.rows[0].values[1],null);assert.equal(d.rows[1].values[1],'0,0000');
  assert.equal(d.rows[0].values[2],'month');
});
test('lookup cannot turn an absent code or substring into a match',()=>{
  assert.equal(catalogExtracts(files,'xSYNTH.RACKy').length,0);
  assert.equal(catalogExtracts(files,'Šifra ZX.NONEXISTENT_991',{requested:true})[0].kind,'catalog_lookup_no_match');
});
test('name results are marked candidates and bounded',()=>{
  const r=catalogExtracts(files,'Synthetic',{requested:true});assert.equal(r.length,2);
  assert(r.every(x=>JSON.parse(x.text).candidateOnly));
});
test('sentence punctuation does not erase internal identifier dots or match an extended code',()=>{
  for(const suffix of ['.','...','?','!',',',');','.”'])assert.deepEqual(JSON.parse(catalogExtracts(files,'Poišči šifro SYNTH.RACK'+suffix)[0].text).rows.map(r=>r.row),[2,3]);
  for(const text of ['xSYNTH.RACK','SYNTH.RACK.X','SYNTH.RACK-2','SYNTH.RACK_2'])assert.equal(catalogExtracts(files,text).length,0);
});
test('elliptical price followup carries one exact prior identifier; new, ambiguous or unknown current context wins',()=>{
  const options={allowCarry:true,previous:'Poišči SYNTH.RACK.'};
  assert.match(resolveCatalogQuery(files,'Kaj pa cena?',options),/SYNTH\.RACK/);
  assert.match(resolveCatalogQuery(files,'Kaj pa cena?',{...options,context:'SYNTH.FREE'}),/SYNTH\.FREE/);
  for(const change of [{allowCarry:false},{context:'SYNTH.UNKNOWN'},{context:'SYNTH.RACK in SYNTH.FREE'},{previous:'SYNTH.RACK in SYNTH.FREE'}])
    assert.equal(resolveCatalogQuery(files,'Kaj pa cena?',{...options,...change}),'Kaj pa cena?');
  assert.equal(resolveCatalogQuery(files,'Kaj pa cena SYNTH.UNKNOWN?',options),'Kaj pa cena SYNTH.UNKNOWN?');
});
test('category lookup ranks A4 hierarchy without a code or PLM keyword and keeps identities separate',()=>{
  const f=structuredClone(files),i=JSON.parse(f['references/PLM_B2B_INDEX.json']);i.offers[0].a4_path='Synthetic DC|Najem virtualnega strežnika|';i.offers[0].copa_path='Unrelated accounting category';
  f['references/PLM_B2B_INDEX.json']=JSON.stringify(i);
  for(const question of ['Najem virtualnega strežnika','Kje je virtualka v drevesu?']){
    assert(categoryQuestion(question)||question.includes('virtualka'));
    const results=catalogExtracts(f,question,{requested:true}),d=JSON.parse(results[0].text);assert.equal(d.offer.code,'SYNTH.RACK');assert(d.candidateOnly);assert.equal(d.offer.a4_path,'Synthetic DC|Najem virtualnega strežnika|');assert.equal(d.offer.copa_path,'Unrelated accounting category');
  }
  assert.equal(catalogExtracts(f,'Neobstoječa kategorija ZXUNIQUE',{requested:true})[0].kind,'catalog_lookup_no_match');
});

