/* Local secure input only. No password in argv, env, source, receipt or logs. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {Writable} from 'node:stream';
import {createHash} from 'node:crypto';
import '../public/BD/O/izleti/andaluzija-shield-core.js';
const [input,output]=process.argv.slice(2);
if(!input||!output||!process.stdin.isTTY){console.error('Usage in an interactive terminal: node scripts/wrap-andaluzija-private.mjs PRIVATE_INPUT OUTPUT.8zs.json');process.exit(2);}
const value=JSON.parse(await readFile(input,'utf8'));
if(value.schema!=='andaluzija-private-content-v1'||value.tripId!=='andaluzija-2027'||value.kind!=='sections')throw Error('INVALID_PRIVATE_INPUT');
const hidden=new Writable({write(_chunk,_encoding,done){done();}}),rl=createInterface({input:process.stdin,output:hidden,terminal:true});
process.stderr.write('Existing owner passphrase (hidden): ');
let password=await new Promise(resolve=>rl.question('',resolve));rl.close();process.stderr.write('\n');
try{
 const envelope=await globalThis.ShieldCore.seal(value,[password],{domain:'www.mdlxdcc.org'});
 const bytes=JSON.stringify(envelope)+'\n';await writeFile(output,bytes,{mode:0o600});
 console.log(JSON.stringify({status:'WRAPPED_AND_ROUNDTRIP_VERIFIED',format:'8ZShield-v4',bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')}));
}finally{password=null;}
