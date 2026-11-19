const {WebSocketServer}=require('ws');
const {randomBytes,timingSafeEqual}=require('node:crypto');
// Local authenticated commands only. No keys are simulated or sent to an editor.
class CodingRemote {
 constructor({token,notify=()=>{},deadlineMs=15000}){Object.assign(this,{token,notify,deadlineMs});this.socket=null;this.clients=new Set();this.job=null;}
 attach(server){
  this.wss=new WebSocketServer({noServer:true,maxPayload:2048});
  server.on('upgrade',(req,connection,head)=>{
   const origin=req.headers.origin,port=server.address()?.port;
   if(req.url!=='/v1/capture'||req.headers.host!==`127.0.0.1:${port}`||!/^moz-extension:\/\/[a-z0-9-]+$/i.test(origin||'')){connection.destroy();return;}
   this.wss.handleUpgrade(req,connection,head,socket=>this.connected(socket));
  });
  this.heartbeat=setInterval(()=>{if(this.socket?.readyState===1)this.socket.send(JSON.stringify({type:'ping'}));},15000);this.heartbeat.unref?.();
 }
 connected(socket){
  this.clients.add(socket);let authed=false;
  const timeout=setTimeout(()=>socket.close(1008,'Authentication required'),3000);timeout.unref?.();
  socket.on('error',()=>{});
  socket.on('message',raw=>{
   let event;try{event=JSON.parse(raw.toString());}catch{socket.close(1008);return;}
   if(!event||typeof event!=='object'||Array.isArray(event)){socket.close(1008);return;}
   if(!authed){
    const supplied=Buffer.from(typeof event.token==='string'?event.token:''),expected=Buffer.from(this.token()||'');
    if(event.type!=='auth'||!expected.length||supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){socket.close(1008);return;}
    authed=true;clearTimeout(timeout);if(this.socket&&this.socket!==socket){this.clearJob();this.socket.close(1000,'Replaced');}this.socket=socket;socket.send(JSON.stringify({type:'ready'}));return;
   }
   if(event.type==='capture-result'&&event.id===this.job?.id){this.clearJob();if(event.status!=='sent')this.notify(String(event.text||'Capture Firefox impossible.').replace(/Bearer\s+\S+/gi,'[masqué]').replace(/sk-[\w-]+/g,'[masqué]').slice(0,260));}
  });
  socket.on('close',()=>{clearTimeout(timeout);this.clients.delete(socket);if(this.socket===socket){this.socket=null;if(this.job){this.clearJob();this.notify('Firefox déconnecté. Renvoyez la page après reconnexion.');}}});
 }
 trigger(mode){
  if(!['text','visual'].includes(mode))throw Error('Mode de capture invalide.');
  if(this.socket?.readyState!==1)throw Error('Rechargez l’extension Firefox puis reconnectez-la à Clair.');
  if(this.job)throw Error('Un envoi Firefox est déjà en cours.');
  const job={id:randomBytes(12).toString('hex'),mode,expires:Date.now()+this.deadlineMs};this.job=job;
  this.timer=setTimeout(()=>{this.clearJob();this.notify('Capture Firefox expirée. Réessayez.');},this.deadlineMs);this.timer.unref?.();
  this.socket.send(JSON.stringify({type:'capture',...job}));return {id:job.id};
 }
 accept(id){if(!id)return;if(typeof id!=='string'||id!==this.job?.id||this.job.expires<Date.now())throw Error('Capture Firefox expirée. Réessayez.');this.clearJob();}
 clearJob(){clearTimeout(this.timer);this.timer=null;this.job=null;}
 async close(){clearInterval(this.heartbeat);this.clearJob();this.socket=null;for(const socket of this.clients)socket.terminate();this.clients.clear();if(this.wss){const wss=this.wss;this.wss=null;await new Promise(resolve=>wss.close(resolve));}}
}
module.exports={CodingRemote};
