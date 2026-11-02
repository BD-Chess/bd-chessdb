import test from 'node:test';
import assert from 'node:assert/strict';
import {compactCompleteJsonAsciiWhitespace as compact} from '../../functions/lib/omnicpq/json-context.mjs';
function oracle(text){let out='',inside=false,escaped=false;for(const c of text){if(inside){out+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inside=false;}else if(c==='"'){inside=true;out+=c;}else if(!' \t\r\n'.includes(c))out+=c;}return out;}
let seed=0x6c737272;function rnd(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
const samples=['č ž š','\\"slash / \\','\t\r\n','😀','𝄞','</source>','presledek  v  nizu','\u2028\u2029','quote " and \\ escape',''];
function value(depth){const type=depth>3?rnd(4):rnd(6);if(type===0)return null;if(type===1)return !!rnd(2);if(type===2)return (rnd(100000)-50000)/10;if(type===3)return samples[rnd(samples.length)];if(type===4)return Array.from({length:rnd(5)},()=>value(depth+1));const o={};for(let i=0,n=rnd(5);i<n;i++)o['key_'+i+'_'+samples[rnd(samples.length)]]=value(depth+1);return o;}
test('INDEPENDENT_JSON_DIFFERENTIAL deterministic valid samples',()=>{
 for(let i=0;i<500;i++){const raw=JSON.stringify(value(0),null,2).replace(/\n/g,'\r\n'),r=compact(raw),expected=oracle(raw);JSON.parse(raw);JSON.parse(r.text);assert.equal(r.text,expected,'case '+i);assert.equal(r.removedCodeUnits,raw.length-expected.length);assert.equal(r.changed,raw!==expected);const again=compact(r.text);assert.equal(again.text,r.text);assert.equal(again.changed,false);}
 console.log('SYNTHETIC_JSON_DIFFERENTIAL',JSON.stringify({validGenerated:500,seed:'6c737272',scope:'offline'}));
});
test('INDEPENDENT_JSON_DIFFERENTIAL token and duplicate key cases',()=>{
 const cases=[' { "k" : 1 , "k" : 2 } ',' [ -0,1e+300,1E-300,12345678901234567890,0.0000100 ] ',' { "esc" : "\\uD800\\uDC00 \\/ \\n \\u003C", "raw":"č😀" } ',' [ true, false, null, "\\\\\\\"" ] '];
 for(const raw of cases){JSON.parse(raw);const r=compact(raw);assert.equal(r.text,oracle(raw));assert.equal(r.removedCodeUnits,raw.length-r.text.length);}
 console.log('SYNTHETIC_JSON_DIFFERENTIAL',JSON.stringify({lexicalCases:cases.length,scope:'offline'}));
});
test('INDEPENDENT_JSON_DIFFERENTIAL invalid input remains untouched',()=>{
 const cases=['',' ','01','+1','[1,]','{"x":}','{"x":1,}','{"x":"bad\\q"}','"unfinished','true false','NaN','null\u00a0','/*x*/{}','{"x":"line\nraw"}'];
 for(const raw of cases){assert.throws(()=>JSON.parse(raw));const r=compact(raw);assert.equal(r.text,raw);assert.equal(r.changed,false);assert.equal(r.status,'UNCHANGED_INVALID');}
 console.log('SYNTHETIC_JSON_DIFFERENTIAL',JSON.stringify({invalidCases:cases.length,scope:'offline'}));
});
test('INDEPENDENT_JSON_DIFFERENTIAL resource depth and type remain untouched',()=>{
 const deep='['.repeat(257)+'0'+']'.repeat(257),r=compact(deep);assert.equal(r.text,deep);assert.equal(r.status,'UNCHANGED_RESOURCE');const obj={x:1},q=compact(obj);assert.equal(q.text,obj);assert.equal(q.status,'UNCHANGED_TYPE');
});
