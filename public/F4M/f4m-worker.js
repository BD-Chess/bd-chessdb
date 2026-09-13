'use strict';
importScripts('f4m-core.js?v=2.1.1','f4m-search.js?v=2.1.1','f4m-smart-time.js?v=1','f4m-classical.js?v=2.1.1','f4m-dcc.js?v=2.1.1','f4m-sim.js?v=2.1.1');
self.onmessage=({data})=>{
 const {id,state,options,dcc}=data;
 try{const answer=F4MSim.decide(state,options,dcc,p=>self.postMessage({id,type:'progress',report:p}));self.postMessage({id,type:'result',answer});}
 catch(error){self.postMessage({id,type:'error',error:String(error.message||error)});}
};
