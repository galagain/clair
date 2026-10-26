const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
export function resetDelay(value){
 if(typeof value!=='string'||!/^\s*(?:\d+(?:\.\d+)?(?:ms|s|m|h))+\s*$/.test(value))return null;
 return [...value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)].reduce((sum,[,n,unit])=>sum+Number(n)*({ms:1,s:1000,m:60000,h:3600000}[unit]),0);
}
export function tokenRate(headers,model,now=Date.now()){
 const candidates=[];
 for(const scope of ['', 'project-']){
  const raw=headers?.get?.('x-ratelimit-remaining-'+scope+'tokens');
  if(raw==null||!/^\d+$/.test(raw))continue;
  const remaining=count(Number(raw));if(remaining===null)continue;
  const reset=resetDelay(headers.get('x-ratelimit-reset-'+scope+'tokens'));
  candidates.push({remaining,model,scope:scope?'projet':'modèle',observedAt:now,expiresAt:now+Math.min(reset??60000,60000)});
 }
 return candidates.sort((a,b)=>a.remaining-b.remaining)[0]||null;
}
// Usage is confirmed by provider reports, never estimated from visible text.
// A request cancelled before its usage arrives makes the total incomplete.
export class TokenUsage {
 constructor(changed=()=>{}){this.changed=changed;this.reset();}
 reset(){this.epoch=(this.epoch||0)+1;this.inputTokens=0;this.outputTokens=0;this.otherTokens=0;this.durationSeconds=0;this.pending=0;this.missing=0;this.rates=new Map();}
 record(usage){
  if(usage?.type==='duration'&&Number.isFinite(usage.seconds)&&usage.seconds>=0){this.durationSeconds+=usage.seconds;this.changed();return;}
  const input=count(usage?.input_tokens),output=count(usage?.output_tokens),total=count(usage?.total_tokens);
  if(input!==null&&output!==null){this.inputTokens+=input;this.outputTokens+=output;}
  else if(total!==null)this.otherTokens+=total;
  else this.missing++;
  this.changed();
 }
 begin(){
  const epoch=this.epoch;let reported=false,finished=false;this.pending++;this.changed();
  return {report:usage=>{if(epoch!==this.epoch||reported||finished)return;reported=true;this.record(usage);},finish:()=>{if(epoch!==this.epoch||finished)return;finished=true;this.pending--;if(!reported)this.missing++;this.changed();}};
 }
 headers(headers,model){this.rates.set(model,tokenRate(headers,model));this.changed();}
 snapshot(model,now=Date.now()){
  const rate=this.rates.get(model);
  return {inputTokens:this.inputTokens,outputTokens:this.outputTokens,totalTokens:this.inputTokens+this.outputTokens+this.otherTokens,durationSeconds:this.durationSeconds,pendingUsage:this.pending,missingUsage:this.missing,tokenRate:rate&&rate.expiresAt>now?rate:null};
 }
}
