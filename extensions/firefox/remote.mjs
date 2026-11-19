import {storedConnection} from './client.mjs';
// Receive local capture requests without generating keyboard events.
export function remoteReceiver(api,send,report,{Socket=WebSocket,retryMs=1500}={}){
 let socket=null,retry=null,epoch=0,paired=null;
 const reconnect=revision=>{clearTimeout(retry);retry=setTimeout(()=>{if(revision===epoch)connect(revision);},retryMs);};
 function connect(revision){
  if(revision!==epoch||!paired||socket&&[0,1].includes(socket.readyState))return;
  const ws=new Socket(`ws://127.0.0.1:${paired.port}/v1/capture`);socket=ws;
  ws.onopen=()=>{if(revision===epoch)ws.send(JSON.stringify({type:'auth',token:paired.token}));else ws.close();};
  ws.onerror=()=>{};
  ws.onclose=event=>{if(socket===ws)socket=null;if(revision===epoch&&event.code!==1008&&event.code!==1000)reconnect(revision);};
  ws.onmessage=async event=>{
   if(revision!==epoch||String(event.data).length>2048)return;
   let job;try{job=JSON.parse(event.data);}catch{return;}
   if(job.type!=='capture'||!['text','visual'].includes(job.mode)||!/^[a-f0-9]{24}$/.test(job.id||''))return;
   let result;
   if(!Number.isFinite(job.expires)||job.expires<Date.now())result={status:'error',text:'Demande de capture expirée. Réessayez.'};
   else result=await send(undefined,{captureMode:job.mode,nativeRequestId:job.id});
   if(result.status==='busy')result={status:'error',text:'Un envoi Firefox est déjà en cours. Réessayez.'};
   if(revision!==epoch)return;await report(result);
   if(ws.readyState===1)ws.send(JSON.stringify({type:'capture-result',id:job.id,...result}));
  };
 }
 async function restart(){
  const revision=++epoch;clearTimeout(retry);socket?.close();socket=null;const next=await storedConnection(api).catch(()=>null);if(revision!==epoch)return;paired=next;
  if(paired){api.alarms?.create('clair-connection',{periodInMinutes:1});connect(revision);}else api.alarms?.clear('clair-connection');
 }
 api.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.pairing)void restart();});
 api.alarms?.onAlarm.addListener(alarm=>{if(alarm.name==='clair-connection')connect(epoch);});
 void restart();return {restart,stop(){epoch++;paired=null;clearTimeout(retry);socket?.close();socket=null;}};
}
