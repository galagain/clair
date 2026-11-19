import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import WebSocket from 'ws';
import {CodingBridge} from '../src/coding-bridge.cjs';
async function setup(t){const received=[],errors=[];const bridge=new CodingBridge({port:0,receive:value=>{received.push(value);return {id:received.length};},notify:text=>errors.push(text)});const [,port,token]=(await bridge.start()).split(':');t.after(()=>bridge.close());return {bridge,received,errors,port,token};}
async function connect(f,value=f.token){const socket=new WebSocket(`ws://127.0.0.1:${f.port}/v1/capture`,{origin:'moz-extension://test-extension'});await once(socket,'open');const ready=once(socket,'message');socket.send(JSON.stringify({type:'auth',token:value}));await ready;return socket;}
test('Mouse commands deliver text and visual capture requests without keystrokes; IDs are single-use',async t=>{
 const f=await setup(t);assert.throws(()=>f.bridge.trigger('text'),/extension/);const socket=await connect(f);
 for(const mode of ['text','visual']){
  const message=once(socket,'message');const id=f.bridge.trigger(mode).id;const job=JSON.parse(String((await message)[0]));assert.equal(job.type,'capture');assert.equal(job.mode,mode);assert.equal(job.id,id);assert.ok(job.expires>Date.now());assert.throws(()=>f.bridge.trigger(mode),/déjà en cours/);
  const send=()=>fetch(`http://127.0.0.1:${f.port}/v1/coding`,{method:'POST',headers:{Authorization:`Bearer ${f.token}`,'Content-Type':'application/json'},body:JSON.stringify({statement:'Task',nativeRequestId:id})});
  assert.equal((await send()).status,202);assert.equal((await send()).status,400);
 }
 assert.equal(f.received.length,2);
});
test('Remote capture reports failure, expiry and disconnect without executing a stale request',async t=>{
 const f=await setup(t),socket=await connect(f);let message=once(socket,'message');const id=f.bridge.trigger('text').id;await message;
 socket.send(JSON.stringify({type:'capture-result',id,status:'error',text:'Autorisez cet onglet.'}));await new Promise(resolve=>setTimeout(resolve,20));assert.equal(f.errors.at(-1),'Autorisez cet onglet.');assert.equal(f.bridge.remote.job,null);
 f.bridge.remote.deadlineMs=10;message=once(socket,'message');f.bridge.trigger('visual');await message;await new Promise(resolve=>setTimeout(resolve,20));assert.equal(f.bridge.remote.job,null);assert.match(f.errors.at(-1),/expirée/);assert.equal(f.received.length,0);
 socket.close();await once(socket,'close');await new Promise(resolve=>setImmediate(resolve));assert.throws(()=>f.bridge.trigger('text'),/extension/);
});
test('WebSocket rejects web origins and malformed or unauthenticated clients',async t=>{
 const f=await setup(t);
 const external=new WebSocket(`ws://127.0.0.1:${f.port}/v1/capture`,{origin:'https://exercise.test'});await new Promise(resolve=>{external.on('error',()=>{});external.once('close',resolve);});
 for(const value of [null,{type:'auth',token:'bad'}]){const socket=new WebSocket(`ws://127.0.0.1:${f.port}/v1/capture`,{origin:'moz-extension://test-extension'});await once(socket,'open');const closed=once(socket,'close');socket.send(JSON.stringify(value));assert.equal((await closed)[0],1008);}
 assert.throws(()=>f.bridge.trigger('visual'),/extension/);assert.equal(f.received.length,0);
});
