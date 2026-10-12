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
    let index=0,reader=null;
    const stream=new ReadableStream({
      async pull(controller){
        try{
          while(index<parts[name].length){
            if(!reader){
              const response=await original(new URL(parts[name][index],base).href,options);
              if(!response.ok)throw new Error('SF Full part download failed: HTTP '+response.status);
              reader=response.body.getReader();
            }
            const chunk=await reader.read();
            if(chunk.done){reader.releaseLock();reader=null;index++;continue;}
            controller.enqueue(chunk.value);return;
          }
          controller.close();
        }catch(error){controller.error(error);}
      },
      cancel(reason){return reader?.cancel(reason);}
    });
    return new Response(stream,{headers:{'Content-Type':'application/wasm'}});
  };
})();
