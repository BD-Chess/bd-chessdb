import {getStore} from '@netlify/blobs';
import {createService} from './lib/dualframe/service.mjs';
export default async req=>{let payload;try{payload=await req.json();}catch{return;}await createService({store:getStore({name:'dualframe-rd-v3',consistency:'strong'}),env:key=>Netlify.env.get(key)}).work(payload);};
export const config={background:true};
