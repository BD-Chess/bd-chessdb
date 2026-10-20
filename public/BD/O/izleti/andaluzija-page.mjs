// Read-only page navigation. Targets are compiled here, never supplied as selectors or JS.
export const pageSections=Object.freeze({
 vrh:{id:'naslov',label:'Na vrh'},nacrti:{id:'nacrti',label:'Načrti'},
 zemljevid:{id:'zemljevid',label:'Zemljevid'},primerjava:{id:'primerjava',label:'Primerjava'},
 dnevi:{id:'dnevi',label:'Po dnevih'},'najini-ogledi':{id:'najini-ogledi',label:'Najini ogledi'},
 vodic:{id:'vodic',label:'Vodič'},prakticno:{id:'prakticno',label:'Praktično'},
 potrjeno:{id:'potrjeno',label:'Rezervirano'},'leti-kritja':{id:'leti-kritja',label:'Leti in kritja'},
 proracun:{id:'proracun',label:'Proračun'},spanje:{id:'spanje',label:'Kje spati'},
 rezervacije:{id:'rezervacije',label:'Rezervacijski seznam'},slike:{id:'slike',label:'Slike'},viri:{id:'viri',label:'Viri'}
});
export function validatePageTarget(args){
 if(!args||Object.keys(args).sort().join()!=='day,section'||!Object.hasOwn(pageSections,args.section)||
   !(args.day===null||args.section==='dnevi'&&Number.isInteger(args.day)&&args.day>=1&&args.day<=10))throw Error('INVALID_PAGE_TARGET');
 return args;
}
// Common explicit navigation requests need no paid model call. Ambiguity goes to the AI.
export function pageRequest(message){
 const s=message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 if(s.length>180||!/^(?:prosim\s+)?(?:pokazi|prikazi|premakni|pomakni|skoci|pojdi|odpri|scroll|show|go to)\b/.test(s)||/\b(ne|nikar|google|maps|dodaj|shrani|izbrisi|odstrani|in potem|and then)\b|https?:|[<>`]/.test(s))return null;
 const aliases={vrh:/\b(vrh|zacetek strani|top)\b/,nacrti:/\b(nacrti|nacrte|razlicice)\b/,zemljevid:/\b(zemljevid(?:a|u|om)?|map)\b/,primerjava:/\b(primerjav[ao]|primerjave)\b/,dnevi:/\b(dnevi|dnevih|dnevni vodic|dan)\b/,'najini-ogledi':/\b(najini ogledi|najine oglede|tripopti)\b/,vodic:/\b(vodic|zgodbe|zgodb)\b/,prakticno:/\b(prakticno|prakticne nasvete)\b/,potrjeno:/\b(rezervirano|potrjeno)\b/,'leti-kritja':/\b(leti|lete|kritja|metal)\b/,proracun:/\b(proracun)\b/,spanje:/\b(spanje|kje spati)\b/,rezervacije:/\b(rezervacije|rezervacij)\b/,slike:/\b(slike|galerijo|galerija)\b/,viri:/\b(viri|vire)\b/};
 const matches=Object.entries(aliases).filter(([id,re])=>re.test(s)&&!(id==='vodic'&&/dnevni vodic/.test(s)));
 if(matches.length!==1)return null;const section=matches[0][0];
 const d=s.match(/\b(?:dan\s+(\d{1,2})|(\d{1,2})\.?\s*dan)\b/),day=d?Number(d[1]||d[2]):null;
 if(/\d/.test(s)&&!d||day!==null&&(section!=='dnevi'||day<1||day>10))return null;
 return {section,day};
}
export async function showPageSection(args,{before=()=>{},alive=()=>{},signal}={}){
 validatePageTarget(args);alive();if(signal?.aborted)throw Error('LOCKED');
 const definition=pageSections[args.section],target=document.getElementById(args.day?'dan-'+args.day:definition.id);
 if(!target||!target.getClientRects().length)throw Error('NAVIGATION_UNAVAILABLE');
 before();await new Promise(requestAnimationFrame);alive();
 const offset=Math.max(0,...['.topbar','.jump-nav'].map(s=>document.querySelector(s)?.getBoundingClientRect().bottom||0))+18;
 window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-offset),behavior:'instant'});
 await new Promise(requestAnimationFrame);alive();if(signal?.aborted)throw Error('LOCKED');
 const rect=target.getBoundingClientRect();if(rect.bottom<=offset||rect.top>=innerHeight-40)throw Error('NAVIGATION_UNAVAILABLE');
 target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
 // Only UI metadata is returned; no DOM text, personal dates, prices or reservations.
 return {section:args.section,day:args.day,locked:target.classList.contains('private-placeholder')};
}
