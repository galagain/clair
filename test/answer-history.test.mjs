import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AnswerHistory,novelAnswer} from '../src/answer-history.mjs';
const add=(h,id,answer,extra={})=>{h.start({id,text:'Question '+id,...extra});h.update({id,text:'[[REPONSE]] '+answer});h.finish({id});};
test('New answers follow automatically and keep all earlier answers in order',()=>{
 const h=new AnswerHistory();add(h,1,'First idea.');h.start({id:2});assert.equal(h.current().id,1);h.update({id:2,text:'[[REPONSE]] Second idea.'});assert.equal(h.current().id,2);h.finish({id:2});assert.deepEqual(h.visible().map(x=>x.id),[1,2]);assert.equal(h.unread(),0);
});
test('Reading earlier answers keeps selection while new answers append, resume selects latest',()=>{
 const h=new AnswerHistory();add(h,1,'First.');add(h,2,'Second.');h.hold(1);add(h,3,'Third.');assert.equal(h.current().id,1);assert.equal(h.unread(),2);assert.equal(h.visible().length,3);h.resume();assert.equal(h.current().id,3);add(h,4,'Fourth.');assert.equal(h.current().id,4);
});
test('Cancelled and cleared streams ignore late tokens',()=>{
 const h=new AnswerHistory();add(h,1,'First.');h.start({id:2});h.update({id:2,text:'[[REPONSE]] Partial'});h.cancel(true);h.update({id:2,text:'[[REPONSE]] Wrong'});assert.equal(h.current().answer,'• Partial');assert.equal(h.current().state,'incomplete');assert.equal(h.current().oldContext,true);h.clear();h.update({id:2,text:'Late'});assert.equal(h.current(),null);
});
test('History pruning preserves the answer being read',()=>{const h=new AnswerHistory(3);add(h,1,'First.');h.hold(1);for(let id=2;id<10;id++)add(h,id,'Idea '+id);assert.equal(h.items.length,3);assert.equal(h.current().id,1);h.resume();assert.equal(h.current().id,9);});
test('Repeated ideas are omitted while new information remains; empty answers do not erase history',()=>{
 const h=new AnswerHistory();add(h,1,'• Check **logs**.\n• Measure latency.');add(h,2,'• Check logs.\n• Try a rollback.');assert.equal(h.current().answer,'• Try a rollback.');add(h,3,'• Check logs.\n• Try a rollback.');assert.equal(h.current().id,2);h.start({id:4});h.update({id:4,text:'[[REPONSE]]\n[[POINTS]]\n[[PRECISION]]'});h.finish({id:4});assert.equal(h.visible().length,2);
});
test('A repeated streaming prefix is buffered, but a correction is shown as soon as it differs',()=>{
 const previous=['I’d check the logs first.'];assert.equal(novelAnswer('[[REPONSE]] • I’d check',previous,true),'');assert.equal(novelAnswer('[[REPONSE]] • I’d check the database instead.',previous,true),'• I’d check the database instead.');assert.equal(novelAnswer('[[REPONSE]] • I’d check',previous,false),'• I’d check');
 assert.equal(novelAnswer('[[REPONSE]] • Check logs.\n• Check **logs**.\n• Do not check logs.',[],false),'• Check logs.\n• Do not check logs.');
});
test('Different numbers, negations and technical operators are not deduplicated',()=>{
 assert.equal(novelAnswer('[[REPONSE]] • Set x > 5.\n• Use 20 seconds.\n• Do not retry.',['Set x < 5.','Use 10 seconds.','Retry.']),'• Set x > 5.\n• Use 20 seconds.\n• Do not retry.');
});
test('Manual requests and new context allow an independent complete answer',()=>{
 const h=new AnswerHistory();add(h,1,'Check logs.',{language:'en'});add(h,2,'Check logs.',{language:'en',manual:true});assert.equal(h.visible().length,2);h.cancel(true);add(h,3,'Check logs.',{language:'en'});assert.equal(h.visible().length,3);add(h,4,'Check logs.',{language:'fr'});assert.equal(h.visible().length,4);
});

test('Cancelling a buffered duplicate preview does not publish its repeated prefix',()=>{
 const h=new AnswerHistory();add(h,1,'I would check the logs first.');h.start({id:2,draft:true});h.update({id:2,text:'[[REPONSE]] I would check'});assert.equal(h.visible().length,1);h.cancel();assert.equal(h.visible().length,1);add(h,3,'Check the database instead.');assert.deepEqual(h.visible().map(x=>x.id),[1,3]);
});
