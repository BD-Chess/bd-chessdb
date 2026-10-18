/* One DATA action row, reused by More+ and APP. Native dialog owns focus/Escape. */
(function(root) {
  'use strict';
  const doc=root.document,C=root.ChessDataCore,G=root.ChessDataGuard;
  const tr=text=>root.ChessLanguage?.translate(text)||text;
  const element=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=tr(text);return n;};
  function init() {
    const save=doc.getElementById('btnSaveData'),load=doc.getElementById('btnLoadData'),file=doc.getElementById('fileData');
    if(!save||!load||!file)return;
    const dialog=element('dialog');dialog.id='dataDialog';dialog.className='chess-data-dialog';dialog.setAttribute('aria-labelledby','dataDialogTitle');
    const heading=element('h2');heading.id='dataDialogTitle';
    const status=element('p');status.setAttribute('role','status');
    const body=element('div'),actions=element('div');actions.className='chess-data-actions';
    dialog.append(heading,status,body,actions);doc.body.append(dialog);
    let opener=null,preview=null,busy=false,needsReload=false,view=0;
    function button(text,action){const b=element('button',text);b.type='button';b.className='btn';b.onclick=action;actions.append(b);return b;}
    function close(){if(busy)return;if(needsReload){root.location.reload();return;}view++;preview=null;dialog.close();opener?.focus();}
    function show(title){view++;heading.textContent=tr(title);status.textContent='';body.replaceChildren();actions.replaceChildren();if(!dialog.open){opener=doc.activeElement;dialog.showModal();}}
    function download(value,name) {
      const text=C.canonical(value),url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})),a=element('a');
      a.href=url;a.download=name;doc.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    function drafts() {
      const value=G.drafts();
      if(!value||!Object.values(value).some(v=>Array.isArray(v)?v.length:v!==null))return null;
      C.validatePayload({...C.empty(),recovery:value},G.dependencies());return value;
    }
    async function recoveryActions() {
      const token=view;
      try {
        const previous=await G.recovery(); // Guard parses and hashes independently of current capture.
        if(token!==view)return;
        if(previous)button('Save previous workspace',async()=>{
          if(busy)return;busy=true;
          try{const verified=await G.recovery();if(!verified)throw Error('Previous workspace backup is unavailable.');download(verified,'ChessBest_DATA_previous.json');}
          catch(error){await problem(error);}finally{busy=false;}
        });
      }catch(_){if(token===view)body.append(element('p','Previous workspace backup is unavailable or invalid.'));}
      if(token!==view)return;
      try {
        if(drafts())button('Save recovery drafts',async()=>{
          if(busy)return;busy=true;
          try{const verified=drafts();if(!verified)throw Error('Recovery drafts are unavailable.');download({schema:'chessbest-data-recovery/1',source:G.source(),drafts:verified},'ChessBest_DATA_recovery.json');}
          catch(error){await problem(error);}finally{busy=false;}
        });
      }catch(_){body.append(element('p','Recovery drafts are unavailable or invalid.'));}
    }
    async function problem(error) {
      busy=false;show('DATA operation stopped');status.textContent=tr('Your existing workspace and recovery data were retained.');
      const detail=element('p',error.message||String(error));detail.setAttribute('translate','no');body.append(detail);
      button('Close',close);
      await recoveryActions();
    }
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    save.onclick=async()=>{
      if(busy)return;show('Save DATA');busy=true;status.textContent=tr('Pausing activity and preparing a complete workspace backup…');
      try {
        G.assertWritable();const envelope=await G.capture(true);
        download(envelope,'ChessBest_DATA_'+new Date().toISOString().replace(/[-:]/g,'').replace('T','_').slice(0,15)+'.json');
        busy=false;status.textContent=tr('Backup file prepared. Check your browser downloads.');
        body.append(element('p',tr('Workspace records')+': '+Object.values(envelope.manifest.counts).join(' / ')));
        button('Close',close);
        await recoveryActions();
      }catch(error){await problem(error);}
    };
    load.onclick=()=>{if(busy)return;file.value='';file.click();};
    file.onchange=async()=>{
      const selected=file.files?.[0];if(!selected||busy)return;
      show('Load DATA preview');busy=true;status.textContent=tr('Checking the complete file. Nothing is being replaced.');
      try {
        if(selected.size>C.LIMITS.file)throw Error('DATA file exceeds 64 MiB.');
        const incoming=await C.parse(await selected.text(),G.dependencies());
        root.ChessLabHost?.canRestoreData?.();
        await G.refreshSource();
        const target=await G.capture(false);
        preview={incoming,targetHash:target.sha256};busy=false;status.textContent=tr('This replaces the ENTIRE included workspace in LAB. A verified recovery copy is kept first.');
        const metadata=element('dl');
        for(const [label,value] of [['Exported',incoming.exportedAt],['Source',incoming.source.channel+' · '+incoming.source.release],['Target','LAB · '+G.source().release],['SHA-256',incoming.sha256]]) {
          const dd=element('dd',value);dd.setAttribute('translate','no');metadata.append(element('dt',label),dd);
        }
        body.append(metadata);
        const table=element('table'),head=element('tr');
        ['Section','Added','Changed / conflicts','Removed','Unchanged / duplicates'].forEach(text=>head.append(element('th',text)));table.append(head);
        for(const row of C.diff(target.payload,incoming.payload)) {
          const r=element('tr');[row.section,row.added,row.changed,row.removed,row.unchanged].forEach(text=>r.append(element('td',String(text))));table.append(r);
        }
        body.append(table,element('p','Pending work is retained as recovery drafts and is never run automatically. Engines and online sessions stay stopped.'));
        button('Cancel',close);
        button('Restore entire workspace',async()=>{
          if(busy||!preview)return;busy=true;actions.querySelectorAll('button').forEach(b=>b.disabled=true);
          status.textContent=tr('Verifying recovery and restoring workspace…');
          try {
            root.ChessLabHost?.canRestoreData?.();
            await G.restore(preview.incoming,preview.targetHash);
            busy=false;needsReload=true;preview=null;actions.replaceChildren();status.textContent=tr('Workspace restored and verified. Reload to open it.');
            body.replaceChildren();button('Reload workspace',()=>root.location.reload());
          }catch(error){await problem(error);}
        });
      }catch(error){await problem(error);}
      finally{file.value='';}
    };

  }
  const start=()=>Promise.resolve(root.ChessLabReady||root.ChessLabStorage?.ready).then(init).catch(()=>{});
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
