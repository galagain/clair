import {TokenUsage} from './token-usage.mjs';
import {SourceTurns} from './source-turns.mjs';
import {TranslationStream} from './translation-stream.mjs';
import {TurnLedger,VoiceBoundary,possibleQuestion,parseSections,responseBody,sseEvents,safeError,normalizeConfig} from './core.mjs';
export class InterviewEngine {
 constructor({emit,WebSocketImpl,fetchImpl=fetch}){this.emit=emit;this.WebSocket=WebSocketImpl;this.fetch=fetchImpl;this.ledger=new TurnLedger();this.listenSequence=0;this.config=normalizeConfig();this.generation=0;this.requestSeq=0;this.active=null;this.pending=[];this.history=[];this.recentAnswers=[];this.draftTimers=new Map();this.drafted=new Set();this.running=false;this.ready=false;this.audioSeconds=0;this.calls=0;this.tokens=new TokenUsage(()=>this.stats());this.key='';this.documents=[];this.lastAnswerSource='';this.sources=new SourceTurns();this.committedSources=[];this.translation=new TranslationStream({fetchImpl:(...args)=>this.fetch(...args),emit:(type,data)=>this.notify(type,data),request:()=>this.request(),beginUsage:()=>this.tokens.begin(),headers:(headers,model)=>this.tokens.headers(headers,model)});}
 credentials({key}){if(this.key!==key)this.tokens.rates.clear();this.key=key;this.stats();}
 setDocuments(documents){this.cancelAnalysis();this.pending=[];this.documents=documents;this.recentAnswers=[];this.notify('context-changed');}
 configure(c){this.config=normalizeConfig(c);this.stats();}
 preferences(c){
  const old=this.config;this.configure(c);
  if(old.transcriptionLanguage!==this.config.transcriptionLanguage&&this.running&&this.socket?.readyState===1){if(this.vad.speech>=200){this.commitAudio();this.vad.reset();}this.updateTranscription();}
  if(old.translationEnabled!==this.config.translationEnabled||old.translationLanguage!==this.config.translationLanguage){this.translation.cancel();this.notify('translation-reset');const turn=this.ledger.ordered().filter(t=>t.done).at(-1);if(turn)this.translation.enqueue(turn,this.config,this.key);}
  if(old.answerLanguage!==this.config.answerLanguage){this.cancelAnalysis();this.pending=[];for(const timer of this.draftTimers.values())clearTimeout(timer);this.draftTimers.clear();this.drafted.clear();this.recentAnswers=[];this.notify('answer-language-changed');if(this.key&&this.lastAnswerSource)void this.analyze(this.lastAnswerSource,{manual:true});}
 }
 turnKey(id){return this.listenSequence+':'+id;}
 updateTranscription(){const transcription={model:'gpt-live-transcribe',delay:'low',languages:[this.config.transcriptionLanguage],prompt:'A professional job interview.'};this.socket.send(JSON.stringify({type:'session.update',session:{type:'transcription',audio:{input:{format:{type:'audio/pcm',rate:24000},transcription,turn_detection:null}}}}));}
 get inputTokens(){return this.tokens.inputTokens;}
 get outputTokens(){return this.tokens.outputTokens;}
 request(){this.calls++;this.stats();return true;}

