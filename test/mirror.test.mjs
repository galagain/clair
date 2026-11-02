import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Mirror} from '../src/mirror.cjs';
function setup(options={}){
 const children=[],events=[];let displays=[{id:1,label:'Mac',size:{width:1440,height:900}},{id:2,label:'Externe',size:{width:1920,height:1080}}];
 const mirror=new Mirror({available:true,executable:'/synthetic/clair-mirror',parent:100,displays:()=>displays,emit:e=>events.push(e),spawnImpl:(_file,args)=>{const child=new EventEmitter();Object.assign(child,{stdout:new EventEmitter(),stderr:new EventEmitter(),stdin:Object.assign(new EventEmitter(),{end(){}}),kill(){child.killed=true;},args});children.push(child);return child;},...options});
 return {mirror,children,events,set displays(value){displays=value;},send(value){children.at(-1).stdout.emit('data',Buffer.from(JSON.stringify(value)+'\n'));}};
}
test('Mirror requires two connected distinct displays and rejects invalid or unsupported requests',()=>{
 const {mirror,children}=setup();for(const pair of [[1,1],[1,3],['1',2],[-1,2],[1,Infinity]])assert.throws(()=>mirror.start(...pair));assert.equal(children.length,0);
 assert.throws(()=>setup({available:false}).mirror.start(1,2),/Mac/);
});
test('Mirror starts only on explicit command, passes IDs and parent, and stops the exact child',async()=>{
 const {mirror,children,send}=setup();assert.equal(children.length,0);const pending=mirror.start(1,2);assert.equal(mirror.state().status,'starting');assert.deepEqual(children[0].args,['--source','1','--target','2','--parent','100']);
 send({type:'ready',source:1,target:2});assert.equal((await pending).status,'active');assert.throws(()=>mirror.start(2,1),/Arrêtez/);mirror.stop();assert.equal(children[0].killed,true);assert.equal(mirror.state().status,'off');
});
test('Mirror reports permission failures and can be retried without stale callbacks',async()=>{
 const {mirror,children,send}=setup();const first=mirror.start(1,2);send({type:'error',message:'Autorisation nécessaire.'});await assert.rejects(first,/Autorisation/);assert.equal(mirror.state().status,'off');
 const second=mirror.start(1,2);children[0].emit('exit');assert.equal(mirror.state().status,'starting');send({type:'ready',source:1,target:2});await second;send({type:'stopped'});assert.equal(mirror.state().status,'off');
});
test('Mirror cancels pending startup on stop, display changes and helper crash',async()=>{
 const {mirror,children}=setup();const first=mirror.start(1,2);mirror.stop();await assert.rejects(first,/arrêtée/);
 const second=mirror.start(1,2);mirror.changed();await assert.rejects(second,/écrans/);
 const third=mirror.start(1,2);children.at(-1).emit('exit');await assert.rejects(third,/autorisations/);assert.equal(mirror.state().status,'off');
});
test('Mirror rejects inconsistent screens, malformed streams and stalled helpers',async()=>{
 for(const event of [null,{type:'ready',source:2,target:1}]){const {mirror,send}=setup();const promise=mirror.start(1,2);send(event);await assert.rejects(promise);assert.equal(mirror.state().status,'off');}
 const {mirror,children}=setup();const invalid=mirror.start(1,2);children[0].stdout.emit('data',Buffer.from('x'.repeat(65537)));await assert.rejects(invalid,/invalide/);
 const slow=setup({timeoutMs:5});await assert.rejects(slow.mirror.start(1,2),/trop long/);assert.equal(slow.children[0].killed,true);
});
