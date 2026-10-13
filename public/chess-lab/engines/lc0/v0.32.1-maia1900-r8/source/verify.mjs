// Use with Playwright installed; no external engine service is contacted.
import { writeFile } from 'node:fs/promises';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.argv[2]||'http://127.0.0.1:8732/chess-lab/engines/lc0/v0.32.1-maia1900-r8';
const output=process.argv[3]||'lc0-verification.json';
const {default:bundled}=await import(process.env.CHROMIUM_MODULE || '@sparticuz/chromium');
const browser=await chromium.launch({headless:true,executablePath:await bundled.executablePath(),args:bundled.args}),page=await browser.newPage();
page.on('pageerror',error=>console.error(error.message));
page.on('console',message=>{if(message.type()==='error')console.error(message.text());});
try{
 await page.goto(base+'/evidence/probe.html');
 const result=await page.evaluate(()=>window.runVerification());
 result.verifiedAt=new Date().toISOString();result.url=base;
 await writeFile(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({pass:result.pass,corpus:result.rows.length,failed:result.rows.filter(r=>!r.pass),search:{pass:result.search.pass,visits1s:result.search.timed.nodes,visits2s:result.search.longer.nodes,time1s:result.search.timed.actualSearchMs,time2s:result.search.longer.actualSearchMs,cancelled:result.search.cancelled}}));
 if(!result.pass)process.exitCode=1;
}finally{await browser.close();}
