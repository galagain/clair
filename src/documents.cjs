const {spawn}=require('node:child_process');
const {createHash,randomUUID}=require('node:crypto');
const path=require('node:path');
const LIMITS=Object.freeze({files:5,bytes:10*1024*1024,characters:60000});
function extractPDF(executable,bytes,{signal}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(Error('Import annulé.'));return;}
  const child=spawn(executable,[],{stdio:['pipe','pipe','pipe']});let output='',done=false;
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error){child.kill('SIGKILL');reject(error);}else resolve(result);};
  const abort=()=>finish(Error('Import annulé.'));
  const timer=setTimeout(()=>finish(Error('Lecture du PDF trop longue.')),20000);
  signal?.addEventListener('abort',abort,{once:true});
  child.stdin.on('error',()=>{});child.stderr.on('data',()=>{});
  child.on('error',()=>finish(Error('Lecteur PDF indisponible. Réinstallez Clair.')));
  child.stdout.setEncoding('utf8');
  child.stdout.on('data',chunk=>{output+=chunk;if(Buffer.byteLength(output)>512000)finish(Error('PDF trop long.'));});
  child.on('close',code=>{
   if(done)return;if(code!==0){finish(Error('PDF illisible.'));return;}
   try{const data=JSON.parse(output);if(data.error){finish(Error(String(data.error).slice(0,180)));return;}if(typeof data.text!=='string'||!data.text.trim()){finish(Error('PDF sans texte lisible.'));return;}finish(null,data);}catch{finish(Error('PDF illisible.'));}
  });
  child.stdin.end(bytes);
 });
}
class DocumentContext {
 constructor({extract,onChange=()=>{}}){this.extract=extract;this.onChange=onChange;this.items=[];this.queue=Promise.resolve();this.revision=0;this.active=null;}
 list(){return this.items.map(({text,hash,...item})=>({...item,characters:text.length}));}
 context(){return this.items.map(({name,text})=>({name,text}));}
 changed(){this.onChange(this.context());return this.list();}
 add({name,data}){
  const revision=this.revision;
  const job=this.queue.then(async()=>{
   if(revision!==this.revision)throw Error('Import annulé.');
   const cleanName=path.basename(String(name||'').replace(/\\/g,'/')).slice(0,180);
   if(!/\.pdf$/i.test(cleanName))throw Error('Ajoutez un fichier PDF.');
   if(!(data instanceof ArrayBuffer)&&!Buffer.isBuffer(data))throw Error('Fichier illisible.');
   const size=data.byteLength;if(!size||size>LIMITS.bytes)throw Error('PDF limité à 10 Mo.');
   const bytes=Buffer.from(data);if(!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('Fichier PDF invalide.');
   const hash=createHash('sha256').update(bytes).digest('hex');
   if(this.items.some(item=>item.hash===hash))return this.list();
   if(this.items.length>=LIMITS.files)throw Error('5 PDF maximum.');
   const controller=new AbortController();this.active=controller;
   try{
    const result=await this.extract(bytes,{signal:controller.signal});
    if(revision!==this.revision)throw Error('Import annulé.');
    const text=String(result.text||'').trim();if(!text)throw Error('PDF sans texte lisible.');
    if(text.length+this.items.reduce((n,item)=>n+item.text.length,0)>LIMITS.characters)throw Error('Contexte trop long. Retirez un PDF.');
    this.items.push({id:randomUUID(),name:cleanName,hash,text,pages:result.pages||0,warning:result.emptyPages?'Certaines pages sont sans texte.':''});return this.changed();
   }finally{if(this.active===controller)this.active=null;}
  });
  this.queue=job.catch(()=>{});return job;
 }
 remove(id){this.items=this.items.filter(item=>item.id!==id);return this.changed();}
 clear(){this.revision++;this.active?.abort();this.items=[];return this.changed();}
}
module.exports={DocumentContext,extractPDF,LIMITS};
