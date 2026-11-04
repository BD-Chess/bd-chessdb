import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {runInNewContext} from 'node:vm';
import {upperBound,pathForDisplay,sampleAt,lineEnvelope,candlesForWindow,decodeVerified,loadVerified} from '../public/BD/q1s-video-arena/replay-core.mjs';

test('slash-insensitive hosting never self-redirects; no-slash document normalizes before relative assets',async()=>{
  const html=await readFile(new URL('../public/BD/q1s-video-arena/index.html',import.meta.url),'utf8');
  const redirects=await readFile(new URL('../public/_redirects',import.meta.url),'utf8');
  const rules=redirects.split('\n').filter(l=>/^\/bd\/trading\/1s-arena/.test(l));
  assert.ok(rules.length>=2);assert.ok(rules.every(l=>!(/\s30[1278](?:\s|$)/.test(l))));
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.ok(html.indexOf('<script>')<html.indexOf('rel="stylesheet"'));
  for(const pathname of ['/bd/trading/1s-arena','/bd/trading/1s-arena/','/BD/q1s-video-arena/']){
    const calls=[];runInNewContext(script,{location:{pathname,search:'?trial=T063',hash:'#history'},history:{replaceState:(...args)=>calls.push(args)}});
    if(pathname==='/bd/trading/1s-arena')assert.equal(calls[0][2],'/bd/trading/1s-arena/?trial=T063#history');
    else assert.equal(calls.length,0);
  }
});

test('as-of lookup preserves zero start and the last same-time recorded state',()=>{
  const p=pathForDisplay({rows:[[1,'100','100','100',1,1],[2,'101','100','101',0,1],[2,'102','99','103',0,1],[3,'98','98','98',1,1]]});
  assert.equal(sampleAt(p,0).wallet,100);assert.equal(sampleAt(p,0).index,-1);
  assert.equal(sampleAt(p,1.999).net,100);assert.equal(sampleAt(p,2).net,102);
  assert.equal(upperBound([[2],[2],[3]],2),2);
  assert.ok(Math.abs(sampleAt(p,3).dd-4/102)<1e-12);
});

test('candles never include a future completed bar; aggregation retains true OHLC',()=>{
  const rows=[[1,10,13,9,11,2],[2,11,12,8,9,3],[3,9,15,9,14,4]];
  assert.equal(candlesForWindow(rows,0,60).bars.length,0);
  assert.equal(candlesForWindow(rows,1.99,60).bars[0].close,11);
  const b=candlesForWindow(rows,2,60,1).bars[0];
  assert.deepEqual([b.open,b.high,b.low,b.close,b.trades],[10,13,8,9,5]);
});

test('display envelope retains extrema in original time order',()=>{
  assert.deepEqual(lineEnvelope([1,2,3,4],[100,200,5,150],4,1),[[1,100],[2,200],[3,5],[4,150]]);
});

test('gzip and transparently decoded responses require exact hashes; altered bytes fail',async()=>{
  const raw=Buffer.from('{"rows":[[1,"100"]]}'),packed=gzipSync(raw,{mtime:0});
  const hash=b=>createHash('sha256').update(b).digest('hex');
  const a={file:'sample.json.gz',bytes:packed.length,sha256:hash(packed),decoded_bytes:raw.length,decoded_sha256:hash(raw)};
  assert.deepEqual(await decodeVerified(packed,a),{rows:[[1,'100']]});
  assert.deepEqual(await decodeVerified(raw,a),{rows:[[1,'100']]});
  const bad=Buffer.from(packed);bad[bad.length-1]^=1;
  await assert.rejects(()=>decodeVerified(bad,a),/integrity/);
  await assert.rejects(()=>loadVerified(new URL('https://example.invalid/'),{...a,file:'../private.json.gz'}),/descriptor/);
});

test('published index defaults to zero-fee B/C0, keeps exact outcome and every asset pin',async()=>{
  const base=new URL('../public/BD/q1s-video-arena/',import.meta.url);
  const meta=JSON.parse(await readFile(new URL('replay-index.r1.json',base)));
  assert.equal(meta.mode,'HISTORICAL_READ_ONLY');assert.equal(meta.trials.length,9);
  assert.equal(new Set(meta.trials.map(x=>x.trial_id)).size,9);
  const selected=meta.trials.find(x=>x.trial_id===meta.default_trial);
  assert.equal(selected.scenario,'C0');assert.equal(meta.costs.C0.fee_bps,0);
  assert.equal(selected.first_equity_plus50_percent.sampled_seconds,'607');
  assert.equal(selected.first_flat_wallet_plus50_percent.sampled_seconds,'18996');
  assert.equal(Number(selected.terminal_net_equity_USDT),303.3048260006);
  assert.equal(selected.test_feasible,false);
  for(const asset of [meta.market,...meta.trials.flatMap(x=>[x.path,x.fills])]){
    const b=await readFile(new URL('data/'+asset.file,base));
    assert.equal(b.length,asset.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),asset.sha256);
  }
  const html=await readFile(new URL('index.html',base),'utf8');
  assert.ok(html.includes('C0 · 0 fee vstop / 0 fee izstop'));
  const start=await readFile(new URL('../public/Start/index.html',import.meta.url),'utf8');
  assert.equal((start.match(/id="bs-q1s-arena-link"/g)||[]).length,1);
  assert.ok(start.includes('https://www.mdlxdcc.org/bd/trading/1s-arena/'));
});
