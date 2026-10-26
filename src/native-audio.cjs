const {spawn}=require('node:child_process');
// Dedicated audio-only helper; a bounded JSON-lines protocol, never a recording.
class NativeSystemAudio {
 constructor({executable,emit,spawnImpl=spawn}){this.executable=executable;this.emit=emit;this.spawn=spawnImpl;this.current=null;this.children=new Set();}
 start(id){
  this.stop();
  return new Promise((resolve,reject)=>{
   const child=this.spawn(this.executable,[],{stdio:['pipe','pipe','pipe']});
   this.children.add(child);
   const attempt={id,child,pending:'',settled:false};this.current=attempt;
   const valid=()=>this.current===attempt;
   const settle=error=>{if(attempt.settled)return;attempt.settled=true;clearTimeout(attempt.timeout);error?reject(error):resolve(true);};attempt.cancel=()=>settle(Error('Capture annulée.'));
   const fail=text=>{if(!valid())return;settle(Error(text));this.emit({type:'system-error',id,text});this.stop(id);};
   attempt.timeout=setTimeout(()=>fail('Autorisez l’audio système pour Clair dans Réglages Système, puis relancez.'),30000);
   child.stdin.on('error',()=>{});child.stderr.on('data',()=>{});
   child.stdout.on('data',chunk=>{
    if(!valid())return;attempt.pending+=chunk.toString();
    if(attempt.pending.length>262144){fail('Flux audio local invalide.');return;}
    let end;while((end=attempt.pending.indexOf('\n'))>=0){
     const line=attempt.pending.slice(0,end);attempt.pending=attempt.pending.slice(end+1);let event;
     try{event=JSON.parse(line);}catch{fail('Flux audio local invalide.');return;}
     if(event.type==='ready'){settle();this.emit({type:'system-reset',id});}
     else if(event.type==='audio'){
      if(!Number.isFinite(event.sampleRate)||event.sampleRate<8000||event.sampleRate>192000||typeof event.data!=='string'||event.data.length>131072){fail('Format audio local invalide.');return;}
      const data=Buffer.from(event.data,'base64');if(!data.length||data.length%4){fail('Paquet audio local invalide.');return;}
      this.emit({type:'system-audio',id,sampleRate:event.sampleRate,samples:data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)});
     }else if(event.type==='error'){fail(String(event.message||'Capture audio système interrompue.').slice(0,240));return;}
     else if(event.type==='device-changed')this.emit({type:'system-device',id});
    }
   });
   child.on('error',()=>fail('Le module audio Mac est indisponible. Réinstallez Clair.'));
   child.on('exit',()=>{this.children.delete(child);clearTimeout(attempt.killTimer);if(valid())fail('La capture du son du Mac s’est interrompue. Relancez l’écoute.');});
  });
 }
 shutdown(){this.stop();for(const child of this.children)child.kill('SIGKILL');this.children.clear();}
 stop(id){
  const attempt=this.current;if(!attempt||(id&&attempt.id!==id))return;
  this.current=null;attempt.cancel();clearTimeout(attempt.timeout);
  attempt.child.stdin.end('stop\n');attempt.child.kill('SIGTERM');
  attempt.killTimer=setTimeout(()=>{if(attempt.child.exitCode===null&&attempt.child.signalCode===null)attempt.child.kill('SIGKILL');},1500);attempt.killTimer.unref?.();
 }
}
module.exports={NativeSystemAudio};
