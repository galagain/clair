import {installOverlay} from './overlay-layout.mjs';
import {parseSections,LANGUAGES} from './core.mjs';
import {renderAnswer,plainAnswer} from './answer-view.mjs';
import {AnswerHistory} from './answer-history.mjs';
import {AnswerFeed} from './answer-feed.mjs';
import {TextFeed} from './text-feed.mjs';
import {AudioCapture} from './capture.mjs';
const api=window.clair,$=id=>document.getElementById(id);let config,hasKey=false,running=false,starting=false,diagnostic=false,diagnosticTimer=null,signalSeen=false,clock=null,elapsed=0,listenEpoch=0,answerId=null,compact=false,testing=false,demoTimer=null,lastSignal=0,silenceWarning=null,audioStatus='Audio automatique · ordinateur + micro',diagnosticSources={system:false,mic:false};
const capture=new AudioCapture({mediaDevices:navigator.mediaDevices,AudioContextImpl:AudioContext,WorkletImpl:AudioWorkletNode});
const fields=['model','silenceMs'];
let view='session',filesBusy=false,contextFiles=[],fileEpoch=0;
const history=new AnswerHistory();let displayedAnswer='',locale='fr';
const answerFeed=new AnswerFeed($('answer'),history,answerChrome);
const t=(key,params={})=>String(key||'').replace(/\{(\w+)\}/g,(_,name)=>String(params[name]??''));
function ui(id,key,params){$(id).textContent=t(key,params);}
function error(message){$('error').hidden=!message;ui('error',message||'');}
function status(message,params){document.body.dataset.sessionStatus=t(message,params);if(String(message).startsWith('Test terminé')||String(message).includes('micro indisponible')){$('audio-result').textContent=t(message,params);$('audio-result').hidden=false;}}
const speech=new TextFeed($('transcript'),$('transcript-resume'));
const translations=new TextFeed($('translation'),$('translation-resume'),{empty:'La traduction apparaîtra ici.'});
let translationId=null,preferenceBusy=false;
for(const id of ['translation-language','answer-language','transcription-language'])for(const [value,name] of Object.entries(LANGUAGES)){const option=document.createElement('option');option.value=value;option.textContent=name;$(id).append(option);}
function preferenceView(){if(!config)return;$('translation-card').hidden=!config.translationEnabled;$('translation-toggle').setAttribute('aria-checked',String(config.translationEnabled));$('translation-toggle').title=config.translationEnabled?'Désactiver la traduction':'Activer la traduction';$('translation-language').value=config.translationLanguage;$('answer-language').value=config.answerLanguage;$('transcription-language').value=config.transcriptionLanguage;for(const id of ['translation-toggle','translation-language','answer-language','transcription-language'])$(id).disabled=preferenceBusy;}
async function preferences(patch){if(preferenceBusy)return;preferenceBusy=true;preferenceView();try{const saved=await api.preferences(patch);config={...config,...saved};}catch(e){error(e.message);}finally{preferenceBusy=false;preferenceView();}}
$('translation-toggle').onclick=()=>preferences({translationEnabled:!config.translationEnabled});
$('translation-language').onchange=e=>preferences({translationLanguage:e.target.value});
$('answer-language').onchange=e=>preferences({answerLanguage:e.target.value});
$('transcription-language').onchange=e=>preferences({transcriptionLanguage:e.target.value});
function showView(next){view=next;for(const name of ['session','settings','files']){$(name+'-panel').hidden=name!==next;$(name+'-tab').classList.toggle('selected',name===next);if(name===next)$(name+'-tab').setAttribute('aria-current','page');else $(name+'-tab').removeAttribute('aria-current');}document.body.classList.toggle('settings-open',next!=='session');closeMenu();window.scrollTo(0,0);}
function settings(open){showView(open?'settings':'session');}
function closeMenu(){$('more-menu').hidden=true;$('more-toggle').setAttribute('aria-expanded','false');}
function fill(c){config=c;$('opacity').value=c.opacity;$('opacity').title='Opacité : '+Math.round(c.opacity*100)+' %';preferenceView();capture.native=c.nativeAudio?{start:id=>api.systemStart(id),stop:id=>api.systemStop(id),subscribe:fn=>api.onEvent(fn)}:null;hasKey=c.hasKey??hasKey;for(const key of fields){const el=$(key);if(el.type==='checkbox')el.checked=c[key];else el.value=String(c[key]);}$('pin').classList.toggle('active',c.alwaysOnTop);$('pin').setAttribute('aria-pressed',String(c.alwaysOnTop));$('model-label').textContent=c.model.replace('gpt-','GPT-').replace('-sol',' Sol').replace('-luna',' Luna').replace('-astra',' Astra');$('notice').hidden=hasKey;$('key').placeholder=hasKey?t('Clé enregistrée'):'sk-…';ui('shortcut','{shortcut} : écoute',{shortcut:'Ctrl ⇧ Espace'});if(c.platform==='darwin'){ui('shortcut','{shortcut} : écoute',{shortcut:'⌘ ⇧ Espace'});$('mac-permissions').hidden=false;}}
function controls(){const locked=running||starting||testing;$('listen').disabled=testing;const label=starting?'Annuler':running?'Arrêter l’écoute':'Démarrer l’écoute';$('listen').querySelector('.sr-only').textContent=t(label);$('listen').title=t(label);$('listen').setAttribute('aria-label',t(label));$('listen').classList.toggle('stop',running||starting);document.body.classList.toggle('listening',running);document.body.classList.toggle('starting',starting);for(const id of ['save-key','forget-key','test-key','save-config','demo','audio-test'])$(id).disabled=locked;for(const key of fields)$(key).disabled=locked;$('ask').disabled=!hasKey||starting||testing;}
function cleanup(){
 clearInterval(clock);clock=null;clearInterval(silenceWarning);silenceWarning=null;clearTimeout(diagnosticTimer);diagnosticTimer=null;capture.stop();
}
async function stop(){listenEpoch++;running=false;starting=false;diagnostic=false;cleanup();controls();await api.stop();status('Écoute arrêtée');}
function showLevel(rms){if(rms>config.threshold){lastSignal=Date.now();signalSeen=true;status(diagnostic?'Son reçu · Ordinateur {system} · Micro {mic}':audioStatus,{system:diagnosticSources.system?'✓':'…',mic:diagnosticSources.mic?'✓':'…'});}}
async function start(localTest=false){
 if(starting||running)return;if(!localTest&&!hasKey){settings(true);$('key').focus();return;}
 clearTimeout(demoTimer);demoTimer=null;testing=false;answerId=null;audioStatus='Audio automatique · ordinateur + micro';diagnostic=localTest;diagnosticSources={system:false,mic:false};signalSeen=false;error('');starting=true;controls();const epoch=++listenEpoch;
 try{
  await api.arm();if(epoch!==listenEpoch)return;status('Connexion au son de l’ordinateur et au micro…');
  const opened=await capture.open('auto',{
   onStatus:text=>{audioStatus=text;if(running)status(text);},
   onEnded:text=>{if(epoch===listenEpoch){void stop();error(text||'Le son a été interrompu. Relancez l’écoute.');}},
   onChunk:(data,levels)=>{if(!running||epoch!==listenEpoch)return;if(diagnostic){diagnosticSources.system ||= levels.systemRms>config.threshold;diagnosticSources.mic ||= levels.micRms>config.threshold;const samples=new Int16Array(data);let sum=0;for(const n of samples)sum+=(n/32768)**2;showLevel(Math.sqrt(sum/samples.length));}else api.audio(data,{systemRms:levels.systemRms,micRms:levels.micRms});}
  });
  if(!opened||epoch!==listenEpoch)return;
  if(!localTest)await api.start();if(epoch!==listenEpoch)return;
  elapsed=0;running=true;starting=false;controls();lastSignal=Date.now();
  if(localTest){
   status('Test audio · faites jouer une voix sur l’ordinateur');ui('transcript-state','TEST LOCAL');
   diagnosticTimer=setTimeout(async()=>{const found={...diagnosticSources};await stop();status('Test terminé · Ordinateur {system} · Micro {mic}',{system:found.system?'✓':t('non détecté'),mic:found.mic?'✓':t('non détecté')});if(!found.system||!found.mic)error('Pour vérifier les deux sources, faites jouer une voix sur l’ordinateur et parlez au micro. Si une source reste absente, vérifiez les autorisations audio du système.');},15000);
  }else{renderHistory();status(audioStatus);ui('transcript-state','EN DIRECT');}
  clock=setInterval(()=>{elapsed++;$('timer').textContent=`${Math.floor(elapsed/60).toString().padStart(2,'0')}:${(elapsed%60).toString().padStart(2,'0')}`;},1000);
  silenceWarning=setInterval(()=>{if(Date.now()-lastSignal>15000)status('Aucun son détecté · vérifiez les autorisations audio');},3000);
 }catch(e){if(epoch!==listenEpoch)return;await stop();error(e.name==='NotAllowedError'?'Capture refusée ou annulée. Vérifiez les autorisations dans les Réglages Système, puis rouvrez Clair.':e.message);status('Démarrage impossible');}
}
function clearAnswer(){answerFeed.clear();displayedAnswer='';ui('answer','Prêt à vous aider.');$('answer').classList.add('placeholder');$('points').hidden=true;$('clarification').hidden=true;ui('latency','');$('answer-details').hidden=true;$('copy-answer').disabled=true;ui('answer-state','EN ATTENTE');$('answer-state').classList.remove('provisional');}
function displayAnswer(text){const sections=parseSections(text);$('answer-details').hidden=!(sections.POINTS||sections.PRECISION);$('copy-answer').disabled=!sections.REPONSE;for(const [tag,id] of [['REPONSE','answer'],['POINTS','points'],['PRECISION','clarification']])if(sections[tag]!==undefined){if(id==='answer'){displayedAnswer=sections[tag];renderAnswer($(id),sections[tag]);}else $(id).textContent=sections[tag];$(id).classList.remove('placeholder');if(id!=='answer')$(id).hidden=!sections[tag];}}
function answerChrome(){
 const current=history.current();$('history-controls').hidden=!history.visible().length;
 const unread=history.unread();$('history-unread').textContent=unread;$('history-unread').hidden=!unread;
 $('history-hold').hidden=history.follow;$('history-hold').title=unread?`Revenir au direct (${unread} nouvelle${unread>1?'s':''})`:'Revenir au direct';
 displayedAnswer=current?.answer||'';$('copy-answer').disabled=!displayedAnswer;
 ui('answer-state',current?(current.draft?'PROVISOIRE · À CONFIRMER':current.state==='incomplete'?'INCOMPLET':'À ADAPTER'):'EN ATTENTE');
 if(current?.firstTokenMs!=null)ui('latency','Premier texte : {seconds} s après l’envoi',{seconds:(current.firstTokenMs/1000).toLocaleString(locale,{minimumFractionDigits:1,maximumFractionDigits:1})});
}
function renderHistory(){
 if(testing&&!history.items.length)return;
 $('answer-details').hidden=true;answerFeed.render();answerChrome();
}
$('history-hold').onclick=()=>answerFeed.resume();
api.onEvent(e=>{
 if(e.type==='preferences-changed'){config={...config,...e.config};preferenceView();}
 if(e.type==='answer-language-changed'){answerId=null;history.cancel(true);renderHistory();}
 if(e.type==='translation-reset'){translationId=null;translations.clear();ui('translation-status','');}
 if(e.type==='translation-start'&&config.translationEnabled&&e.language===config.translationLanguage){translationId=e.id;ui('translation-status','Traduction…');}
 if(e.type==='translation-delta'&&e.id===translationId&&config.translationEnabled&&e.language===config.translationLanguage)translations.update({id:e.id,text:e.text,final:false,speaker:e.speaker});
 if(e.type==='translation-done'&&e.id===translationId&&config.translationEnabled&&e.language===config.translationLanguage){translations.update({id:e.id,text:e.text,final:true,speaker:e.speaker});translationId=null;ui('translation-status','');}
 if(e.type==='translation-error'&&e.id===translationId){translations.markIncomplete();ui('translation-status',e.text);}
 if(e.type==='files-changed')renderFiles(e.files);
 if(e.type==='context-changed'){answerId=null;history.cancel(true);renderHistory();}
 if(e.type==='status')status(e.text);
 if(e.type==='error')error(e.text);
 if(e.type==='stopped'){// start() first closes the previous session; do not tear down a newly prepared capture.
 if(!e.reset){if(translationId!==null)ui('translation-status','Traduction interrompue.');translationId=null;translations.markIncomplete();speech.markIncomplete();history.cancel();renderHistory();listenEpoch++;running=false;starting=false;diagnostic=false;cleanup();controls();ui('transcript-state','ARRÊTÉ');status('Écoute arrêtée');}}
 if(e.type==='level')showLevel(e.rms);
 if(e.type==='transcript-skip')speech.discard(e.id);
 if(e.type==='transcript-session')speech.markIncomplete();
 if(e.type==='transcript')speech.update(e);
 if(e.type==='transcript-speaker')speech.speaker(e.id,e.speaker);
 if(e.type==='transcript-order')speech.order(e.ids);
 if(e.type==='answer-start'){answerId=e.id;history.start(e);renderHistory();if(!history.current()){ui('answer-state','ANALYSE…');ui('latency','En attente du modèle…');}}
 if(e.type==='answer-delta'&&e.id===answerId){history.update(e);renderHistory();}
 if(e.type==='answer-done'&&e.id===answerId){history.finish(e);renderHistory();}
 if(e.type==='answer-error'&&e.id===answerId){history.finish(e,true);renderHistory();error(e.text);}
 if(e.type==='cleared'){fileEpoch++;answerId=null;history.clear();answerFeed.clear();$('history-controls').hidden=true;}
 if(e.type==='cleared'&&!testing){$('notice').hidden=hasKey;speech.clear();translations.clear();translationId=null;ui('translation-status','');clearAnswer();$('timer').textContent='00:00';}
 if(e.type==='shortcut-toggle'){if(testing)return;running||starting?stop():start();}
});
function toggleOpacity(open){$('opacity').hidden=!open;$('opacity-toggle').setAttribute('aria-expanded',String(open));const label=open?'Masquer le réglage d’opacité':'Régler l’opacité';$('opacity-toggle').title=label;$('opacity-toggle').setAttribute('aria-label',label);}
$('opacity-toggle').onclick=()=>toggleOpacity($('opacity').hidden);
let opacityTimer=null,opacityVersion=0;
$('opacity').oninput=()=>{const value=Number($('opacity').value);config.opacity=value;$('opacity').title='Opacité : '+Math.round(value*100)+' %';clearTimeout(opacityTimer);const version=++opacityVersion;opacityTimer=setTimeout(()=>{if(version===opacityVersion)void api.opacity(value,false).catch(e=>error(e.message));},25);};
$('opacity').onchange=()=>{clearTimeout(opacityTimer);opacityVersion++;const value=Number($('opacity').value);config.opacity=value;void api.opacity(value,true).catch(e=>error(e.message));};
$('more-toggle').onclick=()=>{const open=$('more-menu').hidden;$('more-menu').hidden=!open;$('more-toggle').setAttribute('aria-expanded',String(open));};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#more-menu,#more-toggle'))closeMenu();});
$('more-menu').addEventListener('click',e=>{if(e.target.closest('button'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){toggleOpacity(false);closeMenu();if(view!=='session')settings(false);}});
$('notice').onclick=()=>{settings(true);$('key').focus();};
$('copy-answer').onclick=async()=>{try{await api.copy(plainAnswer(displayedAnswer));$('copy-answer').title=t('Copié');setTimeout(()=>{$('copy-answer').title=t('Copier la réponse');},1500);}catch(e){error(e.message);}};
$('audio-test').onclick=()=>{$('audio-result').hidden=true;settings(false);void start(true);};$('mac-permissions').onclick=()=>api.permissions().catch(e=>error(e.message));
$('session-tab').onclick=()=>settings(false);$('settings-tab').onclick=()=>showView(view==='settings'?'session':'settings');$('files-tab').onclick=()=>showView(view==='files'?'session':'files');$('close').onclick=()=>api.close();$('minimize').onclick=()=>api.minimize();$('pin').onclick=async()=>{const value=await api.pin();$('pin').classList.toggle('active',value);$('pin').setAttribute('aria-pressed',String(value));config.alwaysOnTop=value;};$('compact').onclick=async()=>{if(view!=='session')settings(false);compact=!compact;$('compact').setAttribute('aria-pressed',String(compact));document.body.classList.toggle('compact',compact);await api.compact(compact)};$('listen').onclick=()=>running||starting?stop():start();
$('save-key').onclick=async()=>{testing=true;controls();try{const info=await api.saveKeys({key:$('key').value});$('key').value='';fill({...config,...info});ui('key-result','Enregistrée.');}catch(e){ui('key-result',e.message);}finally{testing=false;controls();}};
$('test-key').onclick=async()=>{testing=true;controls();ui('key-result','Vérification…');try{const r=await api.test($('key').value);ui('key-result',r.modelAvailable&&r.audioAvailable?'Clé valide.':!r.modelAvailable?'Modèle indisponible.':'Transcription indisponible.');}catch(e){ui('key-result',e.message);}finally{testing=false;controls();}};
$('forget-key').onclick=async()=>{testing=true;controls();try{await api.forgetKeys();$('key').value='';hasKey=false;fill({...config,hasKey:false,storedKeys:false});ui('key-result','Oubliée.');}catch(e){ui('key-result',e.message);}finally{testing=false;controls();}};
$('config-form').onsubmit=async e=>{e.preventDefault();try{const value={...config};for(const key of fields)value[key]=$(key).type==='checkbox'?$(key).checked:$(key).value;const saved=await api.saveConfig(value);fill({...config,...saved});controls();ui('config-result','Enregistré.');}catch(err){ui('config-result',err.message);}};
$('ask').onclick=()=>{error('');api.ask('')};$('export').onclick=async()=>{try{const done=await api.export();if(done)status('Notes exportées');}catch(e){error(e.message)}};$('clear').onclick=async()=>{clearTimeout(demoTimer);demoTimer=null;testing=false;await stop();await api.clear();error('');};
$('demo').onclick=async()=>{if(running||starting)return;settings(false);testing=true;controls();await api.clear();speech.clear();translations.clear();controls();error('');status('Démonstration · aucun appel API');$('notice').hidden=true;ui('transcript-state','EXEMPLE');speech.update({id:'demo',text:'Why can an API suddenly become slow?',final:true});clearAnswer();ui('answer-state','EXEMPLE PRÉPARÉ');const sample='[[REPONSE]] • **Slow database queries** can increase latency, especially with missing indexes or locks.\n• **Overloaded dependencies** and network delays can slow down downstream calls.\n• **Resource saturation** can cause requests to queue and take longer.\n[[POINTS]] • Check p95 and p99 latency.\n• Inspect dependencies and saturation.\n• Measure before and after the fix.\n[[PRECISION]] Did the slowdown start after a deployment?';let i=0;const tick=()=>{i+=12;displayAnswer(sample.slice(0,i));if(i<sample.length)demoTimer=setTimeout(tick,20);else{testing=false;controls();ui('latency','Exemple préparé · vitesse simulée');}};tick();};
window.addEventListener('beforeunload',()=>{capture.stop();});
try{fill(await api.config());renderFiles(await api.files());controls();if(!hasKey)status('Configurez votre clé API');}catch(e){error(t('Initialisation impossible : {error}',{error:t(e.message)}));}

function renderFiles(files){contextFiles=files;$('files-count').textContent=files.length;$('files-count').hidden=!files.length;$('clear-files').disabled=filesBusy||!files.length;const list=$('file-list');list.replaceChildren();for(const file of files){const row=document.createElement('li');row.className='file-row';const badge=document.createElement('span');badge.className='file-badge';badge.textContent='PDF';const info=document.createElement('div');info.className='file-info';const name=document.createElement('div');name.className='file-name';name.textContent=file.name;const meta=document.createElement('div');meta.className='file-meta';meta.textContent=t('{pages} p. · Prêt',{pages:file.pages});info.append(name,meta);if(file.warning){const warning=document.createElement('div');warning.className='file-meta file-warning';warning.textContent=t(file.warning);info.append(warning);}const remove=document.createElement('button');remove.textContent='×';remove.title=t('Retirer');remove.setAttribute('aria-label',t('Retirer {name}',{name:file.name}));remove.disabled=filesBusy;remove.onclick=async()=>{try{renderFiles(await api.removeFile(file.id));}catch(e){ui('file-result',e.message);}};row.append(badge,info,remove);list.append(row);}}
function fileBusy(value){filesBusy=value;$('drop-zone').disabled=value;renderFiles(contextFiles);}
async function importFiles(files){if(filesBusy)return;const epoch=fileEpoch;showView('files');fileBusy(true);const errors=[];try{for(const file of [...files].slice(0,5)){if(epoch!==fileEpoch)break;ui('file-result','Lecture…');try{if(!/\.pdf$/i.test(file.name))throw Error('PDF uniquement.');if(file.size>10*1024*1024)throw Error('10 Mo maximum.');const data=await file.arrayBuffer();if(epoch!==fileEpoch)break;renderFiles(await api.addFile({name:file.name,data}));}catch(e){errors.push(file.name+' : '+t(e.message));}}if(files.length>5)errors.push(t('5 PDF maximum.'));ui('file-result',errors.join('\n'));}finally{fileBusy(false);}}
$('drop-zone').onclick=async()=>{if(filesBusy)return;fileBusy(true);try{const result=await api.pickFiles();renderFiles(result.files);ui('file-result',result.errors.map(message=>t(message)).join('\n'));}catch(e){ui('file-result',e.message);}finally{fileBusy(false);}};
$('file-input').onchange=async e=>{await importFiles(e.target.files);e.target.value='';};
for(const event of ['dragenter','dragover'])document.addEventListener(event,e=>{e.preventDefault();if([...e.dataTransfer.types].includes('Files')){if(view!=='files')showView('files');$('drop-zone').classList.add('dragging');}});
document.addEventListener('dragleave',e=>{if(!e.relatedTarget)$('drop-zone').classList.remove('dragging');});
document.addEventListener('drop',e=>{e.preventDefault();$('drop-zone').classList.remove('dragging');if(e.dataTransfer.files.length)void importFiles(e.dataTransfer.files);});
$('clear-files').onclick=async()=>{try{renderFiles(await api.clearFiles());ui('file-result','');}catch(e){ui('file-result',e.message);}};

installOverlay(api);
