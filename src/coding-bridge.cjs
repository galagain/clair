const http=require('node:http');
const {randomBytes,timingSafeEqual}=require('node:crypto');

// Only activated by the user, only on loopback. The capability never enters a
// page/content script. No credential, history or filesystem endpoint is exposed.
class CodingBridge {
 constructor({receive,port=43127}){this.receive=receive;this.port=port;this.server=null;this.token=null;this.starting=null;}
 async start(){
  if(this.starting)return this.starting;
  if(this.server)return this.code();
  this.starting=this.listen();
  try{return await this.starting;}finally{this.starting=null;}
 }
 async listen(){
  const server=http.createServer((req,res)=>void this.handle(req,res));
  server.requestTimeout=10000;server.headersTimeout=10000;server.timeout=10000;server.maxHeadersCount=30;
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(this.port,'127.0.0.1',resolve);});}
  catch{server.close();throw Error('Connexion Firefox indisponible : le port local est occupé.');}
  this.server=server;this.token=randomBytes(32).toString('hex');return this.code();
 }
 code(){return `clair:${this.server.address().port}:${this.token}`;}
 async handle(req,res){
  const reply=(status,data)=>{if(!res.writableEnded){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}};
  const port=this.server?.address()?.port,origin=req.headers.origin;
  if(req.headers.host!==`127.0.0.1:${port}`||origin&&!/^moz-extension:\/\/[a-z0-9-]+$/i.test(origin)){reply(403,{error:'Origine refusée.'});return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){
   res.setHeader('Access-Control-Allow-Methods','GET, POST');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');reply(204,{});return;
  }
  const supplied=Buffer.from(String(req.headers.authorization||'')),expected=Buffer.from(`Bearer ${this.token}`);
  if(!this.token||supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){reply(401,{error:'Reconnectez Firefox depuis l’onglet Coding de Clair.'});return;}
  if(req.method==='GET'&&req.url==='/v1/status'){reply(200,{app:'clair',version:1});return;}
  if(req.method!=='POST'||req.url!=='/v1/coding'){reply(404,{error:'Route inconnue.'});return;}
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')){reply(415,{error:'JSON requis.'});return;}
  const limit=280000;if(Number(req.headers['content-length'])>limit){reply(413,{error:'Capture trop volumineuse.'});req.resume();return;}
  try{
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>limit){reply(413,{error:'Capture trop volumineuse.'});req.resume();return;}chunks.push(chunk);}
   let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{reply(400,{error:'Capture invalide.'});return;}
   const accepted=await this.receive(value);reply(202,{ok:true,...accepted});
  }catch(error){reply(400,{error:String(error.message||'Envoi impossible.').slice(0,260).replace(/sk-[\w-]+/g,'[masqué]')});}
 }
 async close(){if(this.starting)await this.starting.catch(()=>{});const server=this.server;this.server=null;this.token=null;if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
}
module.exports={CodingBridge};
