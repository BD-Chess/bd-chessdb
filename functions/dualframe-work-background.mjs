import {runtimeService} from './lib/dualframe/runtime.mjs';
export default async req=>{let payload;try{payload=await req.json();}catch{return;}await (await runtimeService()).work(payload);};
export const config={background:true};
