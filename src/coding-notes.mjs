import {codingNotesBody,codingSolution} from './coding-core.mjs';
import {sseEvents,safeError} from './core.mjs';
export class CodingNotes {
 constructor({emit,fetchImpl=fetch,timeoutMs=45000}){Object.assign(this,{emit,fetch:fetchImpl,timeoutMs});this.sequence=0;this.active=null;}
 cancel(){const entry=this.active;if(!entry)return;this.active=null;entry.controller.abort();this.emit({type:'coding-notes-error',id:entry.id,error:'Repères interrompus.',canceled:true});}
 start(snapshot,item,{config,key,usage,request,headers}={}){
  this.cancel();if(!snapshot||item?.state!=='done'||!key)return;
  const entry={id:'coding-notes:'+ ++this.sequence,controller:new AbortController(),text:''};this.active=entry;
  const body=codingNotesBody(config,snapshot,codingSolution(item.text));
  this.emit({type:'coding-notes-start',id:entry.id,language:config.answerLanguage,manual:true,independent:true,kind:'coding',text:item.title||'Repères du code'});request?.();
  entry.promise=this.run(entry,{body,key,usage:usage?.(),headers});return entry.promise;
 }
 async run(entry,{body,key,usage,headers}){
  const valid=()=>this.active===entry,timer=setTimeout(()=>entry.controller.abort(),this.timeoutMs);let complete=false;
  try{
   const r=await this.fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:entry.controller.signal});
   if(!valid())return;headers?.(r.headers,body.model);if(!r.ok)throw Error(safeError('Repères indisponibles.',r.status));if(!r.body)throw Error('Repères indisponibles.');
   for await(const e of sseEvents(r.body)){if(!valid())return;if(e.type==='response.output_text.delta'){entry.text+=e.delta||'';if(entry.text.length>8000)throw Error('Repères trop longs.');this.emit({type:'coding-notes-delta',id:entry.id,text:entry.text});}if(e.response?.usage&&['response.completed','response.incomplete','response.failed'].includes(e.type))usage?.report(e.response.usage);if(e.type==='response.completed')complete=true;if(['error','response.failed','response.incomplete'].includes(e.type))throw Error('Repères incomplets.');}
   if(!complete||!entry.text.trim())throw Error('Repères incomplets.');if(valid())this.emit({type:'coding-notes-done',id:entry.id});
  }catch(error){if(valid())this.emit({type:'coding-notes-error',id:entry.id,error:safeError(error)});}
  finally{clearTimeout(timer);usage?.finish();if(valid())this.active=null;}
 }
}
