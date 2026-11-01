import {LANGUAGES} from './core.mjs';
import {CODING_ACTIONS,codingSections} from './coding-core.mjs';
import {renderAnswer} from './answer-view.mjs';

export async function installCoding(api,{show,toggle,getConfig,preferences}){
 const $=id=>document.getElementById(id),feed=$('coding-feed'),items=new Map();
 let busy=false,follow=true,snapshot=null,changed=false;
 const labels={ETAPE:'Prochaine étape',POURQUOI:'Pourquoi',DIRE:'À dire',CODE:'Code',TESTS:'Tests · non exécutés',COMPLEXITE:'Complexité'};
 for(const [value,name] of Object.entries(LANGUAGES)){const option=document.createElement('option');option.value=value;option.textContent=name;$('coding-answer-language').append(option);}
 $('coding-answer-language').value=getConfig()?.answerLanguage||'en';
 $('coding-answer-language').onchange=async()=>{await preferences({answerLanguage:$('coding-answer-language').value});$('coding-answer-language').value=getConfig().answerLanguage;};
 const message=text=>{$('coding-status').textContent=text;};
 function controls(){for(const action of Object.keys(CODING_ACTIONS))$('coding-'+action).disabled=busy;$('coding-stop').hidden=!busy;}
 function fit(){if($('coding-panel').hidden)return;const height=Math.max(100,Math.min(420,innerHeight-feed.getBoundingClientRect().top-24)),value=height+'px';if(feed.style.maxHeight!==value)feed.style.maxHeight=value;}
 function scroll(){fit();if(follow)feed.scrollTop=feed.scrollHeight;$('coding-latest').hidden=follow;}
 feed.onscroll=()=>{follow=feed.scrollHeight-feed.clientHeight-feed.scrollTop<28;$('coding-latest').hidden=follow;};
 $('coding-latest').onclick=()=>{follow=true;scroll();};
 new ResizeObserver(()=>{fit();if(follow)feed.scrollTop=feed.scrollHeight;}).observe($('coding-panel'));
 window.addEventListener('resize',scroll);
 function fill(value){snapshot=value;if(!value)return;for(const field of ['statement','code','tests','language'])$('coding-'+field).value=value[field]||'';$('coding-source').textContent=value.source||'';$('coding-warning').textContent=value.warning||'';}
 function input(){return {...snapshot,statement:$('coding-statement').value,code:$('coding-code').value,tests:$('coding-tests').value,language:$('coding-language').value};}
 function entry(item){
  let row=items.get(item.id);
  if(!row){
   feed.querySelector('.coding-empty')?.remove();
   const node=document.createElement('article');node.className='coding-entry';node.dataset.id=String(item.id);
   const heading=document.createElement('div');heading.className='coding-entry-heading';
   const title=document.createElement('span');title.textContent=CODING_ACTIONS[item.action]||'Aide';
   const state=document.createElement('span');state.className='coding-entry-state';
   const copy=document.createElement('button');copy.className='text-button';copy.textContent='Copier';copy.onclick=()=>api.copy(row.item.text).catch(error=>message(error.message));
   heading.append(title,state,copy);node.append(heading);feed.append(node);
   row={node,state,item:{...item},blocks:new Map()};items.set(item.id,row);
   // Match the bounded in-memory export history.
   if(items.size>100){const first=items.keys().next().value;items.get(first).node.remove();items.delete(first);}
  }
  row.item={...row.item,...item};row.state.textContent={streaming:'…',done:'',error:'Incomplète',canceled:'Arrêtée'}[row.item.state]||'';
  for(const [key,text] of Object.entries(codingSections(row.item.text||''))){
   let block=row.blocks.get(key);
   if(!block){const section=document.createElement('section'),label=document.createElement('h2'),body=document.createElement(key==='CODE'?'pre':'div');label.textContent=labels[key];body.className=key==='CODE'?'coding-code-block':'coding-body';section.append(label,body);row.node.append(section);block={body};row.blocks.set(key,block);}
   if(key==='CODE')block.body.textContent=text.replace(/^```[^\n]*\n/,'').replace(/\n```$/,'');else renderAnswer(block.body,text);
  }
  if(row.item.error){let error=row.node.querySelector('.coding-entry-error');if(!error){error=document.createElement('p');error.className='coding-entry-error';row.node.append(error);}error.textContent=row.item.error;}
  scroll();return row;
 }
 function reset(){items.clear();snapshot=null;busy=false;follow=true;feed.replaceChildren();const hint=document.createElement('p');hint.className='coding-empty';hint.textContent='Ajoutez l’exercice, puis demandez une aide.';feed.append(hint);for(const field of ['statement','code','tests'])$('coding-'+field).value='';$('coding-source').textContent='';$('coding-warning').textContent='';$('coding-input').open=true;message('');controls();scroll();}
 api.onEvent(event=>{
  if(event.type==='preferences-changed')$('coding-answer-language').value=event.config.answerLanguage;
  if(!event.type.startsWith('coding-'))return;changed=true;
  if(event.type==='coding-start'){fill(event.snapshot);busy=true;show();$('coding-input').open=false;$('coding-browser').open=false;entry(event.item);message('Analyse…');controls();}
  if(event.type==='coding-delta'&&items.has(event.id))entry({id:event.id,text:event.text});
  if(['coding-done','coding-error','coding-canceled'].includes(event.type)){
   if(items.has(event.id))entry({id:event.id,state:event.type.slice(7),error:event.error});busy=false;message(event.error||'');controls();
  }
  if(event.type==='coding-cleared')reset();
 });
 for(const action of Object.keys(CODING_ACTIONS))$('coding-'+action).onclick=async()=>{if(busy)return;busy=true;controls();message('');try{await api.codingAnalyze(input(),action);}catch(error){busy=false;controls();message(error.message);}};
 $('coding-stop').onclick=()=>api.codingCancel().catch(error=>message(error.message));
 $('coding-clear').onclick=()=>api.codingClear().catch(error=>message(error.message));
 $('coding-tab').onclick=toggle;
 $('coding-pair').onclick=async()=>{try{await api.codingPair();$('coding-connection').textContent='Code copié. Collez-le dans l’extension Firefox.';}catch(error){$('coding-connection').textContent=error.message;}};
 $('coding-disconnect').onclick=async()=>{try{await api.codingDisconnect();$('coding-connection').textContent='Firefox déconnecté.';}catch(error){$('coding-connection').textContent=error.message;}};
 $('coding-extension').onclick=()=>api.codingExtension().catch(error=>{$('coding-connection').textContent=error.message;});
 try{const state=await api.codingState();if(!changed){fill(state.snapshot);for(const item of state.history)entry(item);busy=state.busy;if(state.history.length)$('coding-input').open=false;controls();}}catch(error){message(error.message);}
}
