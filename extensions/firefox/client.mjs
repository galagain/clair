import {readPage,readEditors,combineCapture} from './extract.mjs';

export function connection(value){const match=/^clair:(\d{1,5}):([a-f0-9]{64})$/.exec(String(value||'').trim());if(!match||Number(match[1])<1||Number(match[1])>65535)throw Error('Copiez le code depuis Clair → Coding → Firefox.');return {port:Number(match[1]),token:match[2]};}
export async function storedConnection(api){const stored=(await api.storage.local.get('pairing')).pairing;return stored?connection(`clair:${stored.port}:${stored.token}`):null;}
export async function requestClair(pairing,path,body,fetchImpl=fetch){
 if(!pairing)throw Error('Connectez d’abord Clair depuis l’icône de l’extension.');
 let result;try{result=await fetchImpl(`http://127.0.0.1:${pairing.port}/v1/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${pairing.token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});}catch{throw Error('Clair est-il ouvert ? Recopiez son code de connexion si nécessaire.');}
 const value=await result.json();if(!result.ok)throw Error(value.error||'Envoi refusé par Clair.');return value;
}
export async function captureTab(api,tab,{useSelection=true}={}){
 if(!tab) [tab]=await api.tabs.query({active:true,currentWindow:true});
 if(!Number.isInteger(tab?.id)||!/^https?:\/\//.test(tab.url||''))throw Error('Ouvrez une page d’exercice HTTP ou HTTPS.');
 const target={tabId:tab.id,allFrames:true};
 const [pages,models]=await Promise.all([api.scripting.executeScript({target,func:readPage,args:[{useSelection}]}),api.scripting.executeScript({target,world:'MAIN',func:readEditors}).catch(()=>[])]);
 const current=await api.tabs.get(tab.id);
 if(current.url!==tab.url)throw Error('La page a changé pendant la capture. Relancez le raccourci.');
 return combineCapture(pages,models);
}
export function captureWarning(capture,candidate){return [capture?.warning,candidate&&!candidate.complete?'Code visible seulement : il peut manquer des lignes. Vérifiez ou collez le code complet.':'',candidate?.truncated?'Code tronqué à 32 000 caractères.':''].filter(Boolean).join(' ').slice(0,1000);}
export function directSnapshot(capture,language){
 // Multiple unrelated editor models must not silently select the wrong file.
 const candidate=capture.candidates.length===1?capture.candidates[0]:null;
 const warning=capture.candidates.length>1?[capture.warning,'Plusieurs éditeurs : aucun code choisi automatiquement. Choisissez le bon code dans l’extension ou collez-le dans Clair.'].filter(Boolean).join(' ').slice(0,1000):captureWarning(capture,candidate);
 return {statement:capture.statement,code:candidate?.code||'',tests:capture.tests,title:capture.title,source:capture.source,warning,language:['python','cpp'].includes(language)?language:candidate?.language||'python'};
}
async function boundedCapture(api,tab,timeoutMs){
 let timer;try{return await Promise.race([captureTab(api,tab,{useSelection:false}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Lecture de la page bloquée. Réessayez le raccourci.')),timeoutMs);})]);}finally{clearTimeout(timer);}
}
export function directSender(api,fetchImpl=fetch,{captureTimeoutMs=10000}={}){
 let sending=false;
 return async tab=>{
  if(sending)return {status:'busy'};
  sending=true;
  try{
   const pairing=await storedConnection(api);if(!pairing)throw Error('Connectez d’abord Clair depuis l’icône de l’extension.');
   const language=(await api.storage.local.get('codingLanguage')).codingLanguage;
   const capture=await boundedCapture(api,tab,captureTimeoutMs),snapshot=directSnapshot(capture,language);
   if(!snapshot.statement.trim()&&!snapshot.code.trim())throw Error('Aucun énoncé ou code accessible sur cette page.');
   await requestClair(pairing,'coding',snapshot,fetchImpl);
   return {status:'sent',text:'Dernier raccourci : envoyé à Clair.'};
  }catch(error){return {status:'error',text:String(error.message||'Envoi impossible.').replace(/Bearer\s+\S+/gi,'[masqué]').replace(/sk-[\w-]+/g,'[masqué]').slice(0,260)};}
  finally{sending=false;}
 };
}
