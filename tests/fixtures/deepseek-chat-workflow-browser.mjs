// Optional mobile-layout acceptance. Requires Playwright and a Chromium binary.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { makeMessagesHandler } from '../../functions/deepseek-chat-messages.mjs';
import { createDriveMailbox } from '../../functions/lib/deepseek-chat/drive-mailbox.mjs';
import { cookieName, makeSession } from '../../functions/lib/deepseek-chat/session.mjs';
import { driveFixture, inbox, owner, results } from './deepseek-drive-mailbox.mjs';

const {chromium} = createRequire(import.meta.url)(process.env.R5_PLAYWRIGHT ?? 'playwright');
const fixture = driveFixture({DEEPSEEK_CHAT_WORK_ENABLED:'true'});
const mailbox = createDriveMailbox(fixture);
const secret = 'a'.repeat(43);
const getEnv = key => key === 'DEEPSEEK_CHAT_SESSION_SECRET' ? secret : fixture.getEnv(key);
const source = new URL('../../public/deepseek-chat/',import.meta.url);
const served = new Map(await Promise.all([['','index.html','text/html'],['chat.js','chat.js','text/javascript'],
  ['chat.css','chat.css','text/css']].map(async ([path,name,mime])=>[path,{mime,bytes:await readFile(new URL(name,source))}])));
const received = [];
const handled = new Set();
const proposals = new Map();
const original = 'Oznaka: pred';
let current = original;
const after = 'Oznaka: po';
const sha = text => createHash('sha256').update(text).digest('hex');
const baseSha256 = sha(original);
const diff = '--- README.md\n+++ README.md\n-' + original + '\n+' + after;
const diffSha256 = sha(diff);

function respondToWork() {
  for (const {info,content:job} of fixture.files.values()) {
    if (!info.parents.includes(inbox) || !info.name.endsWith('.json') || handled.has(job.id)) continue;
    handled.add(job.id);
    received.push(job);
    const receipt = {id:job.id,owner,createdAt:job.createdAt};
    const fields = {id:job.id,action:job.operation,project:job.project};
    let result;
    let state = 'complete';
    if (job.operation === 'projects') result = {projects:[{id:'acceptance',label:'Namenski testni projekt'}]};
    if (job.operation === 'plan') result = {...fields,status:'planned',plan:'Spremeni oznako v README.md:2.'};
    if (job.operation === 'review') result = {...fields,status:'reviewed',review:'RHP: preveri README.md:2.'};
    if (job.operation === 'build') {
      const proposalId = job.id;
      proposals.set(proposalId,true);
      result = {...fields,status:'proposed',proposalId,baseSha256,diffSha256,diff};
    }
    if (job.operation === 'reject' || job.operation === 'approve') {
      assert.equal(job.baseSha256,baseSha256);
      assert.equal(job.diffSha256,diffSha256);
      if (!proposals.delete(job.proposalId)) {
        state = 'failed';
        result = {...fields,status:'failed'};
      } else if (job.operation === 'reject') {
        result = {...fields,status:'rejected'};
      } else {
        current = after;
        result = {...fields,status:'applied',testReport:'README.md:2 · PASS',readbackSha256:sha(current)};
      }
    }
    fixture.add(results,job.id+'.ack.json',{...receipt,schema:'mydeepseekrhp.ack.v1'});
    fixture.add(results,job.id+'.result.json',{...receipt,schema:'mydeepseekrhp.result.v2',state,
      operation:job.operation,result});
  }
}
const server = createServer(async (req,res) => {
  try {
    const path = new URL(req.url,origin).pathname.slice('/deepseek-chat/'.length);
    if (served.has(path)) {
      const {mime,bytes}=served.get(path);
      res.writeHead(200,{'content-type':mime});
      return res.end(bytes);
    }
    if (path === 'api/session') {
      res.writeHead(200,{'content-type':'application/json','set-cookie':
        cookieName+'='+makeSession(owner,secret,Date.now())+'; Path=/; Secure; HttpOnly; SameSite=Strict'});
      return res.end(JSON.stringify({authenticated:true,email:owner}));
    }
    const chunks=[];
    for await (const b of req) chunks.push(b);
    const result = await handler(new Request(origin+req.url,{method:req.method,headers:req.headers,
      ...(chunks.length && {body:Buffer.concat(chunks)})}),{site:{name:'mdlxdcc'}});
    res.writeHead(result.status,Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
    respondToWork();
  } catch (error) { res.writeHead(500); res.end(error.message); }
});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const origin = 'http://127.0.0.1:'+server.address().port;
const handler = makeMessagesHandler({mailbox,getEnv,allowedOrigin:origin});
let browser;
try {
  browser = await chromium.launch({executablePath:process.env.R5_CHROMIUM,headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process']});
  const page=await browser.newPage({viewport:{width:402,height:874},isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const ui=id=>page.locator('#'+id);
  await page.goto(origin+'/deepseek-chat/');
  await ui('operation').selectOption('plan');
  await ui('load-projects').click();
  await ui('project').selectOption('acceptance',{timeout:16000});
  const fill=async (operation,text) => {
    await ui('operation').selectOption(operation);
    await ui('prompt').fill(text);
    await ui('send').click();
  };
  const visible=(text)=>page.getByText(text,{exact:false}).last().waitFor({timeout:16000});
  await fill('plan','Pripravi načrt');
  await visible('README.md:2.');
  await ui('review-rhp').click();
  await visible('RHP: preveri README.md:2.');
  await fill('build','Pripravi popravek');
  await ui('diff').waitFor({timeout:16000});
  assert.match(await ui('diff').innerText(),/Oznaka: po/);
  assert.equal(current,original);
  assert.equal(await ui('approve').isDisabled(),true);
  await ui('reject').click();
  await visible('Predlog je zavrnjen.');
  assert.equal(current,original);
  await fill('build','Pripravi nov popravek');
  await ui('diff').waitFor({timeout:16000});
  await page.reload();
  await ui('diff').waitFor({timeout:16000});
  await ui('check-diff').check();
  await ui('approve').click();
  await visible('SHA-256 ponovnega odčitka');
  assert.equal(current,after);
  assert.match(await ui('transcript').innerText(),new RegExp(sha(current)));
  assert.match(await ui('transcript').innerText(),/README.md:2 · PASS/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),402);
  const ids = received.map(row=>row.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(received.map(row=>row.operation),['projects','plan','review','build','reject','build','approve']);
  assert.notEqual(received[4].proposalId,received[6].proposalId);
  assert.deepEqual(errors,[]);
  console.log('PASS Chromium 402 px · authenticated Function + simulated Drive and WORK · Plan, RHP review controls, diff, reject, reload, approve, test and readback');
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