 notify(type,detail={}){this.emit({type,...detail});}
 stats(){this.notify('stats',{audioSeconds:this.audioSeconds,calls:this.calls,...this.tokens.snapshot(this.config.model)});}
 async testConnection(candidate=this.key){
  if(!candidate)throw Error('Saisissez votre clé API dans les réglages.');
  const catalog=async key=>{const r=await this.fetch('https://api.openai.com/v1/models',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error(safeError('Connexion refusée.',r.status));return ((await r.json()).data||[]).map(m=>m.id);};
  const models=await catalog(candidate);
  return {modelAvailable:models.includes(this.config.model),audioAvailable:models.includes('gpt-live-transcribe')};
 }
 async start(){
 if(!this.key)throw Error('Saisissez une clé API avant de démarrer.');this.stop({reset:true});this.listenSequence++;this.recentAnswers=[];this.notify('transcript-session');this.ledger.clear();this.lastAnswerSource='';this.running=true;this.ready=false;this.vad=new VoiceBoundary(this.config);this.sources.reset();this.committedSources=[];const gen=this.generation;
 this.notify('status',{text:'Connexion à la transcription…'});
 const socket=new this.WebSocket('wss://api.openai.com/v1/realtime?intent=transcription',{headers:{Authorization:`Bearer ${this.key}`},handshakeTimeout:15000});this.socket=socket;
 await new Promise((resolve,reject)=>{let done=false;const settle=error=>{if(done)return;done=true;clearTimeout(timeout);this.startReject=null;error?reject(error):resolve();};this.startReject=()=>settle(Error('Démarrage annulé.'));const timeout=setTimeout(()=>{settle(Error('La connexion audio ne répond pas.'));this.notify('error',{text:'La connexion audio ne répond pas. Relancez l’écoute.'});this.stop();},18000);
 socket.on('open',()=>{if(gen!==this.generation)return;this.updateTranscription();});
 socket.on('message',raw=>{if(gen!==this.generation)return;let e;try{e=JSON.parse(raw.toString())}catch{return;}if(e.type==='session.updated'){this.ready=true;settle();this.notify('status',{text:'Écoute active'});return;}
 if(e.type==='error'||e.type==='conversation.item.input_audio_transcription.failed'){const msg=safeError(e.error?.message||'Erreur de transcription.');settle(Error(msg));this.notify('error',{text:msg});this.stop();return;}
 this.event(e);});
 socket.on('unexpected-response',(_r,res)=>{if(gen!==this.generation){res.resume();return;}const msg=safeError('La connexion audio a été refusée.',res.statusCode);settle(Error(msg));this.notify('error',{text:msg});res.resume();this.stop();});
 socket.on('error',err=>{if(gen!==this.generation)return;const msg=safeError(err);settle(Error(msg));this.notify('error',{text:msg});this.stop();});
 socket.on('close',()=>{if(gen!==this.generation)return;settle(Error('Connexion audio interrompue.'));this.notify('error',{text:'Connexion audio interrompue. Relancez l’écoute pour reconnecter.'});this.stop();});
 });
 if(gen!==this.generation)throw Error('Démarrage annulé.');
 this.stats();return {ready:true};
 }
 audio(bytes,levels){if(!this.running||!this.ready||this.socket?.readyState!==1)return;const b=Buffer.from(bytes);if(!b.length||b.length>48000||b.length%2)return;if(this.socket.bufferedAmount>240000){this.notify('error',{text:'Réseau trop lent : écoute arrêtée pour éviter un décalage.'});this.stop();return;}
 let sum=0;for(let i=0;i<b.length;i+=2){const x=b.readInt16LE(i)/32768;sum+=x*x;}const rms=Math.sqrt(sum/(b.length/2)),ms=b.length/48;this.audioSeconds+=ms/1000;
 const source=this.sources.source(levels),previous=this.sources.speaker();if(source&&previous&&source!==previous&&this.vad.speech>=200){this.commitAudio();this.vad.reset();}
 this.sources.add(levels,ms);
 this.socket.send(JSON.stringify({type:'input_audio_buffer.append',audio:b.toString('base64')}));const action=this.vad.push(rms,ms);if(action==='commit')this.commitAudio();else if(action==='clear'){this.discardOpenTranscripts();this.sources.reset();this.socket.send(JSON.stringify({type:'input_audio_buffer.clear'}));}this.notify('level',{rms});if(Math.floor(this.audioSeconds*10)%10===0)this.stats();
 }
 discardOpenTranscripts(){if(this.committedSources.length)return;for(const turn of this.ledger.items.values())if(!turn.done&&!turn.committed){turn.done=true;turn.text='';clearTimeout(this.draftTimers.get(turn.id));this.draftTimers.delete(turn.id);this.notify('transcript-skip',{id:this.turnKey(turn.id)});}}
 commitAudio(){this.committedSources.push(this.sources.speaker());this.sources.reset();this.socket.send(JSON.stringify({type:'input_audio_buffer.commit'}));}
 event(e){
 if(e.type==='input_audio_buffer.committed'&&e.item_id){const turn=this.ledger.commit(e.item_id,e.previous_item_id);turn.speaker=this.committedSources.shift()??null;this.notify('transcript-speaker',{id:this.turnKey(turn.id),speaker:turn.speaker});this.notify('transcript-order',{ids:this.ledger.ordered().map(t=>this.turnKey(t.id))});return;}
 if(e.type==='conversation.item.input_audio_transcription.delta'&&e.item_id){if(this.ledger.items.get(e.item_id)?.done)return;const t=this.ledger.delta(e.item_id,e.delta||'');this.notify('transcript',{id:this.turnKey(t.id),text:t.text,final:false,speaker:t.speaker??null});if(this.config.auto&&this.config.anticipate&&!this.drafted.has(t.id)&&possibleQuestion(t.text)&&!this.draftTimers.has(t.id)){const gen=this.generation;this.draftTimers.set(t.id,setTimeout(()=>{this.draftTimers.delete(t.id);if(gen!==this.generation||t.done||!this.running||this.active||this.pending.length)return;this.drafted.add(t.id);this.analyze(t.text,{draft:true,itemId:t.id});},300));}return;}
 if(e.type==='conversation.item.input_audio_transcription.completed'&&e.item_id){const old=this.ledger.items.get(e.item_id);if(old?.done)return;this.tokens.record(e.usage);const t=this.ledger.complete(e.item_id,String(e.transcript||''));clearTimeout(this.draftTimers.get(t.id));this.draftTimers.delete(t.id);this.notify('transcript',{id:this.turnKey(t.id),text:t.text,final:true,speaker:t.speaker??null});this.translation.enqueue(t,this.config,this.key);
 if(t.text.trim()&&this.config.auto){this.pending.push(t);if(this.active?.draft)this.cancelAnalysis();this.drain();}}
 }
 rememberAnswer(entry){const answer=parseSections(entry.output||'').REPONSE;if(!answer?.trim())return;this.recentAnswers=this.recentAnswers.filter(item=>item.id!==entry.id);this.recentAnswers.push({id:entry.id,question:entry.question,answer,draft:entry.draft});this.recentAnswers=this.recentAnswers.slice(-4);}
 cancelAnalysis(){if(this.active)this.rememberAnswer(this.active);this.active?.controller.abort();this.active=null;}
 drain(){if(this.active||!this.pending.length)return;const batch=this.pending.splice(0).sort((a,b)=>this.ledger.ordered().indexOf(a)-this.ledger.ordered().indexOf(b));this.analyze(batch.map(t=>t.text).join('\n'),{itemId:batch.at(-1).id});}
 async analyze(text,{draft=false,manual=false,itemId='manual'}={}){
 if(!this.key){this.notify('error',{text:'Saisissez votre clé API.'});return;}
 if(this.active){if(manual)this.cancelAnalysis();else return;}
 if(!this.request())return;this.lastAnswerSource=text;const id=++this.requestSeq,gen=this.generation,controller=new AbortController();const entry={id,draft,controller,question:text,output:''};this.active=entry;const usage=this.tokens.begin();const model=this.config.model;const started=Date.now();let first=null,output='',complete=false;const timeout=setTimeout(()=>controller.abort(),45000);
 this.notify('answer-start',{id,draft,manual,text,itemId,language:this.config.answerLanguage});
 try{
 const r=await this.fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},body:JSON.stringify(responseBody(this.config,text,this.ledger.context(),{draft,manual,documents:this.documents,recentAnswers:this.recentAnswers})),signal:controller.signal});
 if(gen!==this.generation||this.active!==entry)return;this.tokens.headers(r.headers,model);
 if(!r.ok){let message='Réponse IA indisponible.';try{const d=await r.json();message=d.error?.message||message}catch{}throw Error(safeError(message,r.status));}
 if(!r.body)throw Error('Flux de réponse vide.');
 for await(const e of sseEvents(r.body)){if(gen!==this.generation||this.active!==entry)return;
 if(e.type==='response.output_text.delta'){output+=e.delta||'';entry.output=output;if(first===null)first=Date.now()-started;this.notify('answer-delta',{id,text:output,draft,firstTokenMs:first});}
 if(e.type==='response.refusal.delta'){output+=e.delta||'';entry.output=output;this.notify('answer-delta',{id,text:output,draft});}
 if(['response.completed','response.incomplete','response.failed'].includes(e.type)&&e.response?.usage)usage.report(e.response.usage);
 if(e.type==='response.completed')complete=true;
 if(e.type==='error'||e.type==='response.failed')throw Error(safeError(e.error?.message||e.response?.error?.message||'La réponse a échoué.'));
 if(e.type==='response.incomplete')throw Error('Réponse interrompue ou budget de tokens atteint. Relancez avec « Aider maintenant ».');}
 if(!complete)throw Error('Le flux a été interrompu avant la fin.');if(!output.trim())throw Error('Le modèle a terminé sans réponse lisible. Relancez ou changez de modèle.');
 if(!draft){this.history.push({time:new Date().toISOString(),question:text,answer:output,firstTokenMs:first});if(this.history.length>500)this.history.shift();}
 this.rememberAnswer(entry);this.notify('answer-done',{id,draft,firstTokenMs:first,totalMs:Date.now()-started});
 }catch(err){if(gen===this.generation&&this.active===entry){this.notify('answer-error',{id,text:controller.signal.aborted?'Analyse annulée ou délai maximal atteint.':safeError(err)});}}
 finally{clearTimeout(timeout);usage.finish();if(this.active===entry){this.active=null;this.drain();}}
 }
 manual(text){const value=String(text||'').trim().slice(0,8000)||this.ledger.context(8000);if(!value){this.notify('error',{text:'Aucune parole à analyser. Saisissez une question ou démarrez l’écoute.'});return;}this.pending=[];return this.analyze(value,{manual:true});}
 stop({reset=false}={}){this.generation++;this.translation.cancel();this.startReject?.();this.startReject=null;this.running=false;this.ready=false;for(const t of this.draftTimers.values())clearTimeout(t);this.draftTimers.clear();this.drafted.clear();this.pending=[];this.cancelAnalysis();if(this.socket){const s=this.socket;this.socket=null;s.on('error',()=>{});if(s.readyState===0)s.terminate();else s.close();}this.notify('stopped',{reset});}
 clear(){this.stop();this.ledger.clear();this.lastAnswerSource='';this.history=[];this.recentAnswers=[];this.calls=0;this.audioSeconds=0;this.tokens.reset();this.stats();this.notify('cleared');}
 exportText(){return ['CLAIR — Session',new Date().toLocaleString('fr-FR'),'\nTRANSCRIPTION',this.ledger.context(100000),'\nAIDES',...this.history.map(h=>`${h.time}\n${h.question}\n${h.answer}\n`)].join('\n');}
}
