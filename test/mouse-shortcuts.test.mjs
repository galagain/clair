import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {MouseShortcuts,mouseConfiguration} from '../src/mouse-shortcuts.cjs';
function setup(){const events=[],actions=[],saved=[],writes=[];let child;const mouse=new MouseShortcuts({available:true,executable:'test-only',emit:e=>events.push(e),action:a=>actions.push(a),save:async c=>saved.push(structuredClone(c)),spawnImpl:()=>{child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();child.stdin.write=s=>writes.push(JSON.parse(s));child.stdin.end=()=>{};child.kill=()=>{child.killed=true;};return child;}});return {mouse,events,actions,saved,writes,get child(){return child;},event:e=>child.stdout.emit('data',JSON.stringify(e)+'\n')};}
test('Mouse config accepts auxiliary buttons and modifiers, rejects duplicate and unsafe left click',()=>{const c=mouseConfiguration({enabled:true,bindings:{background:{button:9,modifiers:0},firefox:{button:0,modifiers:4}}});assert.equal(c.bindings.background.button,9);assert.throws(()=>mouseConfiguration({bindings:{background:{button:0,modifiers:0}}}),/clic gauche/);assert.throws(()=>mouseConfiguration({bindings:{background:{button:3,modifiers:0},firefox:{button:3,modifiers:0}}}),/différents/);assert.throws(()=>mouseConfiguration({bindings:{firefox:{button:99,modifiers:0}}}),/invalide/);});
test('Mouse helper is off by default; activation and stopping are explicit',async()=>{const f=setup();assert.equal(f.mouse.child,null);await f.mouse.enable(true);f.event({type:'ready'});assert.equal(f.mouse.status,'ready');assert.equal(f.writes.at(-1).enabled,true);await f.mouse.enable(false);assert.equal(f.child.killed,true);assert.equal(f.mouse.status,'off');assert.equal(f.mouse.config.enabled,false);});
test('Mouse learning binds only the captured button; ordinary clicks never change the assignment',async()=>{const f=setup();await f.mouse.enable(true);f.event({type:'ready'});f.mouse.learn('background');f.event({type:'button',button:6,modifiers:0,learning:true});f.event({type:'button',button:1,modifiers:0,learning:false});await f.mouse.queue;assert.equal(f.mouse.config.bindings.background.button,6);f.event({type:'action',action:'background'});assert.deepEqual(f.actions,['background']);f.mouse.stop();});
test('Mouse learning rejects duplicate bindings and preserves the previous association',async()=>{const f=setup();await f.mouse.enable(true);f.event({type:'ready'});f.mouse.learn('background');f.event({type:'button',button:3,modifiers:0,learning:true});await f.mouse.queue;f.mouse.learn('firefox');f.event({type:'button',button:3,modifiers:0,learning:true});await f.mouse.queue;assert.deepEqual(f.mouse.config.bindings.firefox,[]);assert.match(f.events.at(-1).message,/différents/);f.mouse.stop();});
test('Disabling during learning cannot restore a stale association or restart capture',async()=>{const f=setup();await f.mouse.enable(true);f.event({type:'ready'});f.mouse.learn('firefox');f.event({type:'button',button:4,modifiers:0,learning:true});await f.mouse.enable(false);await f.mouse.queue;assert.equal(f.mouse.config.enabled,false);assert.deepEqual(f.mouse.config.bindings.firefox,[]);assert.equal(f.mouse.child,null);});
test('Permission failures and malformed helper data remain visible without automatic permission prompts',async()=>{const f=setup();await f.mouse.enable(true);f.event({type:'permission',message:'Autorisez Clair.'});f.child.emit('exit');assert.equal(f.mouse.status,'permission');await f.mouse.enable(true);f.child.stdout.emit('data','bad json\n');assert.equal(f.mouse.status,'off');assert.match(f.events.at(-1).message,/invalide/);});

test('Multiple Firefox mouse bindings migrate, append, persist and can be removed independently',async()=>{
 const migrated=mouseConfiguration({bindings:{firefox:{button:3,modifiers:0}}});assert.deepEqual(migrated.bindings.firefox,[{button:3,modifiers:0}]);
 const f=setup();f.mouse.config=migrated;await f.mouse.enable(true);f.event({type:'ready'});
 for(const button of [4,5]){f.mouse.learn('firefox');f.event({type:'button',button,modifiers:0,learning:true});await f.mouse.queue;}
 assert.deepEqual(f.mouse.config.bindings.firefox.map(b=>b.button),[3,4,5]);assert.equal(f.writes.at(-1).bindings.firefox.length,3);
 f.mouse.learn('firefox');f.event({type:'button',button:4,modifiers:0,learning:true});await f.mouse.queue;assert.equal(f.mouse.config.bindings.firefox.length,3);assert.match(f.events.at(-1).message,/différents/);
 await f.mouse.forget('firefox',1);assert.deepEqual(f.saved.at(-1).bindings.firefox.map(b=>b.button),[3,5]);await assert.rejects(f.mouse.forget('firefox',9),/inconnue/);
 await f.mouse.forget('firefox');assert.deepEqual(f.mouse.config.bindings.firefox,[]);f.mouse.stop();
});

