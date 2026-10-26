// Streaming linear resampler. Position and last sample survive worklet quanta.
export class Resampler {
 constructor(from,to=24000){this.step=from/to;this.position=0;this.buffer=[];}
 push(input){this.buffer.push(...input);const out=[];while(this.position+1<this.buffer.length){const i=Math.floor(this.position),f=this.position-i;out.push(this.buffer[i]*(1-f)+this.buffer[i+1]*f);this.position+=this.step;}const used=Math.floor(this.position);this.buffer.splice(0,used);this.position-=used;return out;}
}
export function pcm16(samples){const out=new Int16Array(samples.length);for(let i=0;i<samples.length;i++){const s=Math.max(-1,Math.min(1,samples[i]));out[i]=Math.round(s*(s<0?32768:32767));}return out;}
