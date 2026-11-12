import {connection,storedConnection,requestClair,captureTab,captureWarning} from './client.mjs';
const $=id=>document.getElementById(id);
let pairing=null,capture=null,busy=false,revision=0,preferredLanguage=null;
function status(text){$('status').textContent=text;}
function lock(value){busy=value;for(const id of ['send','refresh','connect','forget'])$(id).disabled=value;}
const request=(path,body)=>requestClair(pairing,path,body);
function warnings(){const candidate=capture?.candidates[Number($('editor').value)||0];$('warning').textContent=captureWarning(capture,candidate);}
function selectCode(){const candidate=capture?.candidates[Number($('editor').value)||0];$('code').value=candidate?.code||'';$('language').value=preferredLanguage||candidate?.language||'python';warnings();}
async function collect(){
 if(busy)return;lock(true);const epoch=++revision;status('Lecture de la page…');
 try{
  const settings=pairing?await request('status'):{};const next=await captureTab(browser,undefined,{captureMode:settings.captureMode});
  if(epoch!==revision)return;capture=next;
  $('statement').value=capture.statement;$('tests').value=capture.tests;$('source').textContent=capture.source;
  $('editor').replaceChildren();capture.candidates.forEach((candidate,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=candidate.label;$('editor').append(option);});
  $('editor').hidden=capture.candidates.length<2;selectCode();status('Vérifiez le contenu avant l’envoi.');
 }catch(error){status(error.message||'Capture impossible. Collez le contenu manuellement.');}
 finally{lock(false);}
}
$('editor').onchange=selectCode;
$('language').onchange=async()=>{preferredLanguage=$('language').value;await browser.storage.local.set({codingLanguage:preferredLanguage});};
$('refresh').onclick=collect;
$('connect').onclick=async()=>{lock(true);try{pairing=connection($('pairing').value);const value=await request('status');if(value.app!=='clair'||value.version!==1)throw Error('Application Clair incompatible.');await browser.storage.local.set({pairing});$('pairing').value='';$('connection').open=false;status('Clair connecté.');}catch(error){pairing=null;status(error.message);}finally{lock(false);}};
$('forget').onclick=async()=>{await browser.storage.local.remove('pairing');pairing=null;$('pairing').value='';$('connection').open=true;status('Déconnecté.');};
$('capture').onsubmit=async event=>{
 event.preventDefault();if(busy)return;lock(true);
 try{
  if(!$('statement').value.trim()&&!$('code').value.trim()&&!capture?.images?.length)throw Error('Ajoutez un énoncé ou du code.');
  const value={...(capture?.images?.length?{images:capture.images}:{}),statement:$('statement').value,code:$('code').value,tests:$('tests').value,language:$('language').value,title:capture?.title||'',source:capture?.source||'',warning:$('warning').textContent.slice(0,1000)};
  await request('coding',value);status('Envoyé. La réponse apparaît dans Clair.');
 }catch(error){status(error.message);}finally{lock(false);}
};
try{pairing=await storedConnection(browser);const stored=(await browser.storage.local.get('codingLanguage')).codingLanguage;if(['python','cpp'].includes(stored))preferredLanguage=stored;const last=(await browser.storage.session.get('lastShortcut')).lastShortcut;if(last){$('last-shortcut').textContent=last.text;$('last-shortcut').hidden=false;}}catch{}
$('connection').open=!pairing;
await collect();
