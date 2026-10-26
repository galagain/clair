import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AudioCapture} from '../src/capture.mjs';
function stream(){const track={readyState:'live',stops:0,stop(){this.stops++;this.readyState='ended';},addEventListener(){}};return {track,getTracks:()=>[track],getAudioTracks:()=>[track],getVideoTracks:()=>[]};}
test('A picker resolving after cancellation releases its stream without opening an audio context',async()=>{
 let resolve;const capture=new AudioCapture({mediaDevices:{getDisplayMedia:()=>new Promise(r=>resolve=r)},AudioContextImpl:class{constructor(){assert.fail('Context opened after cancel');}}});
 const opening=capture.open('system',{});capture.stop();const audio=stream();resolve(audio);
 assert.equal(await opening,false);assert.equal(audio.track.stops,1);
});
test('An obsolete picker cannot stop the capture attempt that replaced it',async()=>{
 const resolves=[];const capture=new AudioCapture({mediaDevices:{getDisplayMedia:()=>new Promise(r=>resolves.push(r))}});
 const first=capture.open('system',{});const second=capture.open('system',{});const current=capture.current;
 const a=stream();resolves[0](a);assert.equal(await first,false);assert.equal(capture.current,current);
 capture.stop();const b=stream();resolves[1](b);assert.equal(await second,false);assert.equal(b.track.stops,1);
});
test('An ended macOS audio track produces an actionable error and releases all tracks',async()=>{
 const audio=stream();audio.track.readyState='ended';const capture=new AudioCapture({mediaDevices:{getDisplayMedia:async()=>audio}});
 await assert.rejects(capture.open('system',{}),/Confidentialité/);assert.equal(audio.track.stops,1);assert.equal(capture.current,null);
});
test('Cancellation while loading the worklet closes the context and never connects a processor',async()=>{
 let resolve,closed=0,workletStarted;const started=new Promise(r=>workletStarted=r);const audio=stream();class Context{audioWorklet={addModule:()=>{workletStarted();return new Promise(r=>resolve=r);}};close(){closed++;return Promise.resolve();}createMediaStreamSource(){assert.fail('Connected after stop');}}
 const capture=new AudioCapture({mediaDevices:{getDisplayMedia:async()=>audio},AudioContextImpl:Context});
 const opening=capture.open('system',{});await started;capture.stop();resolve();
 assert.equal(await opening,false);assert.equal(closed,1);assert.equal(audio.track.stops,1);
});

test('Windows retries a transient system-audio startup failure',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let calls=0;const audio=stream(),statuses=[];
 const capture=new AudioCapture({platform:'win32',mediaDevices:{getDisplayMedia:async()=>{if(++calls===1)throw new DOMException('Could not start audio source','NotReadableError');return audio;}}});
 const attempt={};capture.current=attempt;
 const opening=capture.systemStream(attempt,text=>statuses.push(text));
 await Promise.resolve();t.mock.timers.tick(350);
 assert.equal(await opening,audio);assert.equal(calls,2);assert.equal(statuses.length,1);capture.stop();
});

test('Windows stops retrying persistent audio failures and explains how to recover',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0;
 const failure=new DOMException('Could not start audio source','NotReadableError');
 const capture=new AudioCapture({platform:'win32',mediaDevices:{getDisplayMedia:async()=>{calls++;throw failure;}}});
 const attempt={};capture.current=attempt;const opening=capture.systemStream(attempt);
 const rejected=assert.rejects(opening,error=>error.cause===failure&&/Paramètres Windows.*sortie audio/.test(error.message));
 await Promise.resolve();t.mock.timers.tick(350);await Promise.resolve();await Promise.resolve();t.mock.timers.tick(1000);
 await rejected;assert.equal(calls,3);capture.stop();
});

test('Stopping during an audio retry settles startup without reopening capture',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0;
 const capture=new AudioCapture({platform:'win32',mediaDevices:{getDisplayMedia:async()=>{calls++;throw new DOMException('busy','NotReadableError');}}});
 const opening=capture.open('system',{});await Promise.resolve();capture.stop();
 assert.equal(await opening,false);t.mock.timers.tick(5000);assert.equal(calls,1);assert.equal(capture.current,null);
});

test('Permission denials and non-Windows capture failures are never retried',async()=>{
 for(const [platform,name] of [['win32','NotAllowedError'],['win32','NotFoundError'],['darwin','NotReadableError']]){
  let calls=0;const failure=new DOMException('blocked',name);
  const capture=new AudioCapture({platform,mediaDevices:{getDisplayMedia:async()=>{calls++;throw failure;}}});
  await assert.rejects(capture.open('system',{}),error=>error===failure);assert.equal(calls,1);assert.equal(capture.current,null);
 }
});

test('A Windows system stream that arrives after cancellation is released',async()=>{
 let resolve;const capture=new AudioCapture({platform:'win32',mediaDevices:{getDisplayMedia:()=>new Promise(r=>resolve=r)}});
 const opening=capture.open('system',{});capture.stop();const audio=stream();resolve(audio);
 assert.equal(await opening,false);assert.equal(audio.track.stops,1);
});
