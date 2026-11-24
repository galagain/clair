export async function installMirror(api,{openSettings=()=>{}}={}){
 const $=id=>document.getElementById(id),menu=$('mirror-menu'),quick=$('mirror-toggle');let current,revision=0;
 let savedDisplays;try{savedDisplays=JSON.parse(localStorage.getItem('clair-mirror-displays')||'null');}catch{}
 try{const saved=localStorage.getItem('clair-mirror-quality');if(['native','economy'].includes(saved))$('mirror-quality').value=saved;}catch{}
 $('mirror-quality').onchange=()=>{try{localStorage.setItem('clair-mirror-quality',$('mirror-quality').value);}catch{}};
 function options(id,displays,selected){const select=$(id);select.replaceChildren(...displays.map(d=>{const option=document.createElement('option');option.value=d.id;option.textContent=d.label+' · '+d.width+' × '+d.height;return option;}));select.value=String(selected);}
 function render(value){
  current=value;menu.hidden=!value.available;const busy=value.status!=='off';menu.dataset.active=String(busy);quick.hidden=!value.available;quick.setAttribute('aria-pressed',String(busy));const label=busy?'Arrêter la recopie':'Démarrer la recopie';quick.title=label;quick.setAttribute('aria-label',label);
  $('mirror-quality').disabled=busy;if(busy)$('mirror-quality').value=value.quality;
  const ids=value.displays.map(d=>d.id),source=ids.includes(Number($('mirror-source').value))?Number($('mirror-source').value):value.source||(ids.includes(savedDisplays?.source)?savedDisplays.source:ids[0]),target=ids.includes(Number($('mirror-target').value))?Number($('mirror-target').value):value.target||(ids.includes(savedDisplays?.target)&&savedDisplays.target!==source?savedDisplays.target:ids.find(id=>id!==source));
  options('mirror-source',value.displays,source);options('mirror-target',value.displays,target);
  $('mirror-start').hidden=busy;$('mirror-stop').hidden=!busy;$('mirror-source').disabled=busy;$('mirror-target').disabled=busy;$('mirror-start').disabled=ids.length<2;
  $('mirror-status').textContent=value.message||(value.status==='starting'?'Autorisation et démarrage…':value.status==='active'?'Recopie active.':ids.length<2?'Connectez deux écrans et choisissez Affichage étendu dans macOS.':'');
 }
 menu.addEventListener('toggle',()=>{if(menu.open)void api.mirrorState().then(render).catch(error=>{$('mirror-status').textContent=error.message;});});
 $('mirror-source').onchange=()=>{if($('mirror-target').value===$('mirror-source').value){const other=current.displays.find(d=>String(d.id)!==$('mirror-source').value);$('mirror-target').value=String(other?.id||'');}};
 function reveal(){openSettings();menu.open=true;menu.scrollIntoView({block:'nearest'});}
 async function start(){const attempt=++revision;try{const source=Number($('mirror-source').value),target=Number($('mirror-target').value);savedDisplays={source,target};try{localStorage.setItem('clair-mirror-displays',JSON.stringify(savedDisplays));}catch{}await api.mirrorStart(source,target,$('mirror-quality').value);if(attempt===revision)render(await api.mirrorState());}catch(error){if(attempt===revision){$('mirror-status').textContent=error.message;reveal();}}}
 async function stop(){revision++;render(await api.mirrorStop());}
 $('mirror-start').onclick=start;
 $('mirror-stop').onclick=()=>stop().catch(error=>{$('mirror-status').textContent=error.message;reveal();});
 quick.onclick=async()=>{quick.disabled=true;try{render(await api.mirrorState());if(current.status!=='off')await stop();else if(current.displays.length<2)reveal();else await start();}catch(error){$('mirror-status').textContent=error.message;reveal();}finally{quick.disabled=false;}};
 $('mirror-permissions').onclick=()=>api.permissions().catch(error=>{$('mirror-status').textContent=error.message;});
 api.onEvent(event=>{if(event.type==='mirror-state')render(event);});
 render(await api.mirrorState());
}
