import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowOverlay,validLayout} from '../src/window-overlay.cjs';
function setup(){
 const win=new EventEmitter();let bounds={x:100,y:100,width:400,height:300};const calls=[];const cursor={x:300,y:250};
 Object.assign(win,{isDestroyed:()=>false,getBounds:()=>({...bounds}),getContentBounds:()=>({...bounds}),getSize:()=>[bounds.width,bounds.height],setSize:(width,height)=>{bounds={...bounds,width,height};win.emit('resize');},setIgnoreMouseEvents:(ignore,options)=>calls.push({ignore,options})});
 const overlay=new WindowOverlay(win,{getCursorScreenPoint:()=>cursor,getDisplayMatching:()=>({workArea:{x:0,y:0,width:1200,height:900}})});
 const layout={view:'session',height:260,regions:[{x:10,y:10,width:380,height:42},{x:320,y:150,width:24,height:24}]};
 return {overlay,win,cursor,calls,layout};
}
test('Passive content passes through and controls recover even without renderer movement',()=>{
 const {overlay,cursor,calls,layout}=setup();try{overlay.update(layout);assert.equal(calls.at(-1).ignore,true);assert.equal(calls.at(-1).options.forward,true);
 cursor.x=425;cursor.y=255;overlay.refresh();assert.equal(calls.at(-1).ignore,false);
 cursor.x=200;overlay.refresh();assert.equal(calls.at(-1).ignore,true);
 overlay.hold(true);assert.equal(calls.at(-1).ignore,false);overlay.hold(false);assert.equal(calls.at(-1).ignore,true);
 }finally{overlay.dispose();}
});
test('Content fits without resizing on tab switches or overriding a manually sized window',()=>{
 const {overlay,win,layout}=setup();try{overlay.update(layout);assert.deepEqual(win.getSize(),[400,260]);overlay.update({...layout,height:390});assert.deepEqual(win.getSize(),[400,390]);
 overlay.update({...layout,view:'settings',height:600});assert.deepEqual(win.getSize(),[400,390]);overlay.update({...layout,view:'session',height:260});assert.deepEqual(win.getSize(),[400,390]);
 win.setSize(425,420);overlay.update({...layout,height:450});assert.deepEqual(win.getSize(),[425,420]);
 }finally{overlay.dispose();}
});
test('Malformed regions are rejected and reset restores native interaction',()=>{
 const {overlay,calls,layout}=setup();try{overlay.update(layout);assert.equal(validLayout({...layout,regions:[{x:NaN,y:0,width:2,height:2}]}),false);assert.equal(overlay.update({...layout,view:'unknown'}),false);overlay.reset();assert.equal(calls.at(-1).ignore,false);}finally{overlay.dispose();}
});
