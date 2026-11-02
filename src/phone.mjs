const $=id=>document.getElementById(id);
const names=['speech','answers','translation','coding'],textNames=names.filter(name=>name!=='coding');
let token=location.hash.slice(1),socket,retry,attempt=0,revoked=false,lastSeen=0,readingSize=18,state=null,codingId=null,codePosition={top:0,left:0};
let visible=Object.fromEntries(names.map(name=>[name,true]));
try{if(token)sessionStorage.setItem('clair-phone-token',token);else token=sessionStorage.getItem('clair-phone-token')||'';const saved=JSON.parse(sessionStorage.getItem('clair-phone-panels')||'null');if(saved)for(const name of names)if(typeof saved[name]==='boolean')visible[name]=saved[name];}catch{}
history.replaceState(null,'',location.pathname);
const nodes=Object.fromEntries(textNames.map(name=>[name,new Map()])),scroll=Object.fromEntries(textNames.map(name=>[name,{follow:true,top:0}]));
function sync(){
 for(const name of names){$(name+'-card').hidden=!visible[name];document.querySelector('[data-panel='+name+']').setAttribute('aria-pressed',String(visible[name]));const content=name==='coding'?state?.coding?.text:state?.[name]?.length;$(name+'-empty').hidden=!!content;if(name!=='coding'){$(name+'-language').textContent=state?.languages?.[name]||'';$(name+'-resume').hidden=scroll[name].follow||!content;}}
 $('translation-empty').textContent=state?.translationEnabled?'En attente de traduction.':'Traduction désactivée dans Clair.';
 $('empty').hidden=names.some(name=>visible[name]);
}
for(const button of document.querySelectorAll('[data-panel]'))button.onclick=()=>{
 const name=button.dataset.panel,element=$(name);
 if(visible[name]){if(name==='coding')codePosition={top:element.scrollTop,left:element.scrollLeft};else scroll[name].top=element.scrollTop;}
 visible[name]=!visible[name];try{sessionStorage.setItem('clair-phone-panels',JSON.stringify(visible));}catch{}sync();
 if(visible[name]){if(name==='coding'){element.scrollTop=codePosition.top;element.scrollLeft=codePosition.left;}else{element.scrollTop=scroll[name].follow?element.scrollHeight:scroll[name].top;scroll[name].top=element.scrollTop;}}
};
for(const name of textNames){const element=$(name);element.addEventListener('scroll',()=>{const current=scroll[name];if(!visible[name]||Math.abs(current.top-element.scrollTop)<1)return;current.top=element.scrollTop;current.follow=element.scrollHeight-element.scrollTop-element.clientHeight<32;sync();});$(name+'-resume').onclick=()=>{scroll[name].follow=true;element.scrollTop=element.scrollHeight;scroll[name].top=element.scrollTop;sync();};}
function resize(delta){readingSize=Math.max(14,Math.min(28,readingSize+delta));document.documentElement.style.setProperty('--reading',readingSize+'px');for(const name of textNames)if(visible[name]&&scroll[name].follow){$(name).scrollTop=$(name).scrollHeight;scroll[name].top=$(name).scrollTop;}}
$('smaller').onclick=()=>resize(-1);$('larger').onclick=()=>resize(1);
function render(value){
 state=value;
 for(const name of textNames){
  const element=$(name),top=element.scrollTop,anchor=[...element.children].find(node=>node.getBoundingClientRect().bottom>element.getBoundingClientRect().top),offset=anchor?.getBoundingClientRect().top;
  const retained=new Set();for(const item of value[name]){retained.add(item.id);let node=nodes[name].get(item.id);if(!node){node=document.createElement('article');node.dir='auto';nodes[name].set(item.id,node);element.append(node);}if(node.textContent!==item.text)node.textContent=item.text;node.dataset.source=item.source;}
  for(const [id,node] of nodes[name])if(!retained.has(id)){node.remove();nodes[name].delete(id);}
  if(visible[name]){if(scroll[name].follow)element.scrollTop=element.scrollHeight;else{element.scrollTop=top;if(anchor?.isConnected)element.scrollTop+=anchor.getBoundingClientRect().top-offset;}scroll[name].top=element.scrollTop;}
 }
 const changedCode=codingId!==value.coding.id;codingId=value.coding.id;
 if($('solution').textContent!==value.coding.text)$('solution').textContent=value.coding.text;$('coding-status').textContent=value.coding.status;
 if(changedCode){codePosition={top:0,left:0};$('coding').scrollTop=0;$('coding').scrollLeft=0;}
 sync();
}
function clear(){state=null;for(const name of textNames){$(name).replaceChildren();nodes[name].clear();scroll[name]={follow:true,top:0};}$('solution').textContent='';$('coding-status').textContent='';sync();}
sync();
function connect(){
 clearTimeout(retry);if(revoked)return;if(!/^[a-f0-9]{64}$/.test(token)){$('connection').textContent='Scannez le QR code dans Clair → Réglages → iPhone.';return;}
 const old=socket;socket=null;old?.close();
 const ws=new WebSocket(location.origin.replace(/^http/,'ws')+'/live');socket=ws;lastSeen=Date.now();
 ws.onopen=()=>{if(socket===ws)ws.send(JSON.stringify({token}));};
 ws.onmessage=event=>{if(socket!==ws)return;try{const message=JSON.parse(event.data);lastSeen=Date.now();if(message.type==='heartbeat')return;if(message.type!=='snapshot')return;attempt=0;$('connection').textContent='Connecté';render(message.value);}catch{$('connection').textContent='Affichage indisponible';}};
 ws.onclose=event=>{if(socket!==ws)return;if(event.code===4001||event.code===4003){revoked=true;clear();try{sessionStorage.removeItem('clair-phone-token');}catch{}$('connection').textContent='Partage arrêté · Scannez un nouveau QR code.';return;}$('connection').textContent='Reconnexion… · Dernier affichage';retry=setTimeout(connect,Math.min(8000,500*2**Math.min(attempt++,4)));};
 ws.onerror=()=>ws.close();
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!revoked){const old=socket;socket=null;old?.close();connect();}});
window.addEventListener('online',()=>{if(!socket||socket.readyState!==WebSocket.OPEN)connect();});
window.addEventListener('pagehide',()=>{clearTimeout(retry);const old=socket;socket=null;old?.close();});
window.addEventListener('pageshow',event=>{if(event.persisted)connect();});
connect();

setInterval(()=>{if(socket&&Date.now()-lastSeen>35000){socket.close();}},5000);
