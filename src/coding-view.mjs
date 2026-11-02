import {codingSolution} from './coding-core.mjs';

export async function installCoding(api,{show,toggle}){
 const $=id=>document.getElementById(id),feed=$('coding-feed'),solution=$('coding-solution');
 let current=null,snapshot=null,busy=false,changed=false,revision=0,adaptId=null,canUndo=false;
 const menu=$('coding-menu'),trigger=$('coding-menu-toggle');
 function closeMenu(focus=false){menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
 function positionMenu(){menu.style.setProperty('--coding-menu-top',Math.ceil(document.querySelector('.titlebar').getBoundingClientRect().bottom+6)+'px');}
 trigger.onclick=()=>{if(!menu.hidden){closeMenu();return;}$('more-menu').hidden=true;$('more-toggle').setAttribute('aria-expanded','false');api.preserveSize();positionMenu();menu.hidden=false;trigger.setAttribute('aria-expanded','true');$('coding-language').focus();};
 $('coding-menu-close').onclick=()=>closeMenu(true);
 document.addEventListener('pointerdown',event=>{if(!event.target.closest('#coding-menu,#coding-menu-toggle'))closeMenu();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){event.stopImmediatePropagation();closeMenu(true);}},true);
 window.addEventListener('resize',positionMenu);window.addEventListener('scroll',positionMenu);
 const message=text=>{$('coding-status').textContent=text;$('coding-menu-status').textContent=text;};
 function controls(){$('coding-reanalyze').disabled=busy||!snapshot||current?.state!=='done';$('coding-undo').hidden=!canUndo;$('coding-stop').hidden=!busy;$('coding-copy').disabled=!codingSolution(current?.text).trim();}
 function fit(){if($('coding-panel').hidden)return;const value=Math.max(100,Math.min(600,innerHeight-feed.getBoundingClientRect().top-24))+'px';if(feed.style.maxHeight!==value)feed.style.maxHeight=value;}
 new ResizeObserver(fit).observe($('coding-panel'));window.addEventListener('resize',fit);
 function render(){
  const text=codingSolution(current?.text),top=feed.scrollTop;
  solution.dataset.id=current?String(current.id):'';solution.textContent=text;solution.hidden=!text;$('coding-empty').hidden=busy||!!text;
  controls();fit();feed.scrollTop=top;
 }
 function fill(value){snapshot=value;if(!value)return;for(const field of ['statement','code','tests','language'])$('coding-'+field).value=value[field]||'';$('coding-source').textContent=value.source||'';$('coding-warning').textContent=value.warning||'';}
 function input(){return {...snapshot,statement:$('coding-statement').value,code:$('coding-code').value,tests:$('coding-tests').value,language:$('coding-language').value};}
 function reset(){revision++;current=null;snapshot=null;busy=false;adaptId=null;canUndo=false;for(const field of ['statement','code','tests'])$('coding-'+field).value='';$('coding-source').textContent='';$('coding-warning').textContent='';$('coding-input').open=true;message('');render();feed.scrollTop=0;}
 api.onEvent(event=>{
  if(event.type==='preferences-changed')$('coding-auto-voice').checked=event.config.codingAutoVoice;
  if(!event.type.startsWith('coding-'))return;changed=true;
  if(event.type==='coding-adapting'){adaptId=event.id;busy=true;message(event.manual?'Réanalyse des échanges…':'Adaptation à votre voix…');controls();return;}
  if(event.type==='coding-updated'){revision++;current={...event.item};canUndo=!!event.canUndo;adaptId=null;busy=false;message('');render();return;}
  if(['coding-unchanged','coding-adapt-error','coding-adapt-canceled'].includes(event.type)&&(event.id===adaptId||event.id==null)){adaptId=null;busy=false;message(event.error||(event.manual?'Code déjà adapté aux échanges.':''));controls();return;}
  if(event.type==='coding-start'){
   revision++;adaptId=null;canUndo=false;current={...event.item};fill(event.snapshot);busy=true;closeMenu();show();$('coding-input').open=false;$('coding-browser').open=false;
   message('Résolution…');render();feed.scrollTop=0;
  }
  if(event.type==='coding-delta'&&event.id===current?.id){current.text=event.text;render();}
  if(['coding-done','coding-error','coding-canceled'].includes(event.type)&&event.id===current?.id){current.state=event.type.slice(7);current.error=event.error;busy=false;message(event.error||(current.state==='canceled'?'Arrêtée.':''));render();}
  if(event.type==='coding-cleared')reset();
 });
 $('coding-next').onclick=async()=>{const attempt=++revision;busy=true;controls();message('Résolution…');try{await api.codingAnalyze(input(),'next');}catch(error){if(attempt===revision){busy=false;controls();message(error.message);}}};
 $('coding-reanalyze').onclick=async()=>{api.preserveSize();const attempt=++revision;busy=true;controls();message('Réanalyse des échanges…');try{await api.codingReview();}catch(error){if(attempt===revision){busy=false;controls();message(error.message);}}};
 $('coding-copy').onclick=()=>api.copy(codingSolution(current?.text)).catch(error=>message(error.message));
 $('coding-stop').onclick=()=>api.codingCancel().catch(error=>message(error.message));
 $('coding-clear').onclick=()=>api.codingClear().catch(error=>message(error.message));
 $('coding-tab').onclick=toggle;
 $('coding-undo').onclick=()=>api.codingUndo().catch(error=>message(error.message));
 $('coding-auto-voice').onchange=async()=>{const input=$('coding-auto-voice');input.disabled=true;try{const saved=await api.preferences({codingAutoVoice:input.checked});input.checked=saved.codingAutoVoice;}catch(error){input.checked=!input.checked;message(error.message);}finally{input.disabled=false;}};
 try{$('coding-auto-voice').checked=(await api.config()).codingAutoVoice;}catch(error){message(error.message);}
 $('coding-pair').onclick=async()=>{try{await api.codingPair();$('coding-connection').textContent='Code copié. Collez-le dans l’extension Firefox.';}catch(error){$('coding-connection').textContent=error.message;}};
 $('coding-disconnect').onclick=async()=>{try{await api.codingDisconnect();$('coding-connection').textContent='Firefox déconnecté.';}catch(error){$('coding-connection').textContent=error.message;}};
 $('coding-extension').onclick=()=>api.codingExtension().catch(error=>{$('coding-connection').textContent=error.message;});
 try{const state=await api.codingState();if(!changed){fill(state.snapshot);current=state.history.at(-1)||null;busy=state.busy;canUndo=!!state.canUndo;if(current)$('coding-input').open=false;message(current?.error||(busy?(state.adapting?'Adaptation à votre voix…':'Résolution…'):''));render();}}catch(error){message(error.message);}
}
