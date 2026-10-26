// Local status only: never calls a model, reads CPQ content, or approves a pair.
export function createAutoConnector({ eligible, connect, changed=()=>{}, visible=()=>true, online=()=>true,
  schedule=(f,ms)=>setTimeout(f,ms), unschedule=id=>clearTimeout(id) }) {
  let timer=null, stopped=false, busy=false, epoch=0, status='IDLE';
  const set=s=>{status=s;changed(s);};
  const arm=()=>{if(timer!==null)unschedule(timer);if(!stopped&&eligible())timer=schedule(tick,status==='CONNECTED'?30000:4000);};
  async function tick(){
    timer=null;
    if(stopped||!eligible())return;
    if(busy||!visible()||!online()){arm();return;}
    busy=true;const before=epoch;
    try{await connect();if(!stopped&&before===epoch)set('CONNECTED');}
    catch(e){if(!stopped&&before===epoch)set(e.message==='BRIDGE_NOT_PAIRED'?'WAITING_APPROVAL':
      /BRIDGE_(?:UPDATE_REQUIRED|INVALID_COMMAND)/.test(e.message)?'UPDATE_REQUIRED':e.message==='BRIDGE_NOT_INSTALLED'?'NOT_INSTALLED':'RECONNECTING');}
    finally{busy=false;if(before===epoch)arm();}
  }
  return {get status(){return status;},start(){if(!eligible())return;stopped=false;epoch++;void tick();},
    async check(){stopped=false;epoch++;await tick();},
    stop(){stopped=true;epoch++;if(timer!==null)unschedule(timer);timer=null;set('DISCONNECTED');},
    wake(){if(!stopped&&eligible()&&visible()&&online()){if(timer!==null)unschedule(timer);void tick();}}};
}
