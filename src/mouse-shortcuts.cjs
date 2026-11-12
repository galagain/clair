const {spawn}=require('node:child_process');
const FUNCTION_KEYS={122:'F1',120:'F2',99:'F3',118:'F4',96:'F5',97:'F6',98:'F7',100:'F8',101:'F9',109:'F10',103:'F11',111:'F12',105:'F13',107:'F14',113:'F15',106:'F16',64:'F17',79:'F18',80:'F19',90:'F20'};
function binding(value){
 if(value==null)return null;
 if(!Number.isInteger(value.modifiers)||value.modifiers<0||value.modifiers>15)throw Error('Raccourci invalide.');
 if(Object.hasOwn(value,'keyCode')){
  if(Object.hasOwn(value,'button')||!Number.isInteger(value.keyCode)||value.keyCode<0||value.keyCode>127||(!(value.modifiers&14)&&!FUNCTION_KEYS[value.keyCode]))throw Error('Utilisez une touche F ou maintenez ⌘, ⌥ ou ⌃ avec une touche.');
  if(value.modifiers===0&&[122,120].includes(value.keyCode))throw Error('F1 et F2 sont réservées aux modes Discours/Pistes et Code.');
  return {keyCode:value.keyCode,modifiers:value.modifiers,keyLabel:FUNCTION_KEYS[value.keyCode]||String(value.keyLabel||'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,24)};
 }
 if(!Number.isInteger(value.button)||value.button<0||value.button>31)throw Error('Bouton de souris invalide.');
 if(value.button===0&&!value.modifiers)throw Error('Pour le clic gauche, maintenez aussi ⌥, ⌃, ⇧ ou ⌘.');return {button:value.button,modifiers:value.modifiers};
}
const bindingId=value=>(Object.hasOwn(value,'keyCode')?'key:'+value.keyCode:'mouse:'+value.button)+':'+value.modifiers;

function configuration(raw={}){
 const list=action=>{const old=raw.bindings?.[action];return (Array.isArray(old)?old:old==null?[]:[old]).map(value=>{const result=binding(value);if(!result)throw Error('Raccourci invalide.');return result;});};
 const firefox=list('firefox'),firefoxVisual=list('firefoxVisual');
 if(firefox.length+firefoxVisual.length>12)throw Error('12 raccourcis Firefox maximum.');
 const background=binding(raw.bindings?.background),seen=new Set(background?[bindingId(background)]:[]);
 for(const item of [...firefox,...firefoxVisual]){const key=bindingId(item);if(seen.has(key))throw Error('Choisissez des boutons ou combinaisons différents.');seen.add(key);}
 return {enabled:raw.enabled===true,bindings:{background,firefox,firefoxVisual}};
}
class MouseShortcuts {
 constructor({executable,emit,action,save=async()=>{},spawnImpl=spawn,available=process.platform==='darwin'}){Object.assign(this,{executable,emit,action,save,spawn:spawnImpl,available});this.config=configuration();this.status='off';this.child=null;this.learning=null;this.last=null;this.queue=Promise.resolve();this.revision=0;}
 state(){return {...this.config,available:this.available,status:this.status,learning:this.learning,last:this.last};}
 notify(message=''){this.emit({type:'mouse-state',...this.state(),message});}
 write(){if(this.child&&!this.child.stdin.destroyed)this.child.stdin.write(JSON.stringify({...this.config,learning:!!this.learning,learningKeys:!!this.learning})+'\n');}
 async enable(enabled,request=false){if(!this.available)throw Error('Les boutons globaux sont disponibles sur Mac.');const revision=++this.revision;this.config={...this.config,enabled:!!enabled};await this.save(this.config);if(revision!==this.revision)return this.state();if(!enabled){this.stop();return this.state();}if(this.child)return this.state();this.launch(request);return this.state();}
 launch(request){this.status='starting';const child=this.spawn(this.executable,request?['--request']:[],{stdio:['pipe','pipe','pipe']});this.child=child;let pending='';child.stdin.on('error',()=>{});child.stderr.on('data',()=>{});this.notify();
  child.stdout.on('data',chunk=>{if(this.child!==child)return;pending+=chunk.toString();if(pending.length>65536){this.fail('Flux souris invalide.');return;}let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);let event;try{event=JSON.parse(line);}catch{this.fail('Flux souris invalide.');return;}this.event(event);}});
  child.on('error',()=>{if(this.child===child)this.fail('Module souris indisponible. Réinstallez Clair.');});child.on('exit',()=>{if(this.child===child){this.child=null;this.cancelLearn();if(this.status!=='permission')this.status='off';this.notify();}});
 }
 event(event){
  if(event.type==='ready'){this.status='ready';this.write();this.notify();return;}
  if(event.type==='permission'){this.status='permission';this.notify(String(event.message||'Autorisation Accessibilité nécessaire.').slice(0,240));return;}
  if(event.type==='learn-canceled'){this.cancelLearn();this.write();this.notify('Choix annulé.');return;}
  if(['button','key'].includes(event.type)){
   if(event.type==='key'&&(!this.learning||!event.learning))return;
   let selected;try{selected=binding(event.type==='key'?{keyCode:event.keyCode,modifiers:event.modifiers,keyLabel:event.keyLabel}:{button:event.button,modifiers:event.modifiers});}catch{return;}
   this.last=selected;
   if(this.learning&&event.learning){const action=this.learning,selected={...this.last},revision=this.revision;this.cancelLearn();this.queue=this.queue.then(async()=>{if(revision!==this.revision)return;try{const next=configuration({...this.config,bindings:{...this.config.bindings,[action]:action!=='background'?[...this.config.bindings[action],selected]:selected}});await this.save(next);if(revision!==this.revision)return;this.config=next;this.write();this.notify('Enregistré.');}catch(error){this.write();this.notify(error.message);}});}
   else this.notify();return;
  }
  if(event.type==='action'&&this.config.enabled&&!this.learning&&this.status==='ready'&&['background','firefox','firefoxVisual'].includes(event.action)){if(event.action==='background')this.action('background');else this.notify(event.sent?'Raccourci envoyé à Firefox.':'Ouvrez Firefox au premier plan.');}
 }
 learn(action){if(!['background','firefox','firefoxVisual'].includes(action))throw Error('Action inconnue.');if(this.status!=='ready')throw Error('Activez d’abord la détection et autorisez Clair.');this.cancelLearn();this.revision++;this.learning=action;this.write();this.notify('Appuyez sur un bouton ou un raccourci clavier (10 s).');this.timer=setTimeout(()=>{this.cancelLearn();this.write();this.notify('Choix annulé.');},10000);return this.state();}
 cancelLearn(){clearTimeout(this.timer);this.learning=null;}
 async forget(action,index){if(!['background','firefox','firefoxVisual'].includes(action))throw Error('Action inconnue.');if(index!==undefined&&(action==='background'||!Number.isInteger(index)||index<0||index>=this.config.bindings[action].length))throw Error('Association inconnue.');this.cancelLearn();const revision=++this.revision;const next=configuration({...this.config,bindings:{...this.config.bindings,[action]:action!=='background'?(index===undefined?[]:this.config.bindings[action].filter((_,i)=>i!==index)):null}});await this.save(next);if(revision!==this.revision)return this.state();this.config=next;this.write();this.notify();return this.state();}
 fail(message){this.stop();this.notify(message);}
 stop(){this.revision++;this.cancelLearn();const child=this.child;this.child=null;if(child){child.stdin.end();child.kill();}this.status='off';this.notify();}
}
module.exports={MouseShortcuts,mouseConfiguration:configuration};
