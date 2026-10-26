// Private documents stay inside the encrypted envelope and are removed on lock.
// Only bounded PNG data URLs are allowed; active documents/SVG remain excluded.
export function sanitizePrivateHTML(value, Parser = DOMParser) {
 const doc=new Parser().parseFromString(value,'text/html');
 doc.querySelectorAll('script,style,iframe,object,embed,base,meta,link,form,svg,math,template').forEach(x=>x.remove());
 for(const el of doc.querySelectorAll('*'))for(const attr of [...el.attributes]){
  if(attr.name.startsWith('on')||['srcdoc','formaction','style'].includes(attr.name)){el.removeAttribute(attr.name);continue;}
  if(['href','src'].includes(attr.name)){
   if(attr.name==='src'&&el.tagName==='IMG'&&attr.value.length<=2*1024*1024&&/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(attr.value))continue;
   try{const u=new URL(attr.value,location.href);if(!['https:','http:'].includes(u.protocol)||u.protocol==='http:'&&!['localhost','127.0.0.1'].includes(u.hostname))el.removeAttribute(attr.name);}catch{el.removeAttribute(attr.name);}
  }
 }
 return doc.body.innerHTML;
}
