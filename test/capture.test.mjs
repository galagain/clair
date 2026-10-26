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
 let resolve,closed=0;const audio=stream();class Context{audioWorklet={addModule:()=>new Promise(r=>resolve=r)};close(){closed++;return Promise.resolve();}createMediaStreamSource(){assert.fail('Connected after stop');}}
 const capture=new AudioCapture({mediaDevices:{getDisplayMedia:async()=>audio},AudioContextImpl:Context});
 const opening=capture.open('system',{});await Promise.resolve();capture.stop();resolve();
 assert.equal(await opening,false);assert.equal(closed,1);assert.equal(audio.track.stops,1);
});
