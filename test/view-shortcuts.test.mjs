import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerViewShortcuts} from '../src/view-shortcuts.cjs';
test('F1 and F2 select interview and coding without toggling recording or window focus',()=>{
 const callbacks={},events=[];const result=registerViewShortcuts({register(key,fn){callbacks[key]=fn;return key==='F1';}},e=>events.push(e));
 assert.deepEqual(result,{F1:true,F2:false});callbacks.F1();callbacks.F2();callbacks.F2();assert.deepEqual(events,[{type:'view-shortcut',mode:'interview'},{type:'view-shortcut',mode:'coding'},{type:'view-shortcut',mode:'coding'}]);
});
