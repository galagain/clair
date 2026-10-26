import {parseSections} from './core.mjs';
import {answerLines,plainAnswer} from './answer-view.mjs';
// Compare text conservatively: never merge paraphrases, numbers or negations.
export const ideaKey=text=>plainAnswer(text).normalize('NFC').toLocaleLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().replace(/[.!?…]+$/u,'');
export function novelAnswer(text,previous=[],streaming=false){
 const sections=parseSections(text),answer=sections.REPONSE||'';
 if(/^Écoute en cours[.\s]*$/i.test(answer))return '';
 const seen=new Set(previous.map(ideaKey)),lines=answerLines(answer),result=[];
 const pending=streaming&&!text.includes('[[POINTS]]')&&!text.includes('[[PRECISION]]')&&!/\n\s*$/.test(text);
 for(let i=0;i<lines.length;i++){
  const key=ideaKey(lines[i]);if(!key||seen.has(key))continue;
  if(pending&&i===lines.length-1&&[...seen].some(old=>old.startsWith(key)))continue;
  result.push(lines[i]);seen.add(key);
 }
 return result.map(line=>'• '+line).join('\n');
}
// All answers remain in chronological order; selection only controls copying
// and the scroll position. It never replaces the visible conversation.
export class AnswerHistory {
 constructor(limit=500){this.limit=limit;this.clear();}
 clear(){this.items=[];this.follow=true;this.selectedId=null;this.epoch=0;}
 visible(){return this.items.filter(item=>item.answer);}
 current(){const list=this.visible();return this.follow?list.at(-1)||null:list.find(item=>item.id===this.selectedId)||list[0]||null;}
 start(event){
  this.cancel();
  const previous=event.manual?[]:this.visible().filter(item=>item.epoch===this.epoch&&item.language===event.language).slice(-4).flatMap(item=>answerLines(item.answer).filter(line=>item.state==='done'||/[.!?…]$/.test(plainAnswer(line))));
  this.items.push({id:event.id,text:'',answer:'',previous,question:event.text||'',language:event.language,draft:!!event.draft,epoch:this.epoch,state:'streaming',time:Date.now()});this.trim();
 }
 project(item){item.answer=novelAnswer(item.text,item.previous,item.state==='streaming');}
 update(event){const item=this.items.find(item=>item.id===event.id);if(!item||item.state!=='streaming')return;item.text=event.text;item.firstTokenMs=event.firstTokenMs;this.project(item);}
 finish(event,error=false){const item=this.items.find(item=>item.id===event.id);if(item?.state==='streaming'){item.state=error?'incomplete':'done';this.project(item);}}
 cancel(contextChanged=false){for(const item of this.items){if(item.state==='streaming')item.state='incomplete';if(contextChanged)item.oldContext=true;}if(contextChanged)this.epoch++;}
 hold(id=this.current()?.id){this.selectedId=id;this.follow=false;}
 resume(){this.follow=true;this.selectedId=null;}
 unread(){const list=this.visible();return this.follow?0:Math.max(0,list.length-1-list.findIndex(item=>item.id===this.current()?.id));}
 trim(){while(this.items.length>this.limit){const index=this.items.findIndex(item=>this.follow||item.id!==this.selectedId);this.items.splice(Math.max(0,index),1);}}
}
