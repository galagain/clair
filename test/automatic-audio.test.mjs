import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {AudioMixer} from '../src/mix-core.mjs';
import {AudioCapture} from '../src/capture.mjs';
import {NativeSystemAudio} from '../src/native-audio.cjs';
import {normalizeConfig} from '../src/core.mjs';
test('Old source preferences migrate to automatic audio',()=>{for(const source of ['mic','system',undefined])assert.equal(normalizeConfig({source}).source,'auto');});
test('Mixer contains both system and microphone speech and clamps overlapping peaks',()=>{
 const m=new AudioMixer();m.push(new Float32Array([.2,.8,-.8]),24000);
 const out=m.mix(new Float32Array([.3,.8,-.8]));assert.ok(Math.abs(out.samples[0]-.5)<1e-6);assert.equal(out.samples[1],1);assert.equal(out.samples[2],-1);assert.ok(out.micRms>0&&out.systemRms>0);
});
test('System resampling stays continuous across input packets and reset clears stale audio',()=>{
 const m=new AudioMixer();for(let i=0;i<10;i++)m.push(new Float32Array(480).fill(.25),48000);
 const out=m.mix(new Float32Array(2399));assert.ok(out.samples.every(n=>Math.abs(n-.25)<1e-6));m.reset();assert.ok(m.mix(new Float32Array(100)).samples.every(n=>n===0));
});
test('Audio backlog is bounded and nonfinite samples cannot poison the mix',()=>{
 const m=new AudioMixer();m.push(new Float32Array(30000).fill(.2),24000);assert.ok(m.queue.length<=12000);m.reset();m.push(new Float32Array([NaN,Infinity]),24000);assert.deepEqual([...m.mix(new Float32Array([.1,.2])).samples],[Math.fround(.1),Math.fround(.2)]);
});
function fixture(){
 const tracks=[];const listeners=new Map();let nativeCallback,starts=0,stops=0,permission;
 const stream=()=>{const t={readyState:'live',stop(){this.readyState='ended';},addEventListener(){}};tracks.push(t);return{getTracks:()=>[t],getAudioTracks:()=>[t]};};
 const node=()=>({connect(){},disconnect(){}});
 class Context {audioWorklet={addModule:async()=>{}};destination={};createMediaStreamSource(){return node();}createConstantSource(){return{...node(),offset:{value:0},start(){},stop(){}};}async resume(){}async close(){}}
 class Worklet {port={postMessage(){},onmessage:null};connect(){}disconnect(){}}
 const native={start:async()=>{starts++;},stop:async()=>{stops++;},subscribe:f=>{nativeCallback=f;return()=>{nativeCallback=null;};}};
 const devices={getDisplayMedia(){assert.fail('No display picker is allowed on native Mac capture');},getUserMedia:async()=>permission?await permission:stream(),addEventListener:(type,f)=>listeners.set(type,f),removeEventListener:type=>listeners.delete(type)};
 const capture=new AudioCapture({mediaDevices:devices,AudioContextImpl:Context,WorkletImpl:Worklet,native});
 return{capture,native,devices,tracks,stream,listeners,setPermission:p=>permission=p,counts:()=>({starts,stops}),emit:e=>nativeCallback?.(e)};
}
test('Automatic Mac capture starts the native tap and default microphone without requesting display media',async()=>{
 const f=fixture(),status=[];assert.equal(await f.capture.open('auto',{onChunk(){},onEnded(){},onStatus:t=>status.push(t)}),true);
 assert.equal(f.counts().starts,1);assert.equal(f.tracks.length,1);assert.ok(status.at(-1).includes('ordinateur + micro'));f.capture.stop();assert.equal(f.tracks[0].readyState,'ended');assert.equal(f.counts().stops,1);assert.equal(f.listeners.size,0);
});
test('Microphone refusal keeps system audio working and visibly reports degraded capture',async()=>{
 const f=fixture(),status=[];f.devices.getUserMedia=async()=>{throw Error('denied');};
 assert.equal(await f.capture.open('auto',{onChunk(){},onEnded(){},onStatus:t=>status.push(t)}),true);assert.match(status.at(-1),/micro indisponible/);f.capture.stop();
});
test('Cancellation while microphone permission is pending closes native capture and releases a late microphone',async()=>{
 const f=fixture();let resolve;f.setPermission(new Promise(r=>resolve=r));const opening=f.capture.open('auto',{onChunk(){},onEnded(){}});
 await new Promise(r=>setImmediate(r));f.capture.stop();resolve(f.stream());assert.equal(await opening,false);assert.equal(f.tracks[0].readyState,'ended');assert.equal(f.counts().stops,1);
});
test('A default input device change reacquires the microphone and closes the old input',async()=>{
 const f=fixture();await f.capture.open('auto',{onChunk(){},onEnded(){}});f.listeners.get('devicechange')();await new Promise(r=>setTimeout(r,350));assert.equal(f.tracks.length,2);assert.equal(f.tracks[0].readyState,'ended');assert.equal(f.tracks[1].readyState,'live');f.capture.stop();
});
function nativeFixture(){const children=[],events=[];const n=new NativeSystemAudio({executable:'/test/helper',emit:e=>events.push(e),spawnImpl:()=>{const c=new EventEmitter();c.stdin=new PassThrough();c.stdout=new PassThrough();c.stderr=new PassThrough();c.exitCode=null;c.signalCode=null;c.kill=signal=>{c.signalCode=signal;queueMicrotask(()=>c.emit('exit',null,signal));};children.push(c);return c;}});return{n,children,events};}
test('Native bridge parses split packets and never forwards an old capture after stop',async()=>{
 const {n,children,events}=nativeFixture();const opening=n.start('a'),child=children[0];child.stdout.write('{"type":"rea');child.stdout.write('dy"}\n');await opening;
 child.stdout.write(JSON.stringify({type:'audio',sampleRate:48000,data:Buffer.from(new Float32Array([.25]).buffer).toString('base64')})+'\n');assert.equal(events.at(-1).type,'system-audio');
 n.stop('a');const count=events.length;child.stdout.write('{"type":"error","message":"old"}\n');assert.equal(events.length,count);
});
test('Native start cancels cleanly and an obsolete stop cannot kill a replacement',async()=>{
 const {n,children}=nativeFixture();const first=n.start('a');const rejected=assert.rejects(first,/annulée/);const next=n.start('b');await rejected;n.stop('a');children[1].stdout.write('{"type":"ready"}\n');await next;assert.equal(n.current.id,'b');n.stop();
});
test('Malformed native packets reject startup and terminate the helper',async()=>{
 const {n,children}=nativeFixture();const first=n.start('a');const rejected=assert.rejects(first,/invalide/);children[0].stdout.write('broken\n');await rejected;assert.equal(n.current,null);assert.equal(children[0].signalCode,'SIGTERM');
});

test('Application shutdown kills even a helper still waiting for permission after stop',async()=>{
 const {n,children}=nativeFixture();const opening=n.start('a');const rejected=assert.rejects(opening,/annulée/);n.stop();n.shutdown();assert.equal(children[0].signalCode,'SIGKILL');await rejected;assert.equal(n.children.size,0);
});
