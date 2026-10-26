import {test} from 'node:test';
import assert from 'node:assert/strict';
import {answerLines,inlineParts,plainAnswer} from '../src/answer-view.mjs';

test('Spoken ideas retain content and line breaks when copied without display markers',()=>{
 const text='• I’d check **latency** first.\n• Then I’d look at **logs**.\n';
 assert.equal(plainAnswer(text),'I’d check latency first.\nThen I’d look at logs.');
 assert.deepEqual(answerLines('1. First\r\n\n- Second\n•'),['First','Second']);
 assert.equal(plainAnswer('An unformatted answer.'),'An unformatted answer.');
});

test('Emphasis can stream before its closing marker; HTML remains literal data',()=>{
 assert.deepEqual(inlineParts('Check **lat'),[{text:'Check ',strong:false},{text:'lat',strong:true}]);
 assert.deepEqual(inlineParts('Check **latency** first.'),[{text:'Check ',strong:false},{text:'latency',strong:true},{text:' first.',strong:false}]);
 assert.equal(plainAnswer('• **<img src=x onerror=alert(1)>**'),'<img src=x onerror=alert(1)>');
});
