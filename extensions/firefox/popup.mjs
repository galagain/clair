import {readPage,readEditors,combineCapture} from './extract.mjs';
const $=id=>document.getElementById(id);
let pairing=null,capture=null,busy=false,tabId=null,revision=0;
function status(text){$('status').textContent=text;}
function lock(value){busy=value;for(const id of ['send','refresh','connect','forget'])$(id).disabled=value;}
function connection(value){const match=/^clair:(\d{1,5}):([a-f0-9]{64})$/.exec(String(value||'').trim());if(!match||Number(match[1])<1||Number(match[1])>65535)throw Error('Copiez le code depuis Clair → Coding → Firefox.');return {port:Number(match[1]),token:match[2]};}
async function request(path,body){
 if(!pairing)throw Error('Connectez d’abord Clair.');
 let result;try{result=await fetch(`http://127.0.0.1:${pairing.port}/v1/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${pairing.token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});}catch{throw Error('Clair est-il ouvert ? Recopiez son code de connexion si nécessaire.');}
 const value=await result.json();if(!result.ok)throw Error(value.error||'Envoi refusé par Clair.');return value;
}
function warnings(){const candidate=capture?.candidates[Number($('editor').value)||0];$('warning').textContent=[capture?.warning,candidate&&!candidate.complete?'Code visible seulement : il peut manquer des lignes. Vérifiez ou collez le code complet.':'',candidate?.truncated?'Code tronqué à 32 000 caractères.':''].filter(Boolean).join(' ');}
function selectCode(){const candidate=capture?.candidates[Number($('editor').value)||0];$('code').value=candidate?.code||'';if(candidate?.language)$('language').value=candidate.language;warnings();}
async function collect(){
 if(busy)return;lock(true);const epoch=++revision;status('Lecture de la page…');
 try{
  const [tab]=await browser.tabs.query({active:true,currentWindow:true});tabId=tab?.id;
  if(!tabId||!/^https?:\/\//.test(tab.url||''))throw Error('Ouvrez une page d’exercice HTTP ou HTTPS.');
  const target={tabId,allFrames:true};
  const [pages,models]=await Promise.all([browser.scripting.executeScript({target,func:readPage}),browser.scripting.executeScript({target,world:'MAIN',func:readEditors}).catch(()=>[])]);
  if(epoch!==revision)return;capture=combineCapture(pages,models);
  $('statement').value=capture.statement;$('tests').value=capture.tests;$('source').textContent=capture.source;
  $('editor').replaceChildren();capture.candidates.forEach((candidate,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=candidate.label;$('editor').append(option);});
  $('editor').hidden=capture.candidates.length<2;selectCode();status('Vérifiez le contenu avant l’envoi.');
 }catch(error){status(error.message||'Capture impossible. Collez le contenu manuellement.');}
 finally{lock(false);}
}
$('editor').onchange=selectCode;
$('refresh').onclick=collect;
$('connect').onclick=async()=>{lock(true);try{pairing=connection($('pairing').value);const value=await request('status');if(value.app!=='clair'||value.version!==1)throw Error('Application Clair incompatible.');await browser.storage.local.set({pairing});$('pairing').value='';$('connection').open=false;status('Clair connecté.');}catch(error){pairing=null;status(error.message);}finally{lock(false);}};
$('forget').onclick=async()=>{await browser.storage.local.remove('pairing');pairing=null;$('pairing').value='';$('connection').open=true;status('Déconnecté.');};
$('capture').onsubmit=async event=>{
 event.preventDefault();if(busy)return;lock(true);
 try{
  if(!$('statement').value.trim()&&!$('code').value.trim())throw Error('Ajoutez un énoncé ou du code.');
  const value={statement:$('statement').value,code:$('code').value,tests:$('tests').value,language:$('language').value,title:capture?.title||'',source:capture?.source||'',warning:$('warning').textContent.slice(0,1000)};
  await request('coding',value);status('Envoyé. La réponse apparaît dans Clair.');
 }catch(error){status(error.message);}finally{lock(false);}
};
try{const stored=(await browser.storage.local.get('pairing')).pairing;if(stored)pairing=connection(`clair:${stored.port}:${stored.token}`);}catch{}
$('connection').open=!pairing;
await collect();
