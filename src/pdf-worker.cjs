const {parentPort,workerData}=require('node:worker_threads');
(async()=>{
 let parser;
 try{
  const {getData}=require('pdf-parse/worker');
  const {PDFParse}=require('pdf-parse');
  PDFParse.setWorker(getData());
  parser=new PDFParse({data:workerData,isEvalSupported:false,verbosity:0});
  const info=await parser.getInfo();
  if(info.total<1||info.total>80)throw Error('PDF limité à 80 pages.');
  const pages=[];let count=0,emptyPages=0;
  for(let page=1;page<=info.total;page++){
   const result=await parser.getText({partial:[page],pageJoiner:''});
   const text=result.pages.map(item=>item.text).join('\n').trim();
   if(!text){emptyPages++;continue;}
   count+=text.length;if(count>60000)throw Error('PDF trop long (60 000 caractères max).');
   pages.push(`[Page ${page}]\n${text}`);
  }
  if(!pages.length)throw Error('PDF sans texte lisible. Les scans ne sont pas pris en charge.');
  parentPort.postMessage({text:pages.join('\n\n'),pages:info.total,emptyPages});
 }catch(error){parentPort.postMessage({error:error.name==='PasswordException'?'PDF protégé par un mot de passe.':/^PDF /.test(error.message)?error.message:'PDF illisible.'});}
 finally{await parser?.destroy();}
})().catch(()=>parentPort.postMessage({error:'PDF illisible.'}));
