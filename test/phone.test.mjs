import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import http from 'node:http';
import WebSocket from 'ws';
import {PhoneServer,phoneSnapshot} from '../src/phone-server.cjs';
const network=()=>[{name:'Test',address:'127.0.0.1'}];
async function fixture(t){const events=[];const server=new PhoneServer({getAddresses:network,onStatus:value=>events.push(value),authTimeout:500});const info=await server.start();t.after(()=>server.close());const url=new URL(info.url);return {server,events,url,token:url.hash.slice(1)};}
function socket(url,origin=url.origin){return new WebSocket(url.origin.replace('http','ws')+'/live',{origin});}
async function authenticated(url,token){const ws=socket(url);await once(ws,'open');const next=once(ws,'message');ws.send(JSON.stringify({token}));const [data]=await next;return {ws,value:JSON.parse(data)};}
test('Phone snapshot contains display text only, bounds history and preserves code indentation',()=>{
 const value=phoneSnapshot({key:'SECRET',documents:[{text:'PRIVATE'}],speech:[{id:'1',text:'Hello',source:'microphone',secret:'SECRET'}],answers:Array.from({length:600},(_,i)=>({id:String(i),text:'a'.repeat(1000)})),coding:{id:'4',text:'def f():\n    return 1',key:'SECRET'}});
 assert.equal(value.speech[0].source,'microphone');assert.equal(value.coding.text,'def f():\n    return 1');assert.equal(value.answers.length,60);assert.equal(value.answers.at(-1).id,'599');assert.ok(!JSON.stringify(value).includes('SECRET'));assert.ok(!JSON.stringify(value).includes('PRIVATE'));
});
test('Phone requires a local address and never starts without explicit activation',async()=>{const server=new PhoneServer({getAddresses:()=>[]});assert.equal(server.state().active,false);await assert.rejects(server.start(),/Wi-Fi/);assert.equal(server.state().active,false);});
test('Phone rejects unknown network selection',async()=>{const server=new PhoneServer({getAddresses:network});await assert.rejects(server.start('8.8.8.8'),/Wi-Fi/);});
test('Static phone page excludes tokens and content, rejects arbitrary paths, Host and Origin',async t=>{
 const {url}=await fixture(t);const response=await fetch(url.origin);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.ok(!(await response.text()).includes(url.hash.slice(1)));
 assert.equal((await fetch(url.origin+'/main.cjs')).status,404);assert.equal((await fetch(url.origin,{headers:{Origin:'https://evil.test'}})).status,403);
 const status=await new Promise((resolve,reject)=>{const req=http.get(url.origin,{headers:{Host:'evil.test'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});assert.equal(status,403);
});
test('WebSocket origin must match even with a valid link',async t=>{const {url}=await fixture(t);const ws=socket(url,'https://evil.test');const error=await new Promise(resolve=>ws.once('error',resolve));assert.match(error.message,/403/);});
test('No display is sent before authentication and an invalid token is revoked',async t=>{
 const {url,server}=await fixture(t);server.publish({coding:{text:'PRIVATE'}});const ws=socket(url);await once(ws,'open');let messages=0;ws.on('message',()=>messages++);const close=once(ws,'close');ws.send(JSON.stringify({token:'0'.repeat(64)}));assert.equal((await close)[0],4003);assert.equal(messages,0);
});
test('Unauthenticated connections expire',async t=>{const {url}=await fixture(t);const ws=socket(url);await once(ws,'open');assert.equal((await once(ws,'close'))[0],4003);});
test('Phone receives the current screen on connect and latest code replaces previous content',async t=>{
 const {url,token,server,events}=await fixture(t);server.publish({coding:{id:'1',text:'old'}});const {ws,value}=await authenticated(url,token);assert.equal(value.value.coding.text,'old');assert.ok(events.some(e=>e.clients===1));
 const next=once(ws,'message');server.publish({coding:{id:'2',text:'def f():\n    return 2'}});assert.equal(JSON.parse((await next)[0]).value.coding.text,'def f():\n    return 2');const closed=once(ws,'close');await server.close();assert.equal((await closed)[0],4001);assert.equal(server.latest,null);assert.equal(server.state().active,false);
});
test('Phone protocol is read-only',async t=>{const {url,token}=await fixture(t);const {ws}=await authenticated(url,token);const closed=once(ws,'close');ws.send(JSON.stringify({action:'ask',text:'Run code'}));assert.equal((await closed)[0],4003);});
test('Stop and restart rotate the link; overlapping start calls create one server',async t=>{
 const server=new PhoneServer({getAddresses:network});t.after(()=>server.close());const [a,b]=await Promise.all([server.start(),server.start()]);assert.equal(a.url,b.url);await server.close();const next=await server.start();assert.notEqual(new URL(a.url).hash,new URL(next.url).hash);const ws=socket(new URL(next.url));await once(ws,'open');const closed=once(ws,'close');ws.send(JSON.stringify({token:new URL(a.url).hash.slice(1)}));assert.equal((await closed)[0],4003);
});
