process.once('message',async bytes=>{
 let parser,result;
 try{
  const {getData}=require('pdf-parse/worker');
  const {PDFParse}=require('pdf-parse');
  PDFParse.setWorker(getData());
  parser=new PDFParse({data:bytes,isEvalSupported:false,verbosity:0});
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
  result={text:pages.join('\n\n'),pages:info.total,emptyPages};
 }catch(error){result={error:error.name==='PasswordException'?'PDF protégé par un mot de passe.':/^PDF /.test(error.message)?error.message:'PDF illisible.'};}
 finally{try{await parser?.destroy();}catch{result={error:'PDF illisible.'};}}
 process.send(result,()=>process.disconnect());
});
