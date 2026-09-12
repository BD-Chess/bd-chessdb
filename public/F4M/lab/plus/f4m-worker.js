'use strict';
importScripts('f4m-core.js','f4m-search.js','f4m-classical.js','f4m-dcc.js','f4m-sim.js');
self.onmessage=({data})=>{
 const {id,state,options,dcc}=data;
 try{const answer=F4MSim.decide(state,options,dcc,p=>self.postMessage({id,type:'progress',report:p}));self.postMessage({id,type:'result',answer});}
 catch(error){self.postMessage({id,type:'error',error:String(error.message||error)});}
};
