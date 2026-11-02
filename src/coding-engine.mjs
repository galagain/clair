import {codingSnapshot,codingBody,codingAdaptBody,codingSolution} from './coding-core.mjs';
import {sseEvents,safeError} from './core.mjs';

// Voice adaptations are buffered: only a complete result replaces the code.
export class CodingEngine {
 constructor({emit,fetchImpl=fetch,timeoutMs=60000}){this.emit=emit;this.fetch=fetchImpl;this.timeoutMs=timeoutMs;this.sequence=0;this.active=null;this.snapshot=null;this.history=[];}
 state(){return {snapshot:this.snapshot,history:this.history.map(item=>({...item})),busy:!!this.active,adapting:this.active?.item.action==='adapt',canUndo:!!this.previous};}
 notify(type,data={}){this.emit({type:'coding-'+type,...data});}
 analyze(value,{action='next',config,key,usage,request,headers}={}){
  const snapshot=codingSnapshot(value);
  const body=codingBody(config,snapshot,action);
  if(!key)throw Error('Ajoutez votre clé API dans Réglages.');
  // Validate before replacing. New captures cancel the previous stream; late
  // chunks and errors cannot overwrite the newest solution.
  this.cancel();
  this.previous=null;
  this.snapshot=snapshot;
  const item={id:++this.sequence,action,language:config.answerLanguage,source:snapshot.source,title:snapshot.title,text:'',state:'streaming'};
  const entry={item,controller:new AbortController()};this.active=entry;this.history=[item];
  this.notify('start',{item:{...item},snapshot});request?.();
  entry.promise=this.run(entry,{body,key,usage:usage?.(),headers});
  return {id:item.id};
 }
 adapt(speech,{config,key,usage,request,headers}={}){
  const base=this.history.at(-1);if(this.active||!base||base.state!=='done'||!this.snapshot)return false;
  if(!key)throw Error('Ajoutez votre clé API dans Réglages.');
  const body=codingAdaptBody(config,this.snapshot,codingSolution(base.text),speech);
  const item={...base,id:++this.sequence,action:'adapt',text:'',state:'streaming'};
  const entry={item,base,controller:new AbortController()};this.active=entry;
  this.notify('adapting',{id:item.id});request?.();
  entry.promise=this.run(entry,{body,key,usage:usage?.(),headers});return true;
 }
 undo(){if(!this.previous)return false;this.cancel();const item={...this.previous,id:++this.sequence};this.previous=null;this.history=[item];this.notify('updated',{item:{...item},canUndo:false});return true;}
 async run(entry,{body,key,usage,headers}){
  const {item,controller}=entry,valid=()=>this.active===entry;
  const timer=setTimeout(()=>controller.abort(),this.timeoutMs);let complete=false,refused=false;
  try{
   const r=await this.fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
   if(!valid())return;headers?.(r.headers,body.model);
   if(!r.ok)throw Error(safeError('Analyse Coding indisponible.',r.status));
   if(!r.body)throw Error('Le modèle n’a renvoyé aucun flux.');
   for await(const event of sseEvents(r.body)){
    if(!valid())return;
    if(event.type==='response.output_text.delta'||event.type==='response.refusal.delta'){
     if(event.type==='response.refusal.delta')refused=true;
     item.text+=event.delta||'';if(item.text.length>48000)throw Error('Réponse trop longue.');
     if(!entry.base)this.notify('delta',{id:item.id,text:item.text});
    }
    if(['response.completed','response.incomplete','response.failed'].includes(event.type)&&event.response?.usage)usage?.report(event.response.usage);
    if(event.type==='response.completed')complete=true;
    if(['error','response.failed','response.incomplete'].includes(event.type))throw Error('Réponse incomplète. Le texte reçu reste disponible.');
   }
   if(entry.base&&refused)throw Error('Adaptation refusée.');
   if(!complete||!item.text.trim())throw Error('Flux interrompu ou réponse vide.');
   if(valid()){item.state='done';if(entry.base){const text=codingSolution(item.text).trim();if(!text)throw Error('Adaptation vide.');if(text==='[[KEEP]]'||text===codingSolution(entry.base.text).trim())this.notify('unchanged',{id:item.id});else{this.previous={...entry.base};this.history=[item];this.notify('updated',{item:{...item},canUndo:true});}}else this.notify('done',{id:item.id});}
  }catch(error){if(valid()){item.state='error';item.error=controller.signal.aborted?'Délai dépassé. Le texte reçu est conservé.':safeError(error);this.notify(entry.base?'adapt-error':'error',{id:item.id,error:entry.base?'Code conservé. '+item.error:item.error});}}
  finally{clearTimeout(timer);usage?.finish();if(valid())this.active=null;}
 }
 cancel(){if(!this.active)return;const {item,controller,base}=this.active;this.active=null;controller.abort();item.state='canceled';this.notify(base?'adapt-canceled':'canceled',{id:item.id});}
 clear(){this.cancel();this.snapshot=null;this.history=[];this.previous=null;this.notify('cleared');}
 exportText(){return this.history.length?'\nCODING\n'+this.history.map(item=>`${item.title||item.source||'Exercice'} · ${item.action}\n${item.text}\n${item.error||''}`).join('\n\n'):'';}
}
