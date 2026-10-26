import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TokenUsage,tokenRate,resetDelay} from '../src/token-usage.mjs';
test('Token reports count input and output once, including cancelled and incomplete requests',()=>{
 const meter=new TokenUsage(),request=meter.begin();request.report({input_tokens:20,output_tokens:5});request.report({input_tokens:20,output_tokens:5});request.finish();request.finish();
 assert.equal(meter.snapshot().totalTokens,25);assert.equal(meter.snapshot().pendingUsage,0);
 meter.begin().finish();assert.equal(meter.snapshot().missingUsage,1);
 meter.record({type:'duration',seconds:2.5});assert.equal(meter.snapshot().totalTokens,25);assert.equal(meter.snapshot().durationSeconds,2.5);
 meter.record({total_tokens:6});assert.equal(meter.snapshot().totalTokens,31);
});
test('Clearing usage ignores late completion from the previous session',()=>{
 const meter=new TokenUsage(),old=meter.begin();meter.reset();old.report({input_tokens:100,output_tokens:20});old.finish();
 assert.equal(meter.snapshot().totalTokens,0);assert.equal(meter.snapshot().pendingUsage,0);assert.equal(meter.snapshot().missingUsage,0);
 meter.record({input_tokens:-1,output_tokens:'12'});assert.equal(meter.snapshot().totalTokens,0);assert.equal(meter.snapshot().missingUsage,1);
});
test('Remaining tokens are per-model rate snapshots, expire without inventing a refreshed balance',()=>{
 const headers=new Headers({'x-ratelimit-remaining-tokens':'500','x-ratelimit-reset-tokens':'1m2s','x-ratelimit-remaining-project-tokens':'40','x-ratelimit-reset-project-tokens':'3s'});
 const rate=tokenRate(headers,'model-a',1000);assert.equal(rate.remaining,40);assert.equal(rate.scope,'projet');assert.equal(rate.expiresAt,4000);
 const meter=new TokenUsage();meter.rates.set('model-a',rate);assert.equal(meter.snapshot('model-a',2000).tokenRate.remaining,40);assert.equal(meter.snapshot('model-b',2000).tokenRate,null);assert.equal(meter.snapshot('model-a',4000).tokenRate,null);
 assert.equal(tokenRate(new Headers(),'a'),null);assert.equal(tokenRate(new Headers({'x-ratelimit-remaining-tokens':'-1'}),'a'),null);assert.equal(resetDelay('1m2s30ms'),62030);assert.equal(resetDelay('nonsense'),null);
});
