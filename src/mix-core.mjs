import {Resampler} from './audio-core.mjs';
// Both sources are clocked by the AudioWorklet. Drop old backlog instead of
// letting a headset change or a stalled renderer add seconds of latency.
export class AudioMixer {
 constructor(){this.reset();}
 reset(){this.queue=[];this.offset=0;this.rate=0;this.resampler=null;}
 push(samples,rate){
  if(this.rate!==rate){this.reset();this.rate=rate;this.resampler=new Resampler(rate,24000);}
  const data=rate===24000?Array.from(samples):this.resampler.push(samples);
  if(this.offset){this.queue=this.queue.slice(this.offset);this.offset=0;}
  this.queue.push(...data);
  if(this.queue.length>12000)this.queue=this.queue.slice(-4800);
 }
 mix(microphone){
  const out=new Float32Array(microphone.length);let systemEnergy=0,micEnergy=0;
  for(let i=0;i<out.length;i++){
   const system=this.offset<this.queue.length?this.queue[this.offset++]:0;
   const mic=microphone[i]||0;
   const a=Number.isFinite(system)?system:0,b=Number.isFinite(mic)?mic:0;
   // Preserve quiet speech; clamp simultaneous peaks instead of halving both.
   out[i]=Math.max(-1,Math.min(1,a+b));systemEnergy+=a*a;micEnergy+=b*b;
  }
  return {samples:out,systemRms:Math.sqrt(systemEnergy/out.length)||0,micRms:Math.sqrt(micEnergy/out.length)||0};
 }
}
