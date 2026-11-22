// Mounted only by the existing unlocked application. No solver starts here.
export const FINLAND = 'santa1437195_uef_2cm';
export const MODES = ['one','restart','stateful'];
export function presetFromHash(hash) {
  return hash === '#finland-stateful-600' ? 600 : hash === '#finland-stateful-300' ? 300 : null;
}
export function modeForCheckbox(mode, enabled) {
  return !enabled ? 'one' : mode === 'stateful' ? 'stateful' : 'restart';
}
export const COPY = {
  en: {label:'Search mode',one:'One pass',restart:'Two passes',stateful:'Two passes with continuation',
    first:'Finland · 600 + 3000 s',control:'Finland · 300 + 3300 s',
    hint:'Choose a setup, then press Run. The time fields remain editable.',
    large:'Continuation is available for large maps.',
    mismatch:'The loaded version does not match this page. Finish any active run before reopening the demo.',
    unsupported:'This setup requires eight compatible workers and the Finland map.'},
  sl: {label:'Način iskanja',one:'En prehod',restart:'Dva prehoda',stateful:'Dva prehoda z nadaljevanjem',
    first:'Finska · 600 + 3000 s',control:'Finska · 300 + 3300 s',
    hint:'Izberi nastavitev in nato pritisni Zaženi. Časovna polja lahko spremeniš.',
    large:'Nadaljevanje je na voljo za velike zemljevide.',
    mismatch:'Naložena različica se ne ujema s stranjo. Pred ponovnim odprtjem dema končaj morebitni aktivni tek.',
    unsupported:'Ta nastavitev potrebuje osem združljivih delavcev in zemljevid Finske.'},
};

export function mountPassChoice({onChange,onPreset}) {
  const d=document, box=d.createElement('div'), label=d.createElement('label'), select=d.createElement('select');
  box.id='passChoice';select.id='passMode';label.htmlFor=select.id;
  const title=d.createElement('span');label.append(title,select);box.append(label);
  for(const mode of MODES){const option=d.createElement('option');option.value=mode;select.append(option);}
  select.value='restart';
  const links=d.createElement('div');links.className='pass-choice-links';box.append(links);
  const first=d.createElement('a'),control=d.createElement('a');
  first.href='#finland-stateful-600';control.href='#finland-stateful-300';links.append(first,control);
  const hint=d.createElement('p');hint.className='hint';box.append(hint);
  const style=d.createElement('style');style.textContent='#passChoice{margin:12px 0}#passChoice label{display:grid;gap:6px}#passChoice select{width:100%;min-width:0;min-height:48px;font-size:16px}.pass-choice-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.pass-choice-links a{display:flex;align-items:center;min-height:48px;padding:4px 10px;box-sizing:border-box}.pass-choice-links a[aria-disabled="true"]{opacity:.5}';box.append(style);
  d.getElementById('twoPassHint').after(box);
  let blocked=true;
  select.onchange=()=>onChange(select.value);
  for(const link of [first,control])link.onclick=async event=>{
    event.preventDefault();if(blocked)return;
    const value=presetFromHash(new URL(link.href).hash);
    if(await onPreset(value))history.replaceState(null,'',link.href);
  };
  return {
    get value(){return select.value;},set value(value){if(!MODES.includes(value))throw Error('Unknown mode');select.value=value;},
    sync({language,active,ready,large,enabled}){
      const c=COPY[language]||COPY.en;
      select.value=modeForCheckbox(select.value,enabled);blocked=active||!ready;
      select.disabled=blocked;title.textContent=c.label;
      for(const option of select.options){option.textContent=c[option.value];option.disabled=option.value==='stateful'&&!large;}
      first.textContent=c.first;control.textContent=c.control;
      for(const link of [first,control])link.setAttribute('aria-disabled',String(blocked));
      hint.textContent=select.value==='stateful'&&!large?c.large:c.hint;
    },
  };
}
