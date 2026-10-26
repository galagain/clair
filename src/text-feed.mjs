import {FeedTimeline} from './feed-timeline.mjs';
const sourceOf=speaker=>speaker==='microphone'||speaker==='system'?speaker:'unknown';
const sourceLabel={microphone:'Micro',system:'Son de l’ordinateur',unknown:'Source indéterminée'};
// Completed DOM nodes never move or change. Draft text has its own tail below
// the history, so a late final cannot overwrite a sentence already published.
export class TextFeed {
 constructor(element,resume,{empty='En attente de parole.',limit=500}={}){this.element=element;this.resume=resume;this.empty=empty;this.timeline=new FeedTimeline(limit);this.element.addEventListener('scroll',()=>{this.follow=this.atBottom();this.sync();});this.resume.onclick=()=>this.live();this.clear();}
 atBottom(){return this.element.scrollHeight-this.element.scrollTop-this.element.clientHeight<24;}
 sync(){this.resume.hidden=this.follow||(!this.timeline.history.length&&!this.timeline.live);}
 live(){this.follow=true;this.element.scrollTop=this.element.scrollHeight;this.sync();}
 clear(){this.timeline.clear();this.nodes=new Map();this.lastSpeaker=null;this.paragraph=null;this.draft=null;this.element.replaceChildren();this.element.textContent=this.empty;this.element.classList.add('placeholder');this.follow=true;this.sync();}
 change(fn){
  const follow=this.follow,top=this.element.scrollTop,edge=this.element.getBoundingClientRect().top;
  const anchor=[...this.nodes.values()].find(node=>node.getBoundingClientRect().bottom>edge);
  const offset=anchor?.getBoundingClientRect().top;
  fn();this.render();
  if(follow)this.live();else{this.element.scrollTop=top;if(anchor?.isConnected)this.element.scrollTop+=anchor.getBoundingClientRect().top-offset;this.follow=false;this.sync();}
 }
 update(event){this.change(()=>this.timeline.update(event));}
 order(ids){this.change(()=>this.timeline.order(ids));}
 speaker(id,speaker){this.change(()=>this.timeline.speaker(id,speaker));}
 discard(id){this.change(()=>this.timeline.discard(id));}
 markIncomplete(){this.change(()=>this.timeline.interrupt());}
 render(){
  const history=this.timeline.history,live=this.timeline.live;
  if((history.length||live)&&this.element.classList.contains('placeholder')){this.element.replaceChildren();this.element.classList.remove('placeholder');}
  for(const item of history){
   if(this.nodes.has(item.id))continue;
   const source=sourceOf(item.speaker);
   if(!this.paragraph||source!==this.lastSpeaker){
    this.paragraph=document.createElement('p');this.paragraph.className='feed-paragraph';this.paragraph.dir='auto';this.element.insertBefore(this.paragraph,this.draft);
    this.paragraph.dataset.source=source;this.paragraph.setAttribute('aria-description',sourceLabel[source]);
   }
   if(this.paragraph.childNodes.length)this.paragraph.append(document.createTextNode(' '));
   const node=document.createElement('span');node.className='feed-text';node.textContent=item.text;
   if(item.incomplete){node.classList.add('incomplete');node.title='Interrompu';}
   this.paragraph.append(node);this.nodes.set(item.id,node);this.lastSpeaker=source;
  }
  const retained=new Set(history.map(item=>item.id));
  for(const [id,node] of this.nodes)if(!retained.has(id)){const p=node.parentNode;if(node.nextSibling?.nodeType===3)node.nextSibling.remove();node.remove();this.nodes.delete(id);if(!p.childNodes.length)p.remove();}
  if(live){
   if(!this.draft){this.draft=document.createElement('div');this.draft.className='feed-live';this.draft.dir='auto';this.draft.setAttribute('aria-label','Transcription en cours');const node=document.createElement('span');node.className='feed-text partial';this.draft.append(node);this.element.append(this.draft);}
   this.draft.dataset.source=sourceOf(live.speaker);this.draft.setAttribute('aria-label','Transcription en cours · '+sourceLabel[this.draft.dataset.source]);
   if(this.draft.firstChild.textContent!==live.text)this.draft.firstChild.textContent=live.text;
  }else if(this.draft){this.draft.remove();this.draft=null;}
 }
}
