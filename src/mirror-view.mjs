export async function installMirror(api){
 const $=id=>document.getElementById(id),menu=$('mirror-menu'),button=$('mirror-toggle');let current,revision=0;
 try{const saved=localStorage.getItem('clair-mirror-quality');if(['native','economy'].includes(saved))$('mirror-quality').value=saved;}catch{}
 $('mirror-quality').onchange=()=>{try{localStorage.setItem('clair-mirror-quality',$('mirror-quality').value);}catch{}};
 function close(){menu.hidden=true;button.setAttribute('aria-expanded','false');}
 function options(id,displays,selected){const select=$(id);select.replaceChildren(...displays.map(d=>{const option=document.createElement('option');option.value=d.id;option.textContent=d.label+' · '+d.width+' × '+d.height;return option;}));select.value=String(selected);}
 function render(value){
  const previous=current;current=value;button.hidden=!value.available;const busy=value.status!=='off';button.setAttribute('aria-pressed',String(busy));button.title=busy?'Arrêter la recopie'+(value.output?' · '+value.output.width+' × '+value.output.height+' · '+value.output.fps+' i/s':''):'Recopie sans Clair';
  $('mirror-quality').disabled=busy;if(busy)$('mirror-quality').value=value.quality;
  const ids=value.displays.map(d=>d.id),source=ids.includes(Number($('mirror-source').value))?Number($('mirror-source').value):value.source||ids[0],target=ids.includes(Number($('mirror-target').value))?Number($('mirror-target').value):value.target||ids.find(id=>id!==source);
  options('mirror-source',value.displays,source);options('mirror-target',value.displays,target);
  $('mirror-start').hidden=busy;$('mirror-stop').hidden=!busy;$('mirror-source').disabled=busy;$('mirror-target').disabled=busy;$('mirror-start').disabled=ids.length<2;
  $('mirror-status').textContent=value.message||(value.status==='starting'?'Autorisation et démarrage…':value.status==='active'?'Recopie active.':ids.length<2?'Connectez deux écrans et choisissez Affichage étendu dans macOS.':'');
  if(value.status==='active')close();
  if(value.message&&previous?.status!=='off'){position();menu.hidden=false;button.setAttribute('aria-expanded','true');}
 }
 function position(){menu.style.setProperty('--mirror-menu-top',Math.ceil(document.querySelector('.titlebar').getBoundingClientRect().bottom+6)+'px');}
 button.onclick=async()=>{
  if(current?.status!=='off'){revision++;render(await api.mirrorStop());return;}
  if(!menu.hidden){close();return;}api.preserveSize();position();menu.hidden=false;button.setAttribute('aria-expanded','true');
  try{render(await api.mirrorState());}catch(error){$('mirror-status').textContent=error.message;}
 };
 $('mirror-close').onclick=()=>{close();button.focus();};
 $('mirror-source').onchange=()=>{if($('mirror-target').value===$('mirror-source').value){const other=current.displays.find(d=>String(d.id)!==$('mirror-source').value);$('mirror-target').value=String(other?.id||'');}};
 $('mirror-start').onclick=async()=>{const attempt=++revision;try{const value=await api.mirrorStart(Number($('mirror-source').value),Number($('mirror-target').value),$('mirror-quality').value);if(attempt===revision)render(await api.mirrorState());}catch(error){if(attempt===revision)$('mirror-status').textContent=error.message;}};
 $('mirror-stop').onclick=async()=>{revision++;render(await api.mirrorStop());};
 $('mirror-permissions').onclick=()=>api.permissions().catch(error=>{$('mirror-status').textContent=error.message;});
 document.addEventListener('pointerdown',event=>{if(!event.target.closest('#mirror-menu,#mirror-toggle'))close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){event.stopImmediatePropagation();close();button.focus();}},true);
 window.addEventListener('resize',position);window.addEventListener('scroll',position);
 api.onEvent(event=>{if(event.type==='mirror-state')render(event);});
 render(await api.mirrorState());
}
