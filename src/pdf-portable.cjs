const {Worker}=require('node:worker_threads');
const path=require('node:path');
function extractPortablePDF(bytes,{signal}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(Error('Import annulé.'));return;}
  if(bytes.byteLength>10*1024*1024){reject(Error('PDF trop volumineux (10 Mo max).'));return;}
  const worker=new Worker(path.join(__dirname,'pdf-worker.cjs'),{workerData:new Uint8Array(bytes),resourceLimits:{maxOldGenerationSizeMb:256}});let done=false;
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);void worker.terminate();error?reject(error):resolve(result);};
  const abort=()=>finish(Error('Import annulé.'));
  const timer=setTimeout(()=>finish(Error('Lecture du PDF trop longue.')),20000);signal?.addEventListener('abort',abort,{once:true});
  worker.on('message',result=>finish(result.error?Error(result.error):null,result));
  worker.on('error',()=>finish(Error('Lecteur PDF indisponible. Réinstallez Clair.')));
  worker.on('exit',()=>{if(!done)finish(Error('PDF illisible.'));});
 });
}
module.exports={extractPortablePDF};
