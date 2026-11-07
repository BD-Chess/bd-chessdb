'use strict';
// Unmodified, pinned LAB tests run against GENERATED native HTML + bridge.
// OS plugin calls and layout rectangles remain synthetic (not WKWebView evidence).
const base=require('../support/native-harness.cjs');
// Match the upstream JSDOM default when a test does not request a viewport.
// Phone UX/gesture tests pass their own dimensions; do not silently redirect
// desktop engine tests through mobile confirmation dialogs.
module.exports={...base,async boot(t,stored,viewport={width:1024,height:768}){
 const exported=[];
 const h=await base.boot(t,stored,viewport,{native:true,nativePromise:async(plugin,method,args)=>{
  if(method==='writeFile'){
   // Preserve each export's filename/payload assertions through the native route.
   exported.push({name:args.path.replace(/^export-\d+-\d+-/,''),text:args.data});
   return{uri:'file:///cache/'+args.path};
  }
  if(method==='readdir')return{files:[]};return{};
 }});
 h.downloads=exported;return h;
}};
