import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MODELS,normalizeConfig,responseBody,translationBody} from '../src/core.mjs';
import {codingSnapshot,codingBody,codingAdaptBody,codingReviewBody,codingNotesBody} from '../src/coding-core.mjs';
function hasBreakpoint(value){return value&&typeof value==='object'&&(Object.hasOwn(value,'prompt_cache_breakpoint')||Object.values(value).some(hasBreakpoint));}
test('Every response path requests explicit-only caching without any breakpoint',()=>{
 for(const model of MODELS){
  const config=normalizeConfig({model}),snapshot=codingSnapshot({statement:'Sum the values.'});
  const bodies=[responseBody(config,'Question','Growing context'),translationBody(config,'A single turn'),codingBody(config,snapshot),codingAdaptBody(config,snapshot,'return sum(xs)','Use a loop.'),codingReviewBody(config,snapshot,'return sum(xs)','An array may be empty.'),codingNotesBody(config,snapshot,'return sum(xs)')];
  for(const body of bodies){assert.deepEqual(body.prompt_cache_options,{mode:'explicit'});assert.equal(hasBreakpoint(body),false);assert.equal(body.store,false);}
 }
});
test('Config preserves disabled analysis and translation independently',()=>{assert.equal(normalizeConfig({auto:false,translationEnabled:true}).auto,false);assert.equal(normalizeConfig({auto:false,translationEnabled:true}).translationEnabled,true);});
