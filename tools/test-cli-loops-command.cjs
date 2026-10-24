"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../public/AI8'),spec=JSON.parse(fs.readFileSync(path.join(root,'cli-loops-command-spec.json'))),{build}=require(path.join(root,'cli-loops-command.js'));
const basic={host:'HOME',mode:'',collaboration:'',depth:'',limit:'',topic:'Preverita trditev: A < B; ohranita celoten brief.',build:false,calls:'160',tokens:''};
let r=build(spec,basic);assert.equal(r.errors.length,0);assert.equal(r.seats,2);assert.equal(r.command,'LOOP HOME: '+basic.topic);
const commands=[r.command];
for(const mode of ['MIN','MAX','AUTO'])for(const collaboration of ['','S','FullRHP']){
 r=build(spec,{...basic,mode,collaboration,depth:'DEEP',limit:'2h'});assert.equal(r.errors.length,0);assert.equal(r.seats,collaboration==='FullRHP'?6:collaboration==='S'?4:2);assert.equal((r.command.match(/FullRHP/g)||[]).length,collaboration==='FullRHP'?1:0);commands.push(r.command);
}
r=build(spec,{...basic,build:true,buildProject:'LISTENER',buildPackage:'release_040',activate:true,calls:'40',tokens:'200000'});assert.equal(r.errors.length,0);assert.match(r.command,/B PROJECT=LISTENER PACKAGE=release_040 ACTIVATE CALLS=40 TOKENS=200000/);commands.push(r.command);
for(const v of [{topic:''},{limit:'custom',customLimit:'101',customUnit:''},{limit:'13h'},{build:true,buildProject:''},{build:true,buildProject:'WEB',buildPackage:'x',activate:true},{tokens:'-1'},{calls:'401'}])assert.ok(build(spec,{...basic,...v}).errors.length);
assert.equal(build(spec,{...basic,topic:'<script>alert(1)</script>'}).command,'LOOP HOME: <script>alert(1)</script>');
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(commands));
process.stdout.write('PASS: defaults, 9 profile/topology combinations, explicit build effects, bounds, exact topic preservation.\n');

for(const mode of ['AUTO','MAX'])assert.equal(build(spec,{...basic,host:'WORK',mode}).errors.length,0);
assert.ok(build(spec,{...basic,host:'WORK',mode:'MIN'}).errors.some(x=>x.includes('MIN')));
assert.equal(build(spec,{...basic,host:'HOME',mode:'MIN'}).errors.length,0);
const html=fs.readFileSync(path.join(root,'cli-loops.html'),'utf8');
assert.match(html,/<option value="WORK">WORK<\/option>/);
assert.doesNotMatch(html,/<option value="WORK" disabled/);
process.stdout.write('PASS: WORK enabled, AUTO/MAX accepted, MIN rejected, HOME MIN preserved.\n');
