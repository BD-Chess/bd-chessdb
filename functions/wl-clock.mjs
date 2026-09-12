import { getStore } from '@netlify/blobs';
export default async()=>{
 const s=getStore({name:'wl-runtime-control-v2',consistency:'strong'});
 const control=await s.get('control',{type:'json'});
 if(control?.paused)return;
 await s.setJSON('pulse',{at:new Date().toISOString(),source:'netlify_clock',wake_claimed:false});
};
export const config={schedule:'*/5 * * * *'};
