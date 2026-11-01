const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');

(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'clair-coding-qa-'));
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 const packaged=process.env.CLAIR_APP||(process.argv.includes('--packaged')?path.resolve(process.platform==='win32'?'release/win-unpacked/Clair.exe':'release/mac-arm64/Clair.app/Contents/MacOS/Clair'):null);
 const app=await electron.launch({env,executablePath:packaged||require('electron'),args:[...(packaged?[]:[path.resolve('.')]),'--user-data-dir='+profile],timeout:30000});
 const errors=[];
 try{
  const page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));
  await page.waitForFunction(()=>!!document.querySelector('#coding-tab').onclick);
  assert.equal((await page.evaluate(()=>window.clair.config())).hasKey,false);
  // Replace the transport only in this isolated process. No real key/API/audio.
  await app.evaluate(async({app,clipboard})=>{
   clipboard.writeText=text=>{global.codingQaClipboard=text;};
   const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');
   const {CodingBridge}=require('./src/coding-bridge.cjs'),listen=CodingBridge.prototype.listen;
   CodingBridge.prototype.listen=function(){this.port=0;return listen.call(this);};
   const {CodingEngine}=require('./src/coding-engine.mjs');
   const original=CodingEngine.prototype.run;
   CodingEngine.prototype.run=function(entry,args){
    this.fetch=async(_url,init)=>{
     global.codingQaRequests=(global.codingQaRequests||0)+1;
     global.codingQaBody=JSON.parse(init.body);
     const text='[[ETAPE]] • Use a **dictionary** for previously seen values.\n• Check the complement before inserting the current index.\n[[POURQUOI]] Each lookup is expected O(1).\n[[DIRE]] Checking before insertion keeps the indices distinct.\n[[CODE]] seen = {}\nfor i, n in enumerate(nums):\n    if target - n in seen:\n        return [seen[target - n], i]\n    seen[n] = i\n[[TESTS]] [3, 3], target 6 → [0, 1]. Not executed.\n[[COMPLEXITE]] Expected O(n) time and O(n) space.';
     const events=[{type:'response.output_text.delta',delta:text},{type:'response.completed',response:{usage:{input_tokens:12,output_tokens:15}}}];
     return new Response(events.map(event=>'data: '+JSON.stringify(event)+'\n\n').join(''),{headers:{'Content-Type':'text/event-stream'}});
    };
    return original.call(this,entry,args);
   };
  });
  // Test a user-sized window, after startup's asynchronous content fit.
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(400,520));
  await page.waitForFunction(()=>innerHeight===520);
  const bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
  await page.locator('#coding-tab').click();assert.equal(await page.locator('#coding-panel').isVisible(),true);
  assert.deepEqual(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds()),bounds);
  await page.locator('#coding-tab').click();assert.equal(await page.locator('#session-panel').isVisible(),true);
  await page.locator('#coding-tab').click();
  await page.locator('#coding-statement').fill('Find two indices that add up to target.');
  await page.locator('#coding-next').click();await page.waitForFunction(()=>document.querySelector('#coding-status').textContent.includes('clé API'));
  assert.equal(await app.evaluate(()=>global.codingQaRequests||0),0);
  await page.evaluate(()=>window.clair.saveKeys({key:'sk-synthetic-coding-test-only-000000000'}));
  await page.locator('#coding-code').fill('def two_sum(nums, target):\n    pass');
  await page.locator('#coding-next').click();await page.waitForFunction(()=>document.querySelectorAll('.coding-entry').length===1&&!document.querySelector('#coding-next').disabled);
  assert.match(await page.locator('.coding-code-block').textContent(),/\n    if/);
  await page.evaluate(()=>window.qaCodingFirst=document.querySelector('.coding-entry'));
  await page.locator('#coding-review').click();await page.waitForFunction(()=>document.querySelectorAll('.coding-entry').length===2&&!document.querySelector('#coding-next').disabled);
  assert.equal(await page.evaluate(()=>window.qaCodingFirst===document.querySelector('.coding-entry')),true);
  const preserved=await page.locator('#coding-feed').textContent();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('clair:event',{type:'transcript',id:'qa',text:'Speech must not change coding.',final:true}));
  assert.equal(await page.locator('#coding-feed').textContent(),preserved);
  await page.locator('#coding-browser').evaluate(el=>el.open=true);await page.locator('#coding-pair').click();
  const pairing=await app.evaluate(()=>global.codingQaClipboard);assert.match(pairing,/^clair:\d+:[a-f0-9]{64}$/);
  const [,port,token]=pairing.split(':');
  const response=await fetch(`http://127.0.0.1:${port}/v1/coding`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({statement:'Calculate the sum.',code:'def sum_values(xs):\n    return sum(xs)',language:'python',source:'exercise.test',title:'Fixture'})});assert.equal(response.status,202);
  await page.waitForFunction(()=>document.querySelectorAll('.coding-entry').length===3&&!document.querySelector('#coding-next').disabled);
  assert.equal(await page.locator('#coding-source').textContent(),'exercise.test');
  await page.locator('#coding-feed').evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});
  const scrollTop=await page.locator('#coding-feed').evaluate(el=>el.scrollTop);
  await page.locator('#coding-hint').click();await page.waitForFunction(()=>document.querySelectorAll('.coding-entry').length===4&&!document.querySelector('#coding-next').disabled);
  assert.equal(await page.locator('#coding-feed').evaluate(el=>el.scrollTop),scrollTop);
  assert.equal(await page.evaluate(()=>window.qaCodingFirst===document.querySelector('.coding-entry')),true);
  await fs.mkdir('release/qa',{recursive:true});await page.screenshot({path:'release/qa/clair-coding.png',omitBackground:true});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(340,520));
  await page.evaluate(()=>window.scrollTo(0,0));await page.locator('#opacity-toggle').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('#close').evaluate(el=>el.getBoundingClientRect().right<=innerWidth),true);
  await page.screenshot({path:'release/qa/clair-coding-narrow.png',omitBackground:true});
  await page.locator('#coding-clear').click();assert.equal(await page.locator('.coding-entry').count(),0);
  assert.equal(await page.locator('#coding-code').inputValue(),'');
  await page.evaluate(()=>window.clair.codingDisconnect());
  await assert.rejects(fetch(`http://127.0.0.1:${port}/v1/status`));
  assert.deepEqual(errors,[]);console.log('Coding QA passed: isolated app, stream, history, bridge, copy, tabs and narrow layout.');
 }finally{await app.close();await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
})().catch(error=>{console.error(error);process.exitCode=1;});
