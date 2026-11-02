export class CodingContext {
 constructor({now=Date.now,windowMs=120000}={}){this.now=now;this.windowMs=windowMs;this.clear();}
 clear(){this.turns=new Map();this.order=[];}
 event(e){
  if(['cleared','transcript-session'].includes(e.type)){this.clear();return;}
  if(e.type==='transcript-order'){this.order=Array.isArray(e.ids)?e.ids.slice(-100):[];return;}
  if(typeof e.id!=='string')return;
  if(e.type==='transcript'&&e.final&&typeof e.text==='string'&&e.text.trim()){const old=this.turns.get(e.id);this.turns.set(e.id,{text:e.text.slice(-6000),speaker:e.speaker??old?.speaker,at:old?.at??this.now()});while(this.turns.size>100)this.turns.delete(this.turns.keys().next().value);}
  if(e.type==='transcript-speaker'&&this.turns.has(e.id))this.turns.get(e.id).speaker=e.speaker;
 }
 text(){const items=[...this.turns].filter(([,t])=>this.now()-t.at<=this.windowMs);const rank=id=>{const i=this.order.indexOf(id);return i<0?Infinity:i;};items.sort((a,b)=>rank(a[0])-rank(b[0])||a[1].at-b[1].at);return items.map(([,t])=>`[${t.speaker==='microphone'?'Micro':t.speaker==='system'?'Ordinateur':'Source indéterminée'}] ${t.text}`).join('\n').slice(-6000);}
}
