const {spawn}=require('node:child_process');
function displayId(value){if(!Number.isInteger(value)||value<=0||value>0xffffffff)throw Error('Écran invalide.');return value;}
class Mirror {
 constructor({executable,displays,emit,parent=process.pid,available=process.platform==='darwin',spawnImpl=spawn,timeoutMs=30000}){Object.assign(this,{executable,displays,emit,parent,available,spawn:spawnImpl,timeoutMs});this.status='off';this.child=null;this.source=null;this.target=null;this.message='';this.quality='native';this.output=null;}
 state(){return {available:this.available,status:this.status,quality:this.quality,output:this.output,source:this.source,target:this.target,message:this.message,displays:this.displays().map(d=>({id:d.id,label:d.label||'Écran '+d.id,width:d.size?.width||d.width,height:d.size?.height||d.height}))};}
 notify(message=''){this.message=message;this.emit({type:'mirror-state',...this.state()});}
 start(source,target,quality='native'){
  if(!this.available)throw Error('La recopie sans Clair est disponible sur Mac.');
  if(!['native','economy'].includes(quality))throw Error('Qualité de recopie invalide.');
  displayId(source);displayId(target);if(source===target)throw Error('Choisissez deux écrans distincts.');
  const ids=this.displays().map(d=>d.id);if(!ids.includes(source)||!ids.includes(target))throw Error('Écran indisponible. Connectez deux écrans en affichage étendu.');
  if(this.child)throw Error('Arrêtez la recopie avant de changer d’écran.');
  this.source=source;this.target=target;this.quality=quality;this.output=null;this.status='starting';this.notify();
  return new Promise((resolve,reject)=>{
   let child;try{child=this.spawn(this.executable,['--source',String(source),'--target',String(target),'--parent',String(this.parent),'--quality',quality],{stdio:['pipe','pipe','pipe']});}catch{this.status='off';this.notify('Module de recopie indisponible.');reject(Error(this.message));return;}
   this.child=child;this.rejectStart=reject;let pending='';
   this.timer=setTimeout(()=>this.stop('Autorisation ou démarrage trop long. Vérifiez l’accès à l’enregistrement de l’écran puis réessayez.'),this.timeoutMs);
   child.stdin.on('error',()=>{});child.stderr.on('data',()=>{});
   child.stdout.on('data',chunk=>{if(this.child!==child)return;pending+=chunk.toString();if(pending.length>65536){this.stop('Module de recopie : réponse invalide.');return;}let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);let e;try{e=JSON.parse(line);}catch{this.stop('Module de recopie : réponse invalide.');return;}
    if(!e||typeof e!=='object'){this.stop('Module de recopie : réponse invalide.');return;}
    if(e.type==='ready'){if(e.source!==source||e.target!==target){this.stop('Écrans de recopie incohérents.');return;}clearTimeout(this.timer);this.rejectStart=null;this.status='active';this.output=[e.width,e.height,e.fps].every(n=>Number.isInteger(n)&&n>0)?{width:e.width,height:e.height,fps:e.fps}:null;this.notify();resolve(this.state());}
    else if(e.type==='error'){this.stop(String(e.message||'Recopie indisponible.').slice(0,300));return;}
    else if(e.type==='stopped'){this.stop();return;}
   }});
   child.on('error',()=>{if(this.child===child)this.stop('Module de recopie indisponible. Réinstallez Clair.');});
   child.on('exit',()=>{if(this.child===child)this.stop(this.status==='starting'?'La recopie n’a pas démarré. Vérifiez les autorisations macOS.':'');});
  });
 }
 stop(message=''){
  clearTimeout(this.timer);const child=this.child;this.child=null;this.status='off';this.source=null;this.target=null;this.output=null;
  const reject=this.rejectStart;this.rejectStart=null;reject?.(Error(message||'Recopie arrêtée.'));
  if(child){child.stdin.end();child.kill();}this.notify(message);return this.state();
 }
 changed(){if(this.child)this.stop('La disposition des écrans a changé. Relancez la recopie.');else this.notify();}
}
module.exports={Mirror,displayId};
