const {fork}=require('node:child_process');
const path=require('node:path');
function extractPortablePDF(bytes,{signal}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(Error('Import annulé.'));return;}
  if(bytes.byteLength>10*1024*1024){reject(Error('PDF trop volumineux (10 Mo max).'));return;}
  // pdf-parse loads native canvas code. A native crash/teardown in a worker
  // thread can terminate Clair on Windows; a child process contains it.
  const worker=fork(path.join(__dirname,'pdf-worker.cjs'),[],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},execArgv:['--max-old-space-size=256'],stdio:['ignore','ignore','ignore','ipc'],serialization:'advanced'});let done=false;
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.kill();error?reject(error):resolve(result);};
  const abort=()=>finish(Error('Import annulé.'));
  const timer=setTimeout(()=>finish(Error('Lecture du PDF trop longue.')),20000);signal?.addEventListener('abort',abort,{once:true});
  worker.on('message',result=>finish(result.error?Error(result.error):null,result));
  worker.on('error',()=>finish(Error('Lecteur PDF indisponible. Réinstallez Clair.')));
  worker.on('exit',()=>{if(!done)finish(Error('PDF illisible.'));});
  worker.send(new Uint8Array(bytes),error=>{if(error)finish(Error('Lecteur PDF indisponible.'));});
 });
}
module.exports={extractPortablePDF};
