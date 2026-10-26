import {translationBody,sseEvents,safeError} from './core.mjs';
// Independent stream: enabling translation never blocks or restarts listening
// or suggestions. Disable/target changes invalidate all outstanding events.
export class TranslationStream {
 constructor({fetchImpl,emit,request,beginUsage,headers}){this.fetch=fetchImpl;this.emit=emit;this.request=request;this.beginUsage=beginUsage;this.headers=headers;this.queue=[];this.active=null;this.revision=0;this.sequence=0;}
 cancel(){this.revision++;this.active?.controller.abort();this.active=null;this.queue=[];}
 enqueue(turn,config,key){if(!config.translationEnabled||!key||!turn.text.trim())return;this.queue.push({turn:{...turn},config:{...config},key});this.drain();}
 drain(){if(this.active||!this.queue.length)return;const job=this.queue.shift();void this.run(job);}
 async run({turn,config,key}){
  if(!this.request())return;const revision=this.revision,controller=new AbortController();const entry={controller};this.active=entry;
  const id=++this.sequence,detail={id,sourceId:turn.id,language:config.translationLanguage,speaker:turn.speaker??null};
  const valid=()=>revision===this.revision&&this.active===entry;
  const usage=this.beginUsage();const timer=setTimeout(()=>controller.abort(),45000);let text='',complete=false;
  this.emit('translation-start',detail);
  try{
   const response=await this.fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(translationBody(config,turn.text)),signal:controller.signal});
   if(!valid())return;this.headers(response.headers,config.model);if(!response.ok)throw Error(safeError('Traduction indisponible.',response.status));if(!response.body)throw Error('Flux de traduction vide.');
   for await(const event of sseEvents(response.body)){
    if(!valid())return;
    if(event.type==='response.output_text.delta'){text+=event.delta||'';this.emit('translation-delta',{...detail,text});}
    if(['response.completed','response.incomplete','response.failed'].includes(event.type)&&event.response?.usage)usage.report(event.response.usage);
    if(event.type==='response.completed')complete=true;
    if(['error','response.failed','response.incomplete'].includes(event.type))throw Error('Traduction interrompue.');
   }
   if(!complete||!text.trim())throw Error('Traduction incomplète.');
   this.emit('translation-done',{...detail,text});
  }catch(error){if(valid())this.emit('translation-error',{...detail,text:controller.signal.aborted?'Traduction interrompue.':safeError(error)});}
  finally{clearTimeout(timer);usage.finish();if(valid()){this.active=null;this.drain();}}
 }
}
