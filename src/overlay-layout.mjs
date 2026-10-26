export function installOverlay(api){
 if(!api.overlayLayout)return;
 let queued=false,last='',held=false;
 const visible=el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
 function measure(){
  queued=false;const regions=[];
  function add(rect){const x=Math.max(0,rect.left),y=Math.max(0,rect.top),right=Math.min(innerWidth,rect.right),bottom=Math.min(innerHeight,rect.bottom);if(right>x&&bottom>y)regions.push({x,y,width:right-x,height:bottom-y});}
  // Panels remain usable for typing, native menus, scrolling and PDF dropping.
  for(const el of document.querySelectorAll('.titlebar,#files-panel,#settings-panel,#more-menu,button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary'))if(visible(el)){
   const rect=el.getBoundingClientRect(),feed=el.closest('.answer-feed');
   if(feed){const clip=feed.getBoundingClientRect();add({left:Math.max(rect.left,clip.left),right:Math.min(rect.right,clip.right),top:Math.max(rect.top,clip.top),bottom:Math.min(rect.bottom,clip.bottom)});}else add(rect);
  }
  // Text itself passes clicks through. Its scrollbar still allows re-reading.
  for(const el of document.querySelectorAll('.text-feed,.answer-feed'))if(visible(el)&&el.scrollHeight>el.clientHeight){const r=el.getBoundingClientRect();add({left:r.right-10,right:r.right,top:r.top,bottom:r.bottom});}
  // Keep the page scrollbar reachable if a manually sized window is too short.
  if(document.documentElement.scrollHeight>innerHeight)add({left:innerWidth-7,right:innerWidth,top:52,bottom:innerHeight-10});
  const view=['session','files','settings'].find(name=>!document.getElementById(name+'-panel').hidden)||'session';
  const panel=document.getElementById(view+'-panel'),padding=parseFloat(getComputedStyle(document.body).paddingBottom)||0;
  const height=Math.ceil(panel.getBoundingClientRect().bottom+scrollY+padding);
  const value={regions,view,height},encoded=JSON.stringify(value);
  if(encoded!==last){last=encoded;api.overlayLayout(value);}
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(measure);}}
 const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
 const resize=new ResizeObserver(schedule);resize.observe(document.body);
 window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);
 // Forwarded movement offers a fast path in addition to native cursor polling.
 document.addEventListener('mousemove',()=>api.overlayRefresh(),{passive:true});
 document.addEventListener('pointerdown',event=>{if(event.button!==0)return;held=true;api.overlayHold(true);},true);
 const release=()=>{if(held){held=false;api.overlayHold(false);}};
 document.addEventListener('pointerup',release,true);document.addEventListener('pointercancel',release,true);window.addEventListener('blur',release);
 document.addEventListener('change',release,true);document.addEventListener('keydown',event=>{if(event.key==='Escape')release();});
 document.addEventListener('dragend',release);document.addEventListener('drop',release);
 schedule();
}
