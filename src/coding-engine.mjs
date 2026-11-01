import {codingSnapshot,codingBody} from './coding-core.mjs';
import {sseEvents,safeError} from './core.mjs';

// Independent from live transcription: speech never replaces a coding answer.
export class CodingEngine {
 constructor({emit,fetchImpl=fetch,timeoutMs=60000}){this.emit=emit;this.fetch=fetchImpl;this.timeoutMs=timeoutMs;this.sequence=0;this.active=null;this.snapshot=null;this.history=[];}
 state(){return {snapshot:this.snapshot,history:this.history.map(item=>({...item})),busy:!!this.active};}
 notify(type,data={}){this.emit({type:'coding-'+type,...data});}
 analyze(value,{action='next',config,key,usage,request,headers}={}){
  if(this.active)throw Error('Une analyse Coding est déjà en cours. Attendez ou cliquez sur Arrêter.');
  const snapshot=codingSnapshot(value);
  const sameExercise=this.snapshot?.statement===snapshot.statement&&this.snapshot?.language===snapshot.language;
  const body=codingBody(config,snapshot,action,sameExercise?this.history.filter(item=>item.state==='done'):[]);
  if(!key)throw Error('Ajoutez votre clé API dans Réglages.');
  this.snapshot=snapshot;
  const item={id:++this.sequence,action,language:config.answerLanguage,source:snapshot.source,title:snapshot.title,text:'',state:'streaming'};
  const entry={item,controller:new AbortController()};this.active=entry;this.history.push(item);
  if(this.history.length>100)this.history.shift();
  this.notify('start',{item:{...item},snapshot});request?.();
  entry.promise=this.run(entry,{body,key,usage:usage?.(),headers});
  return {id:item.id};
 }
 async run(entry,{body,key,usage,headers}){
  const {item,controller}=entry,valid=()=>this.active===entry;
  const timer=setTimeout(()=>controller.abort(),this.timeoutMs);let complete=false;
  try{
   const r=await this.fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
   if(!valid())return;headers?.(r.headers,body.model);
   if(!r.ok)throw Error(safeError('Analyse Coding indisponible.',r.status));
   if(!r.body)throw Error('Le modèle n’a renvoyé aucun flux.');
   for await(const event of sseEvents(r.body)){
    if(!valid())return;
    if(event.type==='response.output_text.delta'||event.type==='response.refusal.delta'){
     item.text+=event.delta||'';if(item.text.length>48000)throw Error('Réponse trop longue.');
     this.notify('delta',{id:item.id,text:item.text});
    }
    if(['response.completed','response.incomplete','response.failed'].includes(event.type)&&event.response?.usage)usage?.report(event.response.usage);
    if(event.type==='response.completed')complete=true;
    if(['error','response.failed','response.incomplete'].includes(event.type))throw Error('Réponse incomplète. Le texte reçu reste disponible.');
   }
   if(!complete||!item.text.trim())throw Error('Flux interrompu ou réponse vide.');
   if(valid()){item.state='done';this.notify('done',{id:item.id});}
  }catch(error){if(valid()){item.state='error';item.error=controller.signal.aborted?'Délai dépassé. Le texte reçu est conservé.':safeError(error);this.notify('error',{id:item.id,error:item.error});}}
  finally{clearTimeout(timer);usage?.finish();if(valid())this.active=null;}
 }
 cancel(){if(!this.active)return;const {item,controller}=this.active;this.active=null;controller.abort();item.state='canceled';this.notify('canceled',{id:item.id});}
 clear(){this.cancel();this.snapshot=null;this.history=[];this.notify('cleared');}
 exportText(){return this.history.length?'\nCODING\n'+this.history.map(item=>`${item.title||item.source||'Exercice'} · ${item.action}\n${item.text}\n${item.error||''}`).join('\n\n'):'';}
}
