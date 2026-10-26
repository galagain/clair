import {parseSections} from './core.mjs';
import {renderAnswer} from './answer-view.mjs';
export class AnswerFeed {
 constructor(element,history,onScroll){
  this.element=element;this.history=history;this.onScroll=onScroll;this.nodes=new Map();this.lastTop=0;
  element.addEventListener('scroll',()=>{
   if(!history.visible().length)return;
   // Ignore delayed events from our own scroll adjustment.
   if(Math.abs(element.scrollTop-this.lastTop)<1)return;
   this.lastTop=element.scrollTop;
   if(this.atBottom())history.resume();else history.hold(this.readingId());
   onScroll();
  });
  this.resizeObserver=new ResizeObserver(()=>this.fit());this.resizeObserver.observe(document.body);
  window.addEventListener('resize',()=>this.fit());
 }
 fit(){
  if(!this.element.getClientRects().length)return;
  const available=innerHeight-this.element.getBoundingClientRect().top-scrollY-24;
  const cap=document.body.classList.contains('compact')?180:300,value=Math.max(80,Math.min(cap,available))+'px';
  if(this.element.style.maxHeight===value)return;
  this.element.style.maxHeight=value;
  if(this.history.follow)this.element.scrollTop=this.element.scrollHeight;
  this.lastTop=this.element.scrollTop;
 }
 atBottom(){return this.element.scrollHeight-this.element.scrollTop-this.element.clientHeight<24;}
 readingId(){const edge=this.element.getBoundingClientRect().top;return [...this.nodes].find(([,entry])=>entry.node.getBoundingClientRect().bottom>edge+2)?.[0];}
 clear(){this.nodes.clear();this.element.replaceChildren();this.element.scrollTop=0;this.lastTop=0;}
 resume(){this.history.resume();this.element.scrollTop=this.element.scrollHeight;this.lastTop=this.element.scrollTop;this.onScroll();}
 render(){
  this.fit();
  const follow=this.history.follow,top=this.element.scrollTop,anchor=this.nodes.get(this.readingId())?.node,offset=anchor?.getBoundingClientRect().top;
  const items=this.history.visible();
  if(items.length&&!this.nodes.size){this.element.replaceChildren();this.element.classList.remove('placeholder');}
  for(const item of items){
   let entry=this.nodes.get(item.id);
   if(!entry){
    const node=document.createElement('article');node.className='answer-entry';node.dataset.id=item.id;
    const state=document.createElement('div');state.className='answer-entry-state';
    const body=document.createElement('div');body.className='answer-body';body.dir='auto';
    const details=document.createElement('details');details.className='answer-details';const summary=document.createElement('summary');summary.textContent='Quelques repères';const extra=document.createElement('div');extra.className='answer-extra';details.append(summary,extra);node.append(state,body,details);this.element.append(node);
    entry={node,state,body,details,extra};this.nodes.set(item.id,entry);
   }
   if(entry.answer!==item.answer){renderAnswer(entry.body,item.answer);entry.answer=item.answer;}
   const label=item.oldContext?'Contexte précédent':item.draft?'Provisoire':item.state==='incomplete'?'Interrompu':'';if(entry.state.textContent!==label)entry.state.textContent=label;entry.state.hidden=!label;
   const sections=parseSections(item.text),extra=[sections.POINTS,sections.PRECISION].filter(Boolean).join('\n');
   if(entry.extra.textContent!==extra)entry.extra.textContent=extra;entry.details.hidden=!extra;
  }
  const ids=new Set(items.map(item=>item.id));for(const [id,entry] of this.nodes)if(!ids.has(id)){entry.node.remove();this.nodes.delete(id);}
  if(follow)this.element.scrollTop=this.element.scrollHeight;else{this.element.scrollTop=top;if(anchor?.isConnected)this.element.scrollTop+=anchor.getBoundingClientRect().top-offset;}
  this.lastTop=this.element.scrollTop;
 }
}
