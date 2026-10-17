// One story-session reveal state. No storage, fetching, gestures or Photos state.
export const TEXT_SECONDS=Object.freeze([0,.5,1,2,3,5]);
export const HOLD_MS=500,MOTION_PX=12;
export class TextReveal{
 constructor({now=()=>performance.now(),set=(f,n)=>setTimeout(f,n),clear=n=>clearTimeout(n),changed=()=>{}}={}){Object.assign(this,{now,set,clear,changed});this.tasks=new Map();this.hidden=false;this.open();}
 open(){this.cancelAll();this.mode='On';this.seconds=2;this.logical=null;this.ready=false;this.revealed=false;this.hoverId=null;this.hoverVisible=null;this.hoverBlocked=false;this.peekId=null;this.emit();}
 emit(){this.changed(this.snapshot());}
 snapshot(){return {mode:this.mode,seconds:this.seconds,logical:this.logical,ready:this.ready,revealed:this.revealed,hover:this.hoverVisible,peek:this.peekId,hidden:this.hidden,timers:[...this.tasks].map(([kind,t])=>({kind,remaining:this.hidden?t.left:Math.max(0,t.at-this.now())}))};}
 visible(id){return this.ready&&(this.mode==='On'?this.revealed:this.peekId?this.peekId===id:this.hoverVisible===id);}
 cancel(kind){const t=this.tasks.get(kind);if(t){this.clear(t.handle);this.tasks.delete(kind);}}
 cancelAll(){if(this.tasks)for(const kind of this.tasks.keys())this.cancel(kind);}
 schedule(kind,ms,fn){this.cancel(kind);const t={left:ms,at:this.now()+ms,handle:null,fn};this.tasks.set(kind,t);if(!this.hidden)this.arm(kind,t);}
 arm(kind,t){t.at=this.now()+t.left;t.handle=this.set(()=>{if(this.tasks.get(kind)!==t||this.hidden)return;this.tasks.delete(kind);t.fn();this.emit();},Math.max(0,t.left));}
 automatic(){if(this.mode==='On'&&this.ready&&!this.revealed){this.cancel('on');if(this.seconds===0){this.revealed=true;this.emit();}else this.schedule('on',this.seconds*1000,()=>{this.revealed=true;});}}
 navigate(logical){if(this.logical===logical)return false;this.cancelAll();this.logical=logical;this.ready=false;this.revealed=false;this.peekId=null;this.hoverId=null;this.hoverVisible=null;this.hoverBlocked=false;this.emit();return true;}
 present(logical){if(logical!==this.logical||this.ready)return;this.ready=true;this.automatic();this.emit();}
 close(){this.cancelAll();this.ready=false;this.logical=null;this.peekId=null;this.hoverId=null;this.hoverVisible=null;this.revealed=false;this.emit();}
 fail(logical){if(this.logical===logical)this.close();}
 setMode(mode){if(!['On','Off'].includes(mode)||mode===this.mode)return;this.cancelAll();this.mode=mode;this.revealed=false;this.peekId=null;this.hoverId=null;this.hoverVisible=null;this.hoverBlocked=false;this.automatic();this.emit();}
 setSeconds(n){n=Number(n);if(!TEXT_SECONDS.includes(n)||n===this.seconds)return;this.seconds=n;if(this.tasks.has('on'))this.automatic();if(this.tasks.has('hover')){const id=this.hoverId;this.cancel('hover');this.schedule('hover',n*1000,()=>{if(this.hoverId===id)this.hoverVisible=id;});}this.emit();}
 hover(id){if(this.mode!=='Off'||!this.ready||!this.logical?.startsWith('overview:'))return;if(id===this.hoverId)return;this.cancel('hover');this.hoverId=id;this.hoverVisible=null;this.hoverBlocked=Boolean(this.peekId);if(id&&!this.hoverBlocked)this.schedule('hover',this.seconds*1000,()=>{if(this.hoverId===id&&!this.peekId)this.hoverVisible=id;});this.emit();}
 peek(id){if(this.mode!=='Off'||!this.ready||!id)return false;this.cancel('hover');this.hoverVisible=null;this.hoverBlocked=true;this.peekId=id;this.schedule('peek',(this.seconds||2)*1000,()=>{this.peekId=null;this.hoverVisible=null;this.hoverBlocked=true;});this.emit();return true;}
 setHidden(hidden){hidden=Boolean(hidden);if(hidden===this.hidden)return;this.hidden=hidden;for(const [kind,t]of this.tasks){if(hidden){t.left=Math.max(0,t.at-this.now());this.clear(t.handle);}else this.arm(kind,t);}this.emit();}
}
