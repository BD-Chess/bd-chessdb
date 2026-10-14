/* GPL-3.0. Same-origin streaming transport; engine code and assembled WASM are unchanged.
 * Splitting keeps source publication within the transfer size limit. No preload/prefetch. */
(function(){
  'use strict';
  const original=self.fetch.bind(self),base=new URL('./',self.location.href);
  const parts={"stockfish-19-single.wasm": ["stockfish-19-single.part1.wasm", "stockfish-19-single.part2.wasm", "stockfish-19-single.part3.wasm", "stockfish-19-single.part4.wasm", "stockfish-19-single.part5.wasm", "stockfish-19-single.part6.wasm", "stockfish-19-single.part7.wasm", "stockfish-19-single.part8.wasm", "stockfish-19-single.part9.wasm", "stockfish-19-single.part10.wasm"], "stockfish-19.wasm": ["stockfish-19.part1.wasm", "stockfish-19.part2.wasm", "stockfish-19.part3.wasm", "stockfish-19.part4.wasm", "stockfish-19.part5.wasm", "stockfish-19.part6.wasm", "stockfish-19.part7.wasm", "stockfish-19.part8.wasm", "stockfish-19.part9.wasm", "stockfish-19.part10.wasm"]};
  self.fetch=async function(input,options){
    const url=new URL(typeof input==='string'?input:input.url||String(input),base);
    const name=url.pathname.slice(base.pathname.length);
    if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||!parts[name])return original(input,options);
    let index=0,reader=null,loaded=0,partURL=null;
    // Report transport evidence only from the single-thread root UCI worker.
    // Network/cache is classified by ResourceTiming, never by a CDN HIT header.
    const report=phase=>{if(self.location.pathname.endsWith('-single.js'))self.postMessage({type:'chessbest-engine-progress',phase,loaded});};
    const stream=new ReadableStream({
      async pull(controller){
        try{
          while(index<parts[name].length){
            if(!reader){
              partURL=new URL(parts[name][index],base).href;
              const response=await original(partURL,options);
              if(!response.ok)throw new Error('SF Full part download failed: HTTP '+response.status);
              reader=response.body.getReader();
            }
            const chunk=await reader.read();
            if(chunk.done){
              const timing=self.performance?.getEntriesByName?.(partURL)?.slice(-1)[0];
              report(timing?.transferSize>0&&timing.transferSize>=(timing.encodedBodySize||0)?'downloading':timing?.decodedBodySize>0?'preparing':'loading');
              reader.releaseLock();reader=null;index++;continue;
            }
            loaded+=chunk.value.byteLength;controller.enqueue(chunk.value);return;
          }
          controller.close();
        }catch(error){controller.error(error);}
      },
      cancel(reason){return reader?.cancel(reason);}
    });
    return new Response(stream,{headers:{'Content-Type':'application/wasm'}});
  };
})();
