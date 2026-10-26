import {Resampler,pcm16} from './audio-core.mjs';
import {AudioMixer} from './mix-core.mjs';
class Capture extends AudioWorkletProcessor {
 constructor(){super();this.resampler=new Resampler(sampleRate,24000);this.systemResampler=new Resampler(sampleRate,24000);this.pending=[];this.mixer=new AudioMixer();this.levelFrames=0;this.systemPeak=0;this.micPeak=0;
  this.port.onmessage=({data})=>{if(data.type==='system')this.mixer.push(new Float32Array(data.samples),data.sampleRate);if(data.type==='reset')this.mixer.reset();};
 }
 process(inputs,outputs){
  const channels=inputs[0]||[];const size=outputs[0]?.[0]?.length||128;
  const mono=new Float32Array(size);
  for(const ch of channels)for(let i=0;i<mono.length;i++)mono[i]+=ch[i]/channels.length;
  const systemChannels=inputs[1]||[];
  if(systemChannels.length){const system=new Float32Array(size);for(const channel of systemChannels)for(let i=0;i<size;i++)system[i]+=channel[i]/systemChannels.length;this.mixer.push(this.systemResampler.push(system),24000);}
  const mixed=this.mixer.mix(this.resampler.push(mono));
  this.pending.push(...mixed.samples);this.systemPeak=Math.max(this.systemPeak,mixed.systemRms);this.micPeak=Math.max(this.micPeak,mixed.micRms);
  while(this.pending.length>=2400){const audio=pcm16(this.pending.splice(0,2400));this.port.postMessage({type:'audio',audio:audio.buffer,systemRms:this.systemPeak,micRms:this.micPeak},[audio.buffer]);this.systemPeak=0;this.micPeak=0;}
  // Never play back the mix: the original system sound stays in the headset.
  for(const ch of outputs[0]||[])ch.fill(0);return true;
 }
}
registerProcessor('clair-capture',Capture);
