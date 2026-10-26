// Each attempt owns its resources, including when macOS answers a picker late.
export class AudioCapture {
 constructor({mediaDevices,AudioContextImpl,WorkletImpl,native=null}) {
  this.native=native;this.devices=mediaDevices;this.Context=AudioContextImpl;this.Worklet=WorkletImpl;this.current=null;
 }
 async open(source,callbacks) {
  if(source==='auto')return this.openAutomatic(callbacks);
  const {onChunk,onEnded}=callbacks;
  this.stop();const attempt={};this.current=attempt;
  const valid=()=>this.current===attempt;
  try {
   const stream=source==='system'
    ?await this.devices.getDisplayMedia({audio:true,systemAudio:'include',video:{width:320,height:180,frameRate:1}})
    :await this.devices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:true,autoGainControl:true}});
   attempt.stream=stream;
   if(!valid()){this.release(attempt);return false;}
   const tracks=stream.getAudioTracks();
   if(!tracks.length||tracks.some(t=>t.readyState==='ended'))throw Error('Aucune piste audio active. Autorisez Clair dans Réglages Système → Confidentialité et sécurité → Enregistrement de l’écran et de l’audio système, puis quittez et rouvrez Clair.');
   stream.getTracks().forEach(t=>t.addEventListener('ended',()=>{if(valid()){this.stop();onEnded();}}));
   stream.getVideoTracks().forEach(t=>{t.enabled=false;});
   const context=attempt.context=new this.Context({sampleRate:24000});
   await context.audioWorklet.addModule(new URL('./pcm-worklet.js',import.meta.url));
   if(!valid())return false;
   attempt.source=context.createMediaStreamSource(new MediaStream(tracks));
   attempt.processor=new this.Worklet(context,'clair-capture',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
   attempt.source.connect(attempt.processor);attempt.processor.connect(context.destination);
   attempt.processor.port.onmessage=e=>{if(valid())onChunk(e.data.audio||e.data,e.data);};
   await context.resume();return valid();
  } catch(error) {
   if(!valid())return false;
   this.stop();throw error;
  }
 }
 async openAutomatic({onChunk,onEnded,onStatus=()=>{}}) {
  this.stop();const attempt={id:crypto.randomUUID()};this.current=attempt;
  const valid=()=>this.current===attempt;
  try{
   const context=attempt.context=new this.Context({sampleRate:24000});
   await context.audioWorklet.addModule(new URL('./pcm-worklet.js',import.meta.url));if(!valid())return false;
   const processor=attempt.processor=new this.Worklet(context,'clair-capture',{numberOfInputs:2,numberOfOutputs:1,outputChannelCount:[1]});
   processor.connect(context.destination);processor.port.onmessage=e=>{if(valid())onChunk(e.data.audio,e.data);};
   // An active silent source keeps the worklet clock running with no microphone.
   attempt.silence=context.createConstantSource();attempt.silence.offset.value=0;attempt.silence.connect(processor);attempt.silence.start();
   if(this.native){
    attempt.native=this.native;
    attempt.unsubscribe=this.native.subscribe(e=>{
     if(!valid()||e.id!==attempt.id)return;
     if(e.type==='system-audio')processor.port.postMessage({type:'system',samples:e.samples,sampleRate:e.sampleRate});
     if(e.type==='system-reset')processor.port.postMessage({type:'reset'});
     if(e.type==='system-error'){this.stop();onEnded(e.text);}
     if(e.type==='system-device')onStatus('Casque / sortie audio mis à jour');
    });
    await this.native.start(attempt.id);if(!valid())return false;
   }else{
    const stream=await this.devices.getDisplayMedia({audio:true,systemAudio:'include',video:{width:320,height:180,frameRate:1}});
    if(!valid()){stream.getTracks().forEach(t=>t.stop());return false;}
    attempt.stream=stream;const tracks=stream.getAudioTracks();
    if(!tracks.length||tracks.some(t=>t.readyState==='ended'))throw Error('Autorisez le son système dans les réglages de confidentialité.');
    stream.getVideoTracks().forEach(t=>{t.enabled=false;});
    attempt.source=context.createMediaStreamSource(new MediaStream(tracks));attempt.source.connect(processor,0,1);
    tracks.forEach(t=>t.addEventListener('ended',()=>{if(valid()){this.stop();onEnded();}}));
   }
   const microphone=async()=>{
    const serial=attempt.micSerial=(attempt.micSerial||0)+1;
    try{
     const stream=await this.devices.getUserMedia({audio:{deviceId:'default',echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
     if(!valid()||serial!==attempt.micSerial){stream.getTracks().forEach(t=>t.stop());return;}
     const tracks=stream.getAudioTracks();if(!tracks.length||tracks.some(t=>t.readyState==='ended')){stream.getTracks().forEach(t=>t.stop());throw Error('Microphone indisponible');}
     attempt.micNode?.disconnect();attempt.microphone?.getTracks().forEach(t=>t.stop());
     attempt.microphone=stream;attempt.micNode=context.createMediaStreamSource(stream);attempt.micNode.connect(processor);
     tracks.forEach(t=>t.addEventListener('ended',attempt.deviceChange));onStatus('Audio automatique · ordinateur + micro');
    }catch{
     if(!valid()||serial!==attempt.micSerial)return;
     attempt.micNode?.disconnect();attempt.micNode=null;attempt.microphone?.getTracks().forEach(t=>t.stop());attempt.microphone=null;
     onStatus('Son de l’ordinateur uniquement · micro indisponible ou non autorisé');
    }
   };
   attempt.deviceChange=()=>{clearTimeout(attempt.deviceTimer);attempt.deviceTimer=setTimeout(()=>{if(valid())void microphone();},300);};
   this.devices.addEventListener?.('devicechange',attempt.deviceChange);
   await microphone();if(!valid())return false;
   await context.resume();return valid();
  }catch(error){if(!valid())return false;this.stop();throw error;}
 }
 release(attempt){
  clearTimeout(attempt.deviceTimer);
  if(attempt.deviceChange)this.devices.removeEventListener?.('devicechange',attempt.deviceChange);
  attempt.unsubscribe?.();if(attempt.native)void attempt.native.stop(attempt.id).catch(()=>{});
  attempt.micNode?.disconnect();attempt.microphone?.getTracks().forEach(t=>t.stop());
  if(attempt.silence){attempt.silence.stop();attempt.silence.disconnect();}
  if(attempt.processor){attempt.processor.port.onmessage=null;attempt.processor.disconnect();}
  attempt.source?.disconnect();attempt.stream?.getTracks().forEach(t=>t.stop());
  if(attempt.context)void attempt.context.close().catch(()=>{});
 }
 stop(){const attempt=this.current;this.current=null;if(attempt)this.release(attempt);}
}
