import {test} from 'node:test';
import assert from 'node:assert/strict';
import {directSender,directSnapshot} from '../extensions/firefox/client.mjs';

function fixture(){
 const tab={id:7,url:'https://exercise.test/task'},calls=[];
 const api={storage:{local:{get:async key=>key==='pairing'?{pairing:{port:43127,token:'a'.repeat(64)}}:{}}},tabs:{get:async()=>tab,query:async()=>[tab]},scripting:{executeScript:async options=>{calls.push(options);return options.world==='MAIN'?[{frameId:0,result:[{code:'def f():\n    return 1',language:'python',complete:true}]}]:[{frameId:0,result:{statement:'Return one.',title:'Task',source:'exercise.test',candidates:[],tests:'',frames:0}}];}}};
 return {tab,api,calls};
}
test('Shortcut sends the captured statement and code once without popup APIs',async()=>{
 const {tab,api,calls}=fixture();let count=0,body;
 const send=directSender(api,async(url,init)=>{count++;body=JSON.parse(init.body);assert.equal(url,'http://127.0.0.1:43127/v1/coding');return Response.json({ok:true});});
 const result=await send(tab);assert.equal(result.status,'sent');assert.equal(count,1);assert.equal(body.statement,'Return one.');assert.equal(body.code,'def f():\n    return 1');assert.equal(calls.length,2);assert.ok(calls.every(call=>call.target.tabId===7));
});
test('Repeated shortcut while sending cannot duplicate an API analysis',async()=>{
 const {tab,api}=fixture();let release,count=0;const send=directSender(api,()=>{count++;return new Promise(resolve=>release=resolve);});
 const first=send(tab);while(!release)await new Promise(resolve=>setImmediate(resolve));assert.equal((await send(tab)).status,'busy');assert.equal(count,1);release(Response.json({ok:true}));await first;
});
test('Disconnected extension never captures or sends page content',async()=>{
 const {tab,api,calls}=fixture();api.storage.local.get=async()=>({});let fetched=false;
 const result=await directSender(api,async()=>{fetched=true;})(tab);assert.equal(result.status,'error');assert.equal(calls.length,0);assert.equal(fetched,false);
});
test('Navigation during capture rejects stale content without sending',async()=>{
 const {tab,api}=fixture();api.tabs.get=async()=>({...tab,url:'https://elsewhere.test'});let fetched=false;
 const result=await directSender(api,async()=>{fetched=true;})(tab);assert.match(result.text,/page a changé/);assert.equal(fetched,false);
});
test('Wrong connection and busy Clair are reported without automatic retries',async()=>{
 for(const [status,error] of [[401,'Reconnectez Firefox.'],[400,'Une analyse est déjà en cours.']]){
  const {tab,api}=fixture();let count=0;const result=await directSender(api,async()=>{count++;return Response.json({error},{status});})(tab);assert.equal(result.status,'error');assert.equal(result.text,error);assert.equal(count,1);
 }
});
test('Direct capture preserves warnings, avoids ambiguous editors and respects manual language',()=>{
 const capture={statement:'Task',tests:'',title:'',source:'',warning:'',candidates:[{code:'fragment',complete:false,language:'python'}]};
 assert.match(directSnapshot(capture,'cpp').warning,/manquer des lignes/);assert.equal(directSnapshot(capture,'cpp').language,'cpp');
 capture.candidates.push({code:'another file',complete:true});assert.equal(directSnapshot(capture).code,'');assert.match(directSnapshot(capture).warning,/aucun code choisi/);
});

test('Shortcut captures the whole exercise even when a previous selection remains',async()=>{
 const {tab,api,calls}=fixture();const result=await directSender(api,async()=>Response.json({ok:true}))(tab);
 assert.equal(result.status,'sent');assert.deepEqual(calls.find(call=>!call.world).args,[{useSelection:false}]);
});
test('A stuck page cannot permanently block later shortcuts or send a late capture',async()=>{
 const {tab,api}=fixture();const execute=api.scripting.executeScript;let release,count=0;
 api.scripting.executeScript=options=>options.world==='MAIN'?execute(options):new Promise(resolve=>release=resolve);
 const send=directSender(api,async()=>{count++;return Response.json({ok:true});},{captureTimeoutMs:10});
 assert.match((await send(tab)).text,/Lecture de la page bloquée/);assert.equal(count,0);
 api.scripting.executeScript=execute;assert.equal((await send(tab)).status,'sent');assert.equal(count,1);
 release([{frameId:0,result:{statement:'Late old exercise',candidates:[]}}]);await new Promise(resolve=>setImmediate(resolve));assert.equal(count,1);
});
