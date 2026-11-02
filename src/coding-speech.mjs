// Final microphone turns only; the existing solution stays visible during edits.
export class CodingSpeech {
 constructor({enabled,state,adapt,cancel,report=()=>{},delayMs=1500,intervalMs=8000,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){Object.assign(this,{enabled,state,adapt,cancel,report,delayMs,intervalMs,now,setTimer,clearTimer});this.turns=new Map();this.pending=new Map();this.lastRequest=-Infinity;this.lastSpeech=0;}
 reset(){this.clearTimer(this.timer);this.timer=null;this.turns.clear();this.pending.clear();this.lastRequest=-Infinity;this.cancel();}
 event(e){
  if(['stopped','transcript-session','coding-start','coding-cleared'].includes(e.type)){this.reset();return;}
  if(['coding-done','coding-updated','coding-unchanged','coding-adapt-error'].includes(e.type)){this.schedule();return;}
  if(!this.enabled()||!this.state().snapshot||!['transcript','transcript-speaker'].includes(e.type)||typeof e.id!=='string')return;
  let turn=this.turns.get(e.id);if(!turn){turn={};this.turns.set(e.id,turn);if(this.turns.size>100)this.turns.delete(this.turns.keys().next().value);}
  if(e.type==='transcript-speaker'||e.speaker)turn.speaker=e.speaker;
  if(e.type==='transcript'){if(typeof e.text!=='string')return;turn.text=e.text.slice(-6000);turn.final=e.final===true;}
  if(turn.speaker!=='microphone'){this.pending.delete(e.id);return;}
  this.lastSpeech=this.now();
  if(turn.final&&!turn.sent&&turn.text?.trim().length>=12){this.pending.set(e.id,turn);while(this.pending.size>6)this.pending.delete(this.pending.keys().next().value);}
  this.schedule();
 }
 schedule(){
  this.clearTimer(this.timer);this.timer=null;if(!this.enabled()||!this.pending.size)return;
  const delay=Math.max(this.delayMs,this.lastSpeech+this.delayMs-this.now(),this.lastRequest+this.intervalMs-this.now());
  this.timer=this.setTimer(()=>this.flush(),delay);
 }
 flush(){
  this.timer=null;if(!this.enabled()){this.reset();return;}
  const state=this.state();if(state.busy)return;
  if(!state.snapshot||state.history.at(-1)?.state!=='done'){this.pending.clear();return;}
  const entries=[...this.pending.values()],speech=entries.map(x=>x.text.trim()).filter((x,i,a)=>a.indexOf(x)===i).join('\n').slice(-6000);
  if(!speech)return;
  this.pending.clear();for(const turn of entries)turn.sent=true;
  try{if(this.adapt(speech))this.lastRequest=this.now();}catch(error){this.report(error);}
 }
}
