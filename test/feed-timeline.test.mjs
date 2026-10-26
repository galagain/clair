import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FeedTimeline} from '../src/feed-timeline.mjs';
const final=(feed,id,text,speaker)=>feed.update({id,text,speaker,final:true});
test('An uncommitted live turn stays after published speech instead of jumping above it',()=>{
 const feed=new FeedTimeline();feed.order(['a']);final(feed,'a','First sentence.');feed.update({id:'b',text:'Next sentence'});
 assert.deepEqual(feed.history.map(x=>x.text),['First sentence.']);assert.equal(feed.live.id,'b');
 feed.order(['a','b']);final(feed,'b','Next sentence.');assert.deepEqual(feed.history.map(x=>x.text),['First sentence.','Next sentence.']);
});
test('Out-of-order finals wait for their predecessor and keep final text immutable',()=>{
 const feed=new FeedTimeline();feed.order(['a','b']);feed.update({id:'a',text:'First draft'});final(feed,'b','Second.');
 assert.equal(feed.history.length,0);assert.equal(feed.live.text,'First draft');final(feed,'a','First.');
 final(feed,'a','Duplicate changed final');feed.update({id:'a',text:'Late delta'});feed.speaker('a','system');
 assert.deepEqual(feed.history.map(x=>x.text),['First.','Second.']);assert.equal(feed.history[0].speaker,null);
});
test('Restart closes pending speech and new ordering never moves earlier history',()=>{
 const feed=new FeedTimeline();final(feed,'1:a','Old.');feed.update({id:'1:b',text:'Interrupted'});feed.interrupt();feed.order(['2:a']);final(feed,'2:a','New.');
 assert.deepEqual(feed.history.map(x=>x.text),['Old.','Interrupted','New.']);assert.equal(feed.history[1].incomplete,true);
});
test('Removed passages do not reappear on late events, and clear resets the timeline',()=>{
 const feed=new FeedTimeline(2);for(const id of ['a','b','c'])final(feed,id,id);feed.order(['a','b','c']);final(feed,'a','old');assert.deepEqual(feed.history.map(x=>x.id),['b','c']);feed.clear();final(feed,'a','fresh');assert.equal(feed.history[0].text,'fresh');
});
test('Speaker metadata arriving before publication is retained without merging live text into history',()=>{
 const feed=new FeedTimeline();feed.order(['a','b']);feed.update({id:'a',text:'Hello'});feed.speaker('a','microphone');final(feed,'a','Hello.');feed.update({id:'b',text:'Hi'});feed.speaker('b','system');final(feed,'b','Hi.');assert.deepEqual(feed.history.map(x=>x.speaker),['microphone','system']);
});

test('Discarding an uncommitted noise fragment releases later final speech',()=>{const feed=new FeedTimeline();feed.update({id:'noise',text:'Uh'});final(feed,'next','Actual speech.');assert.equal(feed.history.length,0);feed.discard('noise');assert.deepEqual(feed.history.map(x=>x.text),['Actual speech.']);feed.update({id:'noise',text:'Late noise'});assert.equal(feed.live,null);});