test('Add learns a keyboard chord alongside mouse bindings, persists it and ignores ordinary typing',async()=>{
 const f=setup();await f.mouse.enable(true);f.event({type:'ready'});
 f.mouse.learn('firefox');assert.equal(f.writes.at(-1).learningKeys,true);
 f.event({type:'key',keyCode:12,modifiers:0,keyLabel:'Q',learning:true});assert.equal(f.mouse.learning,'firefox');
 f.event({type:'key',keyCode:12,modifiers:8,keyLabel:'Q',learning:true});await f.mouse.queue;
 assert.deepEqual(f.saved.at(-1).bindings.firefox,[{keyCode:12,modifiers:8,keyLabel:'Q'}]);
 f.event({type:'key',keyCode:13,modifiers:8,keyLabel:'W',learning:false});assert.equal(f.mouse.config.bindings.firefox.length,1);
 f.mouse.learn('firefox');f.event({type:'button',button:4,modifiers:0,learning:true});await f.mouse.queue;assert.equal(f.mouse.config.bindings.firefox.length,2);
 f.mouse.learn('firefox');f.event({type:'key',keyCode:12,modifiers:8,keyLabel:'Different layout',learning:true});await f.mouse.queue;assert.equal(f.mouse.config.bindings.firefox.length,2);assert.match(f.events.at(-1).message,/différents/);
 await f.mouse.forget('firefox',0);assert.deepEqual(f.mouse.config.bindings.firefox,[{button:4,modifiers:0}]);
 f.mouse.learn('firefox');f.event({type:'learn-canceled'});assert.equal(f.mouse.learning,null);assert.equal(f.writes.at(-1).learningKeys,false);f.mouse.stop();
});

test('Text and visual shortcuts coexist, reject overlaps and remove independently',async()=>{
 const f=setup();await f.mouse.enable(true);f.event({type:'ready'});
 for(const [action,button] of [['firefox',4],['firefoxVisual',5]]){f.mouse.learn(action);f.event({type:'button',button,modifiers:0,learning:true});await f.mouse.queue;}
 assert.equal(f.mouse.config.bindings.firefox[0].button,4);assert.equal(f.mouse.config.bindings.firefoxVisual[0].button,5);
 f.mouse.learn('firefoxVisual');assert.equal(f.writes.at(-1).learningKeys,true);f.event({type:'button',button:4,modifiers:0,learning:true});await f.mouse.queue;assert.equal(f.mouse.config.bindings.firefoxVisual.length,1);assert.match(f.events.at(-1).message,/différents/);
 await f.mouse.forget('firefoxVisual',0);assert.equal(f.mouse.config.bindings.firefox.length,1);assert.equal(f.mouse.config.bindings.firefoxVisual.length,0);f.mouse.stop();
});

test('Function keys work without modifiers for background and Firefox, preserving F1 and F2 modes',async()=>{
 const f=setup();await f.mouse.enable(true);f.event({type:'ready'});f.mouse.learn('background');assert.equal(f.writes.at(-1).learningKeys,true);
 f.event({type:'key',keyCode:100,modifiers:0,keyLabel:'unknown',learning:true});await f.mouse.queue;assert.deepEqual(f.mouse.config.bindings.background,{keyCode:100,modifiers:0,keyLabel:'F8'});
 f.event({type:'action',action:'background'});assert.deepEqual(f.actions,['background']);
 f.mouse.learn('firefox');f.event({type:'key',keyCode:101,modifiers:0,keyLabel:'',learning:true});await f.mouse.queue;assert.equal(f.mouse.config.bindings.firefox[0].keyLabel,'F9');
 for(const keyCode of [122,120])assert.throws(()=>mouseConfiguration({bindings:{background:{keyCode,modifiers:0}}}),/réservées/);
 assert.throws(()=>mouseConfiguration({bindings:{background:{keyCode:12,modifiers:0}}}),/touche F/);f.mouse.stop();
});
