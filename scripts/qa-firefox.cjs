// Requires geckodriver on PATH (or GECKODRIVER), and Firefox. Uses only a new
// headless profile, a synthetic exercise and a local receiving stub; no API.
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {CodingBridge}=require('../src/coding-bridge.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){let last;for(let i=0;i<80;i++){try{last=await fn();if(last)return last;}catch(error){last=error;}await pause(100);}throw Error('Firefox test timed out: '+String(last));}
(async()=>{
 const captures=[];let captureMode='text';let session,driver,driverLog='';
 const bridge=new CodingBridge({port:0,settings:()=>({captureMode}),receive:value=>{captures.push(value);return {id:captures.length};}});
 const fixture=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(`<!doctype html><title>Coding fixture</title><main><h1>Two Sum</h1><p id="problem">Find two indices whose values add up to the target.</p><p hidden>HIDDEN_SECRET</p><input type="password" value="PASSWORD_SECRET"><textarea>UNRELATED_FORM_SECRET</textarea><div class="monaco-editor"><div class="view-lines"><div class="view-line">VISIBLE_FRAGMENT</div></div></div><div role="log">Input [3, 3], target 6</div></main><script>window.monaco={editor:{getModels:()=>[{getValue:()=>"def solve(nums, target):\\n    return []",getLanguageId:()=>"python"}]}};</script>`);});
 const reservation=http.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const base=`http://127.0.0.1:${port}`;
 async function request(route,body,method='POST'){
  const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});const {value}=await r.json();if(value?.error)throw Error(value.message);return value;
 }
 const command=(route,body)=>request('/session/'+session.sessionId+route,body);
 const chrome=script=>command('/execute/sync',{script,args:[]});
 async function popup(expression){
  const name='clair-test-'+Math.random().toString(36).slice(2);
  const script=`const done=arguments[arguments.length-1],mm=document.querySelector('browser[webextension-view-type=popup]')?.messageManager;if(!mm){done(null);return;}const name=arguments[0],listener=m=>{mm.removeMessageListener(name,listener);done(m.data);};mm.addMessageListener(name,listener);mm.loadFrameScript('data:application/javascript,'+encodeURIComponent(arguments[1]),false);`;
  return command('/execute/async',{script,args:[name,`try{sendAsyncMessage(${JSON.stringify(name)},(${expression}));}catch(e){sendAsyncMessage(${JSON.stringify(name)},{error:e.message});}`]});
 }
 try{
  const pairing=await bridge.start();await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
  driver=spawn(process.env.GECKODRIVER||'geckodriver',['--port',String(port),'--allow-system-access'],{stdio:['ignore','pipe','pipe']});driver.on('error',error=>{driverLog=error.message;});for(const stream of [driver.stdout,driver.stderr])stream.on('data',data=>{driverLog=(driverLog+data).slice(-4000);});
  await until(async()=>{try{return (await request('/status',undefined,'GET')).ready;}catch{return false;}});
  session=await request('/session',{capabilities:{alwaysMatch:{browserName:'firefox','moz:firefoxOptions':{args:['-headless'],...(process.env.FIREFOX_BIN?{binary:process.env.FIREFOX_BIN}:{})}}}});
  await command('/moz/addon/install',{path:path.resolve('release/Clair-Firefox.zip'),temporary:true});
  // localhost is intentionally outside the extension's 127.0.0.1 host grant:
  // extraction must rely on the action's activeTab permission.
  await command('/url',{url:`http://localhost:${fixture.address().port}/`});
  await command('/execute/sync',{script:"const range=document.createRange();range.selectNodeContents(document.querySelector('#problem'));getSelection().removeAllRanges();getSelection().addRange(range);",args:[]});
  await command('/moz/context',{context:'chrome'});
  await chrome("document.getElementById('unified-extensions-button').click();return true;");
  await until(()=>chrome("return !!document.getElementById('coding_clair_galagain-BAP');"));
  await chrome("document.getElementById('coding_clair_galagain-BAP').click();return true;");
  const read=()=>popup(`({status:content.document.querySelector('#status')?.textContent,statement:content.document.querySelector('#statement')?.value,code:content.document.querySelector('#code')?.value,tests:content.document.querySelector('#tests')?.value,warning:content.document.querySelector('#warning')?.textContent})`);
  const preview=await until(async()=>{const value=await read();return value?.status?.startsWith('Vérifiez')&&value;});
  assert.equal(preview.statement,'Find two indices whose values add up to the target.');assert.equal(preview.code,'def solve(nums, target):\n    return []');assert.match(preview.tests,/Input/);assert.equal(preview.warning,'');assert.equal(captures.length,0);
  await popup(`(()=>{content.document.querySelector('#pairing').value=${JSON.stringify(pairing)};content.document.querySelector('#connect').click();return true;})()`);
  await until(async()=>(await read())?.status==='Clair connecté.');assert.equal(captures.length,0);
  await popup(`(()=>{content.document.querySelector('#send').click();return true;})()`);
  await until(async()=>(await read())?.status?.startsWith('Envoyé.'));
  assert.equal(captures.length,1);assert.equal(captures[0].source,'localhost');assert.equal(captures[0].code,preview.code);assert.ok(!JSON.stringify(captures[0]).includes('SECRET'));
  // Firefox's registered keyboard command on a fresh tab, without a popup or a
  // pre-existing activeTab grant. The editor and active tab must not change.
  await chrome("document.querySelector('browser[webextension-view-type=popup]')?.closest('panel')?.hidePopup();document.getElementById('unified-extensions-panel').hidePopup();return true;");
  await command('/moz/context',{context:'content'});
  const fresh=await command('/window/new',{type:'tab'});await command('/window',{handle:fresh.handle});
  await command('/url',{url:`http://localhost:${fixture.address().port}/shortcut`});
  await command('/execute/sync',{script:"const range=document.createRange();range.selectNodeContents(document.querySelector('.view-line'));getSelection().removeAllRanges();getSelection().addRange(range);",args:[]});
  const shortcut=async(mode='text')=>{
   await command('/moz/context',{context:'chrome'});
   // Headless WebDriver key actions do not reliably reach macOS browser
   // shortcuts. Invoke Firefox's own key binding, not an extension test hook.
   const binding=await chrome("const key=[...document.querySelectorAll('#ext-keyset-id-coding_clair_galagain key')].find(key=>key.getAttribute('key')==="+JSON.stringify(mode==='visual'?'V':'C')+");const result={key:key.getAttribute('key'),modifiers:key.getAttribute('modifiers')};key.doCommand();return result;");
   assert.equal(binding.key,mode==='visual'?'V':'C');assert.equal(binding.modifiers,'alt,shift');
   await command('/moz/context',{context:'content'});
  };
  await shortcut();await until(()=>captures.length===2);
  assert.equal(captures[1].code,preview.code);assert.match(captures[1].statement,/Find two indices/);assert.ok(!JSON.stringify(captures[1]).includes('SECRET'));
  assert.equal(await command('/execute/sync',{script:'return window.monaco.editor.getModels()[0].getValue()',args:[]}),preview.code);
  await command('/moz/context',{context:'chrome'});
  assert.equal(await chrome("return document.querySelector('browser[webextension-view-type=popup]')?.closest('panel')?.state==='open';"),false);
  // Inspect rendered DOM fallback after removing the exposed model. The user
  // must be told that only the visible code was recovered.
  await chrome("document.querySelector('browser[webextension-view-type=popup]')?.closest('panel')?.hidePopup();document.getElementById('unified-extensions-panel').hidePopup();return true;");
  await command('/moz/context',{context:'content'});
  await command('/execute/sync',{script:"delete window.monaco;getSelection().removeAllRanges();",args:[]});
  await command('/moz/context',{context:'chrome'});
  await chrome("document.getElementById('unified-extensions-button').click();return true;");
  await until(()=>chrome("return !!document.getElementById('coding_clair_galagain-BAP');"));
  await chrome("document.getElementById('coding_clair_galagain-BAP').click();return true;");
  const fallback=await until(async()=>{const value=await read();return value?.code==='VISIBLE_FRAGMENT'&&value;});assert.match(fallback.warning,/manquer des lignes/);assert.ok(!fallback.statement.includes('SECRET'));assert.equal(captures.length,2);
  await chrome("document.querySelector('browser[webextension-view-type=popup]')?.closest('panel')?.hidePopup();document.getElementById('unified-extensions-panel').hidePopup();return true;");
  await command('/moz/context',{context:'content'});await shortcut();await until(()=>captures.length===3);assert.match(captures[2].warning,/manquer des lignes/);
  await command('/execute/sync',{script:"document.querySelector('#problem').textContent='Second exercise: reverse a linked list.';const range=document.createRange();range.selectNodeContents(document.querySelector('h1'));getSelection().removeAllRanges();getSelection().addRange(range);",args:[]});
  await shortcut();await until(()=>captures.length===4);assert.match(captures[3].statement,/Second exercise: reverse a linked list/);
  captureMode='visual';
  await command('/execute/sync',{script:"const image=document.createElement('img');image.id='visual-fixture';image.style.cssText='display:block;margin-top:1800px;width:320px;height:160px';image.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"160\"><rect width=\"320\" height=\"160\" fill=\"#e22469\"/><text x=\"20\" y=\"80\" fill=\"white\">IMAGE-ONLY INSTRUCTION</text></svg>');document.body.append(image);",args:[]});
  await until(()=>command('/execute/sync',{script:"return document.querySelector('#visual-fixture').complete;",args:[]}));
  await shortcut('visual');await until(()=>captures.length===5);assert.ok(captures[4].images.length>=2);assert.match(captures[4].images[0].url,/^data:image\/jpeg;base64,/);
  const {loadImage,createCanvas}=require('@napi-rs/canvas');const tile=await loadImage(Buffer.from(captures[4].images.at(-1).url.split(',')[1],'base64'));assert.equal(tile.width,captures[4].images.at(-1).width);assert.equal(tile.height,captures[4].images.at(-1).height);
  const canvas=createCanvas(tile.width,tile.height),ctx=canvas.getContext('2d');ctx.drawImage(tile,0,0);const pixels=ctx.getImageData(0,0,tile.width,tile.height).data;let found=false;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>200&&pixels[i+1]<70&&pixels[i+2]>70&&pixels[i+2]<150){found=true;break;}assert.equal(found,true,'Offscreen image must appear in a captured tile');
  await shortcut('text');await until(()=>captures.length===6);assert.equal(captures[5].images,undefined);assert.equal(captures[5].captureMode,'text');
  await bridge.close();await shortcut();await pause(300);
  await command('/moz/context',{context:'chrome'});
  assert.equal(await chrome("return document.querySelector('browser[webextension-view-type=popup]')?.closest('panel')?.state==='open';"),false);
  await until(()=>chrome("return document.querySelector('#coding_clair_galagain-BAP .toolbarbutton-badge')?.textContent==='!';"));assert.equal(captures.length,6);
  console.log('Firefox QA passed: real temporary add-on, activeTab, selection, full model, partial-code warning, pairing, direct keyboard send without popup, unchanged editor and disconnected shortcut. No OpenAI requests.');
 }catch(error){try{await command('/moz/context',{context:'chrome'});console.error('Shortcut diagnostic:',await chrome("return {key:document.querySelector('#ext-keyset-id-coding_clair_galagain key')?.outerHTML,title:document.getElementById('coding_clair_galagain-BAP')?.getAttribute('tooltiptext'),badge:document.querySelector('#coding_clair_galagain-BAP .toolbarbutton-badge')?.textContent};"));}catch{}console.error(driverLog);throw error;}
 finally{if(session)await fetch(base+'/session/'+session.sessionId,{method:'DELETE'}).catch(()=>{});driver?.kill();await bridge.close();fixture.closeAllConnections();await new Promise(resolve=>fixture.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
