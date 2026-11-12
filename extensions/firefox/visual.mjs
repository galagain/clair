export async function capturePageImages(api,tab,dimensions,signal){
 const known=Number.isFinite(dimensions?.width)&&Number.isFinite(dimensions?.height);
 const width=Math.max(1,Math.min(2400,Math.ceil(Number(dimensions?.width)||tab.width||1440)));
 const requested=Math.max(1,Math.ceil(Number(dimensions?.height)||tab.height||900));
 const height=Math.min(requested,8400),images=[];let size=0;
 const check=async()=>{if(signal?.aborted)throw Error('Capture annulée.');const [active]=await api.tabs.query({active:true,windowId:tab.windowId});const current=await api.tabs.get(tab.id);if(active?.id!==tab.id||current.url!==tab.url)throw Error('L’onglet a changé pendant la capture. Réessayez.');};
 for(let y=0;y<height;y+=1400){
  await check();
  const url=await api.tabs.captureVisibleTab(tab.windowId,{format:'jpeg',quality:88,scale:1,...(known?{rect:{x:0,y,width,height:Math.min(1400,height-y)}}:{})});
  if(typeof url!=='string'||!url.startsWith('data:image/jpeg;base64,'))throw Error('Capture Firefox indisponible.');
  size+=url.length;if(size>8000000)throw Error('Page trop volumineuse. Réduisez la page ou utilisez le mode Texte.');
  images.push({url,width,height:Math.min(1400,height-y)});if(!known)break;
 }
 await check();return {images,warning:requested>height||Number(dimensions?.width)>width?'Capture limitée : une partie de la page dépasse la zone capturée.':''};
}
