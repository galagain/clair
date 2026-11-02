const http=require('node:http');
const os=require('node:os');
const fs=require('node:fs');
const path=require('node:path');
const {randomBytes,timingSafeEqual}=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');
const privateIP=ip=>/^10\./.test(ip)||/^192\.168\./.test(ip)||/^172\.(1[6-9]|2\d|3[01])\./.test(ip);
function addresses(){return Object.entries(os.networkInterfaces()).flatMap(([name,items])=>items.filter(x=>x.family==='IPv4'&&!x.internal&&privateIP(x.address)).map(x=>({name,address:x.address}))).sort((a,b)=>Number(!/^en|^Wi-Fi/.test(a.name))-Number(!/^en|^Wi-Fi/.test(b.name)));}
const string=(value,max)=>typeof value==='string'?value.slice(0,max):'';
function blocks(value){
 if(!Array.isArray(value))return [];
 const result=[];let remaining=60000;
 for(const item of value.slice(-500).reverse()){
  if(!item||typeof item!=='object')continue;
  const text=typeof item.text==='string'?item.text.slice(-remaining):'';remaining-=text.length;
  result.push({id:string(item.id,100),text,source:['system','microphone'].includes(item.source)?item.source:'unknown'});
  if(!remaining)break;
 }
 return result.reverse();
}
// Explicit allowlist: no keys, documents, browser contents or desktop controls.
function snapshot(value={}){value=value&&typeof value==='object'?value:{};return {view:value.view==='coding'?'coding':'session',speech:blocks(value.speech),translation:blocks(value.translation),answers:blocks(value.answers),translationEnabled:value.translationEnabled===true,languages:{speech:string(value.languages?.speech,30),translation:string(value.languages?.translation,30),answers:string(value.languages?.answers,30)},coding:{id:string(value.coding?.id,100),text:string(value.coding?.text,48000),status:string(value.coding?.status,500)}};}
class PhoneServer{
 constructor({onStatus=()=>{},getAddresses=addresses,authTimeout=5000}={}){this.onStatus=onStatus;this.getAddresses=getAddresses;this.authTimeout=authTimeout;this.server=null;this.wss=null;this.latest=null;this.queue=Promise.resolve();}
 state(){return {active:!!this.server,clients:this.wss?[...this.wss.clients].filter(ws=>ws.authenticated).length:0,addresses:this.getAddresses(),url:this.server?this.url:''};}
 notify(){const {active,clients}=this.state();this.onStatus({active,clients});}
 start(address){const job=this.queue.then(()=>this.listen(address));this.queue=job.catch(()=>{});return job;}
 async listen(address){
  if(this.server)return this.state();
  const available=this.getAddresses();address=address||available[0]?.address;
  if(!available.some(x=>x.address===address))throw Error('Connectez cet ordinateur au même Wi-Fi que l’iPhone.');
  const assets=new Map([['/',['phone.html','text/html; charset=utf-8']],['/phone.mjs',['phone.mjs','text/javascript; charset=utf-8']],['/phone.css',['phone.css','text/css; charset=utf-8']]].map(([url,[name,type]])=>[url,{data:fs.readFileSync(path.join(__dirname,name)),type}]));
  const token=randomBytes(32).toString('hex');
  const server=http.createServer((req,res)=>{
   res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
   if(req.headers.host!==this.host||req.headers.origin&&req.headers.origin!==this.origin){res.writeHead(403);return res.end();}
   const asset=assets.get(req.url);if(req.method!=='GET'||!asset){res.writeHead(404);return res.end();}res.setHeader('Content-Type',asset.type);res.end(asset.data);
  });
  server.requestTimeout=5000;server.headersTimeout=5000;server.maxConnections=20;
  const wss=new WebSocketServer({noServer:true,maxPayload:512,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
   if(req.url!=='/live'||req.headers.host!==this.host||req.headers.origin!==this.origin||wss.clients.size>=8){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
   wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
  });
  wss.on('connection',ws=>{
   ws.alive=true;ws.on('pong',()=>{ws.alive=true;});ws.on('error',()=>{});
   const timeout=setTimeout(()=>ws.close(4003,'Connexion requise'),this.authTimeout);
   ws.on('message',data=>{
    if(ws.authenticated){ws.close(4003,'Lecture seule');return;}
    let supplied;try{supplied=JSON.parse(data.toString()).token;}catch{}
    if(typeof supplied!=='string'||!/^[a-f0-9]{64}$/.test(supplied)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(token))){ws.close(4003,'Lien invalide');return;}
    clearTimeout(timeout);ws.authenticated=true;ws.send(JSON.stringify({type:'snapshot',value:this.latest||snapshot()}));this.notify();
   });
   ws.on('close',()=>{clearTimeout(timeout);this.notify();});
  });
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,address,()=>{server.removeListener('error',reject);resolve();});});}catch(error){wss.close();throw Error('Connexion iPhone indisponible. Vérifiez le réseau local.');}
  server.on('error',()=>{void this.close();});this.server=server;this.wss=wss;this.host=address+':'+server.address().port;this.origin='http://'+this.host;this.url=this.origin+'/#'+token;
  this.heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();if(ws.authenticated&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'heartbeat'}));}},15000);this.heartbeat.unref();this.notify();return this.state();
 }
 publish(value){if(!this.server)return;const clean=snapshot(value),encoded=JSON.stringify({type:'snapshot',value:clean});if(encoded===this.encoded)return;this.latest=clean;this.encoded=encoded;for(const ws of this.wss.clients)if(ws.authenticated&&ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>1000000)ws.terminate();else ws.send(encoded);}}
 close(){const job=this.queue.then(()=>this.shutdown());this.queue=job.catch(()=>{});return job;}
 async shutdown(){
  const server=this.server,wss=this.wss;this.server=null;this.wss=null;this.latest=null;this.encoded=null;this.url='';clearInterval(this.heartbeat);
  if(wss){for(const ws of wss.clients){ws.close(4001,'Partage arrêté');const timer=setTimeout(()=>ws.terminate(),300);timer.unref();}wss.close();}
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}this.notify();
 }
}
module.exports={PhoneServer,phoneSnapshot:snapshot,phoneAddresses:addresses};
