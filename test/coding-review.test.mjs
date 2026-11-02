import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CodingContext} from '../src/coding-context.mjs';
import {CodingNotes} from '../src/coding-notes.mjs';
import {CodingEngine} from '../src/coding-engine.mjs';
import {codingReviewBody,codingNotesBody} from '../src/coding-core.mjs';
import {AnswerHistory} from '../src/answer-history.mjs';
const config={model:'gpt-6.1-sol',answerLanguage:'fr'},snapshot={statement:'Sum a list.',code:'',language:'python'},options={config,key:'fake-key'};
const response=text=>new Response('data: '+JSON.stringify({type:'response.output_text.delta',delta:text})+'\n\ndata: '+JSON.stringify({type:'response.completed',response:{usage:{input_tokens:10,output_tokens:10}}})+'\n\n');
test('Manual context keeps final turns, source labels, transcription order, two minutes and size bounds',()=>{
 let now=0;const context=new CodingContext({now:()=>now});context.event({type:'transcript',id:'partial',text:'Not finished',final:false});assert.equal(context.text(),'');
 context.event({type:'transcript',id:'b',text:'Return zero.',speaker:'microphone',final:true});now=100;context.event({type:'transcript',id:'a',text:'An empty list is possible.',final:true});context.event({type:'transcript-speaker',id:'a',speaker:'system'});context.event({type:'transcript-order',ids:['a','b']});assert.match(context.text(),/^\[Ordinateur\].*\n\[Micro\]/);
 now=120101;assert.equal(context.text(),'');context.event({type:'transcript',id:'c',text:'x'.repeat(9000),final:true});assert.ok(context.text().length<=6000);context.event({type:'transcript-session'});assert.equal(context.text(),'');
});
test('Manual reanalysis keeps code until completion, uses recent exchanges and can be undone',async()=>{
 let body;const engine=new CodingEngine({emit(){},fetchImpl:async(_url,init)=>{body=JSON.parse(init.body);return response('result = sum(xs)');}});engine.analyze(snapshot,options);await engine.active.promise;const old=engine.history[0].text;
 assert.throws(()=>engine.review('',options),/Contexte récent/);assert.equal(engine.history[0].text,old);
 let release;engine.fetch=(_url,init)=>{body=JSON.parse(init.body);return new Promise(resolve=>release=resolve);};engine.review('[Ordinateur] The list may be empty.',options);const pending=engine.active.promise;assert.equal(engine.history[0].text,old);assert.equal(JSON.parse(body.input[0].content).solution,old);assert.match(JSON.parse(body.input[0].content).echanges,/empty/);
 release(response('result = sum(xs) if xs else 0'));await pending;assert.match(engine.history[0].text,/else 0/);assert.equal(engine.state().canUndo,true);engine.undo();assert.equal(engine.history[0].text,old);
});
test('A failed manual reanalysis preserves the old code and request usage is settled',async()=>{
 const events=[],engine=new CodingEngine({emit:e=>events.push(e),fetchImpl:async()=>response('result = 0')});engine.analyze(snapshot,options);await engine.active.promise;const old=engine.history[0];engine.fetch=async()=>new Response('{}',{status:429});engine.review('Handle the empty list.',options);await engine.active.promise;assert.equal(engine.history[0],old);assert.ok(events.some(e=>e.type==='coding-adapt-error'));
});
test('Notes stream a pedagogical outline separately and never overwrite code',async()=>{
 const events=[],notes=new CodingNotes({emit:e=>events.push(e),fetchImpl:async()=>response('[[REPONSE]] • Parcourir les valeurs.\n• Temps : O(n).')});let finished=0;
 await notes.start(snapshot,{state:'done',text:'result = sum(xs)'},{...options,usage:()=>({report(){},finish(){finished++;}})});assert.equal(events[0].type,'coding-notes-start');assert.equal(events[0].independent,true);assert.equal(events.at(-1).type,'coding-notes-done');assert.match(events.find(e=>e.type==='coding-notes-delta').text,/O\(n\)/);assert.equal(finished,1);assert.equal(events.some(e=>e.type==='coding-delta'),false);
});
test('New code cancels older notes and ignores their delayed results; failures are isolated',async()=>{
 const releases=[],events=[],notes=new CodingNotes({emit:e=>events.push(e),fetchImpl:()=>new Promise(resolve=>releases.push(resolve))});const old=notes.start(snapshot,{state:'done',text:'old'},options);const oldId=events[0].id;const latest=notes.start(snapshot,{state:'done',text:'new'},options);
 releases[0](response('[[REPONSE]] • Stale.'));await old;assert.equal(events.some(e=>e.type==='coding-notes-delta'&&e.id===oldId),false);releases[1](response('[[REPONSE]] • Current.'));await latest;assert.match(events.find(e=>e.type==='coding-notes-delta').text,/Current/);
 notes.fetch=async()=>new Response('{}',{status:429});await notes.start(snapshot,{state:'done',text:'current'},options);assert.equal(events.at(-1).type,'coding-notes-error');assert.equal(notes.active,null);
});
test('Coding notes and live answer streams coexist and respect reading selection',()=>{
 const history=new AnswerHistory();history.start({id:1});history.update({id:1,text:'[[REPONSE]] • Live answer.'});history.hold(1);
 history.start({id:'notes',kind:'coding',independent:true,manual:true});history.update({id:'notes',text:'[[REPONSE]] • Approach.'});assert.equal(history.items[0].state,'streaming');assert.equal(history.current().id,1);
 history.start({id:2});assert.equal(history.items.find(i=>i.id==='notes').state,'streaming');history.cancel(false,false);history.update({id:'notes',text:'[[REPONSE]] • Approach complete.'});history.finish({id:'notes'});assert.equal(history.items.find(i=>i.id==='notes').state,'done');assert.equal(history.visible().length,2);assert.equal(history.current().id,1);
});
test('Explanation and review prompts use explicit code and bounded untrusted context',()=>{
 const notes=codingNotesBody(config,snapshot,'result = sum(xs)');assert.equal(notes.store,false);assert.equal(notes.stream,true);assert.match(notes.instructions,/Français/);assert.match(notes.instructions,/repères vérifiables/);assert.equal(JSON.parse(notes.input[0].content).solution,'result = sum(xs)');assert.throws(()=>codingReviewBody(config,snapshot,'code','x'.repeat(6001)),/Contexte récent/);
});
