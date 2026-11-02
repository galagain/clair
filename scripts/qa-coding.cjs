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
  await app.evaluate(async({app,clipboard,safeStorage})=>{
   clipboard.writeText=text=>{global.codingQaClipboard=text;};
   // This test exercises Coding, not the OS keychain. Only a synthetic key is
   // written in the temporary profile; never prompt for personal keychain access.
   safeStorage.isAsyncEncryptionAvailable=async()=>true;
   safeStorage.encryptStringAsync=async()=>Buffer.from('QA-encrypted-placeholder');
   const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');
   const {CodingBridge}=require('./src/coding-bridge.cjs'),listen=CodingBridge.prototype.listen;
   CodingBridge.prototype.listen=function(){this.port=0;return listen.call(this);};
   const {InterviewEngine}=require('./src/engine.mjs'),configure=InterviewEngine.prototype.configure;
   InterviewEngine.prototype.configure=function(c){global.codingQaInterview=this;return configure.call(this,c);};
   const {CodingEngine}=require('./src/coding-engine.mjs');
   const original=CodingEngine.prototype.run;
   CodingEngine.prototype.run=function(entry,args){
    this.fetch=async(_url,init)=>{
     const body=JSON.parse(init.body),input=JSON.parse(body.input[0].content),exercise=input.exercice;
     if(body.instructions.startsWith('Explique pédagogiquement')){global.codingQaNotes=input;return new Response('data: '+JSON.stringify({type:'response.output_text.delta',delta:'[[REPONSE]] • **Approche** : parcourir les valeurs.\n• Retenir les valeurs déjà vues.\n• Complexité : O(n) en temps et en mémoire.'})+'\n\ndata: '+JSON.stringify({type:'response.completed'})+'\n\n');}
     global.codingQaRequests=(global.codingQaRequests||0)+1;global.codingQaBody=body;
     if(input.echanges)await new Promise(resolve=>{global.codingQaReviewRelease=resolve;});
     if(input.paroles)await new Promise(resolve=>{global.codingQaVoiceRelease=resolve;});
     if(exercise.title==='Slow')await new Promise(resolve=>{global.codingQaRelease=resolve;});
     const text=input.echanges?'def sum_values(xs):\n    # Traiter aussi le cas vide.\n    return sum(xs) if xs else 0':input.paroles?'def sum_values(xs):\n    # Accumuler les valeurs une à une.\n    total = 0\n    for value in xs:\n        total += value\n    return total':exercise.title==='Slow'?'OLD_RESULT':exercise.title==='Fixture'?'def sum_values(xs):\n    return sum(xs)':'def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i';
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
  const openMenu=async()=>{await page.locator('#coding-menu-toggle').click();};
  assert.equal(await page.locator('#coding-panel button:not(#coding-reanalyze),#coding-panel select,#coding-panel textarea,#coding-panel details').count(),0);
  await openMenu();assert.equal(await page.locator('#coding-menu').isVisible(),true);
  assert.deepEqual(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds()),bounds);
  assert.equal(await page.locator('.titlebar #coding-menu-toggle').count(),1);
  for(const id of ['coding-language','coding-next','coding-copy','coding-clear'])assert.equal(await page.locator('.coding-toolbar #'+id).count(),1);
  await page.locator('#coding-menu-toggle').click();assert.equal(await page.locator('#coding-menu').isVisible(),false);await openMenu();
  await page.keyboard.press('Escape');assert.equal(await page.locator('#coding-menu').isVisible(),false);
  await openMenu();
  await page.locator('#coding-statement').fill('Find two indices that add up to target.');
  await page.locator('#coding-next').click();await page.waitForFunction(()=>document.querySelector('#coding-status').textContent.includes('clé API'));
  assert.match(await page.locator('#coding-menu-status').textContent(),/clé API/);
  assert.equal(await page.locator('#coding-menu-status').isVisible(),true);
  assert.equal(await app.evaluate(()=>global.codingQaRequests||0),0);
  await page.evaluate(()=>window.clair.saveKeys({key:'sk-synthetic-coding-test-only-000000000'}));
  await page.locator('#coding-code').fill('def two_sum(nums, target):\n    pass');
  await page.locator('#coding-next').click();await page.waitForFunction(()=>document.querySelector('#coding-solution').textContent.includes('return [')&&document.querySelector('#coding-stop').hidden);
  assert.match(await page.locator('#coding-solution').textContent(),/\n        if/);
  assert.equal(await page.locator('#coding-hint,#coding-review,#coding-explain,#coding-latest,.coding-entry h2').count(),0);
  assert.equal(await page.locator('#coding-menu').isVisible(),false);await openMenu();
  await page.waitForFunction(()=>document.querySelector('#answer').textContent.includes('Complexité'));
  assert.match(await page.locator('#answer').textContent(),/Repères du code/);
  await page.locator('#coding-menu-close').click();await page.locator('#coding-reanalyze').click();await page.waitForFunction(()=>document.querySelector('#coding-status').textContent.includes('Contexte récent'));assert.match(await page.locator('#coding-solution').textContent(),/return \[/);
  await openMenu();await page.locator('#coding-copy').click();assert.equal(await app.evaluate(()=>global.codingQaClipboard),await page.locator('#coding-solution').textContent());
  const preserved=await page.locator('#coding-feed').textContent();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('clair:event',{type:'transcript',id:'qa',text:'Speech must not change coding.',final:true}));
  assert.equal(await page.locator('#coding-feed').textContent(),preserved);
  await page.locator('#coding-browser').evaluate(el=>el.open=true);await page.locator('#coding-pair').click();
  const pairing=await app.evaluate(()=>global.codingQaClipboard);assert.match(pairing,/^clair:\d+:[a-f0-9]{64}$/);
  const [,port,token]=pairing.split(':');
  const send=title=>fetch(`http://127.0.0.1:${port}/v1/coding`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({statement:'Calculate the sum.',code:'def sum_values(xs):\n    return sum(xs)',language:'python',source:'exercise.test',title})});
  assert.equal((await send('Slow')).status,202);
  await page.waitForFunction(()=>!document.querySelector('#coding-stop').hidden&&document.querySelector('#coding-solution').textContent==='');
  assert.equal((await send('Fixture')).status,202);
  await page.waitForFunction(()=>document.querySelector('#coding-solution').textContent.includes('return sum(xs)')&&document.querySelector('#coding-stop').hidden);
  await app.evaluate(()=>global.codingQaRelease());
  assert.equal(await page.locator('#coding-source').textContent(),'exercise.test');
  assert.equal(await page.locator('#coding-solution').textContent(),'def sum_values(xs):\n    return sum(xs)');
  const state=await page.evaluate(()=>window.clair.codingState());assert.equal(state.history.length,1);assert.equal(state.history[0].title,'Fixture');
  // Stale events cannot change the replacement or its controls.
  await app.evaluate(({BrowserWindow})=>{const wc=BrowserWindow.getAllWindows()[0].webContents;wc.send('clair:event',{type:'coding-delta',id:1,text:'OLD_RESULT'});wc.send('clair:event',{type:'coding-error',id:1,error:'Old error'});});
  assert.equal(await page.locator('#coding-solution').textContent(),'def sum_values(xs):\n    return sum(xs)');assert.equal(await page.locator('#coding-status').textContent(),'');
  await page.evaluate(()=>window.clair.preferences({codingAutoVoice:true}));
  const requests=await app.evaluate(()=>global.codingQaRequests);
  await app.evaluate(()=>{global.codingQaInterview.running=true;global.codingQaInterview.notify('transcript',{id:'voice-system',speaker:'system',final:true,text:'Use a loop to sum the numbers.'});global.codingQaInterview.notify('transcript',{id:'voice-mic',speaker:'microphone',final:false,text:'Use a loop'});});
  assert.equal(await app.evaluate(()=>global.codingQaRequests),requests);
  await app.evaluate(()=>global.codingQaInterview.notify('transcript',{id:'voice-mic',speaker:'microphone',final:true,text:'Use a loop to sum the numbers.'}));
  await page.waitForFunction(()=>document.querySelector('#coding-status').textContent.includes('Adaptation'));
  assert.equal(await page.locator('#coding-solution').textContent(),'def sum_values(xs):\n    return sum(xs)');
  await app.evaluate(()=>global.codingQaVoiceRelease());
  await page.waitForFunction(()=>document.querySelector('#coding-solution').textContent.includes('# Accumuler'));
  assert.match(await app.evaluate(()=>JSON.parse(global.codingQaBody.input[0].content).paroles),/Use a loop/);
  await openMenu();await page.locator('#coding-undo').click();assert.equal(await page.locator('#coding-solution').textContent(),'def sum_values(xs):\n    return sum(xs)');
  await page.locator('#coding-auto-voice').uncheck();assert.equal((await page.evaluate(()=>window.clair.config())).codingAutoVoice,false);
  await page.locator('#coding-menu-close').click();
  const beforeReview=await page.locator('#coding-solution').textContent();
  await app.evaluate(()=>{global.codingQaInterview.notify('transcript',{id:'recent-system',speaker:'system',final:true,text:'The array may be empty.'});global.codingQaInterview.notify('transcript',{id:'recent-mic',speaker:'microphone',final:true,text:'Then return zero for an empty array.'});});
  await page.locator('#coding-reanalyze').click();await page.waitForFunction(()=>document.querySelector('#coding-status').textContent.includes('Réanalyse'));
  await app.evaluate(async()=>{for(let i=0;i<100&&!global.codingQaReviewRelease;i++)await new Promise(r=>setTimeout(r,10));});
  assert.equal(await page.locator('#coding-solution').textContent(),beforeReview);
  assert.match(await app.evaluate(()=>JSON.parse(global.codingQaBody.input[0].content).echanges),/Micro.*Then return zero/s);assert.match(await app.evaluate(()=>JSON.parse(global.codingQaBody.input[0].content).echanges),/Ordinateur.*array may be empty/s);
  await app.evaluate(()=>global.codingQaReviewRelease());await page.waitForFunction(()=>document.querySelector('#coding-solution').textContent.includes('if xs else 0'));
  await app.evaluate(()=>{global.codingQaInterview.running=false;global.codingQaInterview.notify('stopped',{});});
  assert.equal(await page.locator('#coding-menu').isVisible(),false);
  await page.locator('#speech-toggle').click();await page.locator('#answer-toggle').click();
  await fs.mkdir('release/qa',{recursive:true});await page.screenshot({path:'release/qa/clair-coding.png',omitBackground:true});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(340,520));
  await page.evaluate(()=>window.scrollTo(0,0));await page.locator('#opacity-toggle').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('#close').evaluate(el=>el.getBoundingClientRect().right<=innerWidth),true);
  await page.screenshot({path:'release/qa/clair-coding-narrow.png',omitBackground:true});
  await openMenu();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'release/qa/clair-coding-menu.png',omitBackground:true});
  await page.locator('#coding-clear').click();assert.equal(await page.locator('#coding-solution').textContent(),'');
  assert.equal(await page.locator('#coding-code').inputValue(),'');
  await page.evaluate(()=>window.clair.codingDisconnect());
  await assert.rejects(fetch(`http://127.0.0.1:${port}/v1/status`));
  assert.deepEqual(errors,[]);console.log('Coding QA passed: solution only, replacement via bridge, cancellation, ignored stale output, exact code copy, top settings menu, code-only panel with refresh, pedagogical notes in Pistes, recent microphone and system context, manual reanalysis with stable code, automatic microphone adaptation, stable code during generation, undo, disabling voice, stable bounds, tabs and narrow layout.');
 }finally{await app.close();await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
})().catch(error=>{console.error(error);process.exitCode=1;});
