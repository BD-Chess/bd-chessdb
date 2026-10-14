const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('active PWA never precaches or intercepts optional heavy engine downloads',()=>{
 const release=JSON.parse(fs.readFileSync(path.join(__dirname,'../release.json')));
 assert(!Object.keys(release.assets_sha256).some(p=>/vendor\/(berserk|stockfish-full)/.test(p)));
 const handlers=new Map();
 const self={location:{href:'https://test/chess-lab/sw.js'},addEventListener(e,fn){handlers.set(e,fn);}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),{self,URL,Set,Map,Request,caches:{},fetch:()=>{throw Error('Unexpected fetch');}});
 let responded=false;
 handlers.get('fetch')({request:{method:'GET',url:'https://test/chess-lab/vendor/stockfish-full/v19.0.1/stockfish-19.wasm'},respondWith(){responded=true;}});
 assert.equal(responded,false,'heavy file uses ordinary lazy browser fetch');
});
