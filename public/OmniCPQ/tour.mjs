// Rendering must return a visible acknowledgement before captions or speech advance.
export const SCENES=Object.freeze([
  {id:'intro',title:'Od poslovne potrebe do dokaza',mode:'guide',kind:'PRIMER',text:'Sem AI pomočnik za B2B storitve in IT sisteme v TS. Skozi primer nove poslovalnice povežem razumevanje storitve, zahteve, model, OmniCPQ in E2E preverjanje. Tvoj pogovor in odprto CPQ delo ostaneta ohranjena.'},
  {id:'guide',title:'Vodič · kaj poslovalnica potrebuje?',mode:'guide',service:'vpi',kind:'PRIMER',text:'Vodič prikaže preverjeno kartico VPI, ilustracijo in vire. Internetni dostop, zasebno povezovanje lokacij in upravljanje omrežja imajo različne vloge. Za konkretno lokacijo razpoložljivost in pogodbeni pogoji zahtevajo potrditev.'},
  {id:'requirements',title:'Zahteve · razjasnimo poslovni cilj',mode:'jira',kind:'PRIMER',text:'Osnutek poveže lokacijo, aplikacije, želeni datum in zanesljivost. Zabeležimo že sprejete odločitve in odprta vprašanja: ali je optika dosegljiva, kakšen izpad poslovanje prenese in kdo potrdi zahtevo? Osnutek ni oddana Jira.'},
  {id:'modeling',title:'Modeliranje · zahteva postane pravilo',mode:'model',kind:'PRIMER',text:'Predlog modela poveže storitev, dostop, opremo, opcije in odvisnosti. Števnosti, cene in izključitve potrebujejo isti potrjeni vir. Ta prikaz je učni predlog; spletni ali Java PLM s tem še ni spremenjen.'},
  {id:'cpq',title:'OmniCPQ · pravi dokument in postavka',mode:'work',kind:'PRIMER',text:'Pomočnik ostane levo in CPQ desno. Za izvedbo so poleg prijave potrebni dovoljena Bridge povezava, sveže opazovanje in tvoj nalog. V tej predstavitvi CPQ ne spreminjam. Pravi STAGE učinek in shranitev se preverita ločeno.'},
  {id:'testing',title:'Testiranje · E2E s sledjo do vira',mode:'plm',kind:'PRIMER',text:'Test poveže zahtevo, pravilo, vhod, pričakovani rezultat in dokaz. Vključuje PLM, CPQ, shranitev in dosegljive nadaljnje sisteme. Prikazani primer je NOT_RUN; nedosegljiv OMS ali obračun ne postane PASS.'},
  {id:'finish',title:'Nadaljujva pri tvojem delu',mode:'guide',kind:'PRIMER',text:'Izberi način, odpri drugo storitev ali vprašaj. Isti pogovor in kontekst ostaneta. Predstavitev lahko ustaviš, ponoviš ali nadaljuješ po svojem tempu; nobeno poslovno dejanje ni izvedeno samo zaradi prikaza.'}
]);
export function createTour({show,caption,silence=()=>{},changed=()=>{}}){
  let index=0,status='idle',generation=0,lastVisible=null;
  const report=()=>changed({index,status,lastVisible,total:SCENES.length});
  async function display(next=index){
    const ticket=++generation;silence();index=Math.max(0,Math.min(SCENES.length-1,next));status='opening';report();
    try{
      const scene=SCENES[index],ack=await show(scene);
      if(ticket!==generation)return false;
      if(!ack||ack.scene!==scene.id||ack.visible!==true)throw Error('SCENE_NOT_VISIBLE');
      lastVisible=scene.id;status='playing';caption(scene);report();return true;
    }catch(error){if(ticket===generation){status='paused';report();}return false;}
  }
  function pause(){++generation;silence();if(status!=='idle'&&status!=='stopped')status='paused';report();}
  return {start:()=>display(0),next:()=>display(index+1),back:()=>display(index-1),repeat:()=>display(index),resume:()=>display(index),pause,
    question:pause,stop(){++generation;silence();status='stopped';report();},get state(){return {index,status,lastVisible,total:SCENES.length};}};
}
