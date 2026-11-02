const label=value=>value?`${value.modifiers&8?'⌘ ':''}${value.modifiers&4?'⌥ ':''}${value.modifiers&2?'⌃ ':''}${value.modifiers&1?'⇧ ':''}${value.button===0?'Clic gauche':value.button===1?'Clic droit':value.button===2?'Molette':`Bouton ${value.button+1}`}`:'Aucun';
export async function installMouse(api){const $=id=>document.getElementById(id);let current;
 function render(value){current=value;$('mouse-enable').textContent=['ready','starting'].includes(value.status)?'Désactiver':'Activer';$('mouse-enable').disabled=!value.available;$('mouse-permissions').hidden=!value.available;$('mouse-last').textContent=value.last?'Détecté : '+label(value.last):'';for(const action of ['background','firefox']){$('mouse-'+action).textContent=value.learning===action?'Appuyez…':label(value.bindings[action]);$('mouse-'+action).disabled=value.status!=='ready';$('mouse-forget-'+action).disabled=!value.bindings[action];}$('mouse-result').textContent=value.message||(value.status==='permission'?'Autorisez Clair dans Accessibilité, puis réactivez.':value.status==='ready'?'Détection active.':value.available?'':'Disponible sur Mac.');}
 async function run(fn){try{render(await fn());}catch(error){$('mouse-result').textContent=error.message;}}
 $('mouse-enable').onclick=()=>run(()=>api.mouseEnable(!['ready','starting'].includes(current.status)));
 $('mouse-permissions').onclick=()=>api.mousePermissions();
 for(const action of ['background','firefox']){$('mouse-'+action).onclick=()=>run(()=>api.mouseLearn(action));$('mouse-forget-'+action).onclick=()=>run(()=>api.mouseForget(action));}
 api.onEvent(event=>{if(event.type==='mouse-state')render(event);});render(await api.mouseState());
}
