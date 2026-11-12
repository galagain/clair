import {test} from 'node:test';
import assert from 'node:assert/strict';
import {codingSnapshot,codingBody,codingAdaptBody,codingReviewBody,codingNotesBody} from '../src/coding-core.mjs';
import {normalizeConfig,responseBody} from '../src/core.mjs';
import {capturePageImages} from '../extensions/firefox/visual.mjs';
const image={url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',width:1,height:1};
test('Visual exercises send image parts in solving, review, voice updates and pedagogical notes without base64 in text',()=>{
 const snapshot=codingSnapshot({images:[image],language:'python'}),config=normalizeConfig();
 for(const body of [codingBody(config,snapshot),codingReviewBody(config,snapshot,'return 1','Use a list instead.'),codingAdaptBody(config,snapshot,'return 1','Use a list instead.'),codingNotesBody(config,snapshot,'return 1')]){
  const parts=body.input[0].content;assert.equal(parts[0].type,'input_text');assert.equal(parts[1].type,'input_image');assert.equal(parts[1].image_url,image.url);assert.equal(parts[1].detail,'high');assert.doesNotMatch(parts[0].text,/base64/);assert.equal(body.store,false);
 }
 const oral=responseBody(config,'Why this complexity?','',{coding:{snapshot,solution:'return 1'}});assert.doesNotMatch(oral.input[0].content,/base64/);
});
test('Images are optional, bounded and reject external URLs, invalid formats and unsupported payloads',()=>{
 assert.equal(normalizeConfig().codingCaptureMode,'text');assert.equal(normalizeConfig({codingCaptureMode:'visual'}).codingCaptureMode,'visual');
 assert.equal(typeof codingBody(normalizeConfig(),codingSnapshot({statement:'Task'})).input[0].content,'string');
 for(const images of [[{...image,url:'https://example.test/image.png'}],[{...image,url:'data:text/html;base64,AAAA'}],[{...image,url:'data:image/png;base64,YWJjZA=='}],[{...image,width:99999}],Array(7).fill(image)])assert.throws(()=>codingSnapshot({images}));
});
test('Full page capture tiles offscreen content in document coordinates without scrolling, bounded and identity checked',async()=>{
 const tab={id:4,windowId:7,url:'https://exercise.test/task'},calls=[];let active=4;
 const api={tabs:{get:async()=>tab,query:async()=>[{...tab,id:active}],captureVisibleTab:async(windowId,options)=>{calls.push({windowId,...options});return 'data:image/jpeg;base64,/9j/AAAA';}}};
 const result=await capturePageImages(api,tab,{width:1200,height:3200});assert.equal(result.images.length,3);assert.deepEqual(calls.map(c=>c.rect.y),[0,1400,2800]);assert.equal(calls[2].rect.height,400);assert.equal(calls[0].scale,1);
 active=8;await assert.rejects(capturePageImages(api,tab,{width:1200,height:600}),/onglet a changé/);assert.equal(calls.length,3);
 active=4;const cropped=await capturePageImages(api,tab,{width:9000,height:99999});assert.equal(cropped.images.length,6);assert.match(cropped.warning,/limitée/);
 const controller=new AbortController();controller.abort();await assert.rejects(capturePageImages(api,tab,{width:1200,height:600},controller.signal),/annulée/);
});
