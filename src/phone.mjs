const $=id=>document.getElementById(id),feed=$('feed');
let token=location.hash.slice(1),socket,retry,attempt=0,revoked=false,lastSeen=0,selected='answers',follow=true,ownScroll=0,readingSize=18,state=null,codingId=null;
try{if(token)sessionStorage.setItem('clair-phone-token',token);else token=sessionStorage.getItem('clair-phone-token')||'';}catch{}
history.replaceState(null,'',location.pathname);
const positions=new Map(),nodes={answers:new Map(),speech:new Map(),translation:new Map()};
function sync(){const list=selected==='coding'?state?.coding?.text:state?.[selected]?.length;$('empty').hidden=!!list;$('resume').hidden=selected==='coding'||follow||!list;$('language').textContent=selected==='coding'?'':state?.languages?.[selected]||'';}
function choose(tab){positions.set(selected,{top:feed.scrollTop,follow});selected=tab;for(const name of ['answers','speech','translation','coding'])$(name).hidden=name!==tab;for(const button of document.querySelectorAll('[data-tab]'))button.setAttribute('aria-selected',String(button.dataset.tab===tab));const saved=positions.get(tab);follow=saved?.follow??true;feed.scrollTop=saved?.top??(tab==='coding'?0:feed.scrollHeight);ownScroll=feed.scrollTop;sync();}
for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>choose(button.dataset.tab);
feed.addEventListener('scroll',()=>{if(Math.abs(ownScroll-feed.scrollTop)<1)return;ownScroll=feed.scrollTop;follow=feed.scrollHeight-feed.scrollTop-feed.clientHeight<32;sync();});
$('resume').onclick=()=>{follow=true;feed.scrollTop=feed.scrollHeight;ownScroll=feed.scrollTop;sync();};
function resize(delta){readingSize=Math.max(14,Math.min(28,readingSize+delta));document.documentElement.style.setProperty('--reading',readingSize+'px');}
$('smaller').onclick=()=>resize(-1);$('larger').onclick=()=>resize(1);
function render(value){
 const first=!state,top=feed.scrollTop,previousView=state?.view;state=value;
 const anchor=[...$(selected).children].find(node=>node.getBoundingClientRect().bottom>feed.getBoundingClientRect().top),offset=anchor?.getBoundingClientRect().top;
 for(const name of ['answers','speech','translation']){
  const retained=new Set();for(const item of value[name]){retained.add(item.id);let node=nodes[name].get(item.id);if(!node){node=document.createElement('article');node.dir='auto';nodes[name].set(item.id,node);$(name).append(node);}if(node.textContent!==item.text)node.textContent=item.text;node.dataset.source=item.source;}
  for(const [id,node] of nodes[name])if(!retained.has(id)){node.remove();nodes[name].delete(id);}
 }
 const changedCode=codingId!==value.coding.id;codingId=value.coding.id;if(changedCode)positions.delete('coding');
 if($('solution').textContent!==value.coding.text)$('solution').textContent=value.coding.text;$('coding-status').textContent=value.coding.status;
 document.querySelector('[data-tab=translation]').hidden=!value.translationEnabled;
 if(selected==='translation'&&!value.translationEnabled)choose('answers');
 if(value.view==='coding'&&(first||previousView!=='coding'))choose('coding');
 else if(first)choose('answers');
 else if(selected==='coding'){if(changedCode)feed.scrollTop=0;else feed.scrollTop=top;}
 else if(follow)feed.scrollTop=feed.scrollHeight;
 else{feed.scrollTop=top;if(anchor?.isConnected)feed.scrollTop+=anchor.getBoundingClientRect().top-offset;}
 ownScroll=feed.scrollTop;sync();
}
function clear(){state=null;for(const name of ['answers','speech','translation']){$(name).replaceChildren();nodes[name].clear();}$('solution').textContent='';$('coding-status').textContent='';sync();}
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
