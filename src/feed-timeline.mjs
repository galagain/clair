// Final passages are published once, in audio order. Later completions wait
// behind unfinished predecessors. Only the live tail may still be corrected.
export class FeedTimeline {
 constructor(limit=500){this.limit=limit;this.clear();}
 clear(){this.history=[];this.pending=[];this.items=new Map();this.published=new Set();}
 ensure(id){if(this.published.has(id))return null;let item=this.items.get(id);if(!item){item={id,text:'',final:false,speaker:null};this.items.set(id,item);this.pending.push(item);}return item;}
 order(ids){
  for(const id of ids)this.ensure(id);
  const rank=new Map(ids.map((id,index)=>[id,index]));
  this.pending.sort((a,b)=>(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity));
  this.drain();
 }
 update(event){const item=this.ensure(event.id);if(!item||item.final)return;item.text=String(event.text??'');item.final=!!event.final;if(event.speaker!==undefined)item.speaker=event.speaker;this.drain();}
 speaker(id,speaker){const item=this.items.get(id);if(item)item.speaker=speaker;}
 discard(id){const item=this.items.get(id);if(item){item.text='';item.final=true;this.drain();}else this.published.add(id);}
 drain(){while(this.pending[0]?.final){const item=this.pending.shift();this.items.delete(item.id);this.published.add(item.id);if(item.text){this.history.push({...item});if(this.history.length>this.limit)this.history.shift();}}}
 interrupt(){for(const item of this.pending){item.incomplete=!item.final;item.final=true;}this.drain();}
 get live(){return this.pending[0]?.text?this.pending[0]:null;}
}
