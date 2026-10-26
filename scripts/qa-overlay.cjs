// Real OS mouse routing into a disposable window behind Clair. The helper only
// posts events inside these test windows; no personal application is targeted.
const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
(async()=>{
 const helper=process.env.CLAIR_MOUSE_HELPER;if(!helper)throw Error('Set CLAIR_MOUSE_HELPER to the authorized native test pointer helper.');
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'clair-overlay-qa-'));
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 const app=await electron.launch({executablePath:path.resolve('release/mac-arm64/Clair.app/Contents/MacOS/Clair'),args:['--user-data-dir='+profile],env});
 let initial;
 const pointer=(kind,x,y,...rest)=>execFileSync(helper,[kind,String(x),String(y),...rest.map(String)]);
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>document.body.dataset.sessionStatus?.includes('Configurez'));
  const setup=await app.evaluate(async({BrowserWindow,screen,ipcMain})=>{
   const main=BrowserWindow.getAllWindows()[0],cursor=screen.getCursorScreenPoint();global.qaMain=main;const original=main.setIgnoreMouseEvents.bind(main);main.setIgnoreMouseEvents=(value,options)=>{global.qaIgnored=value;return original(value,options);};ipcMain.on('window:layout',(_e,data)=>global.qaLayout=data);
   const bounds=main.getBounds();const under=new BrowserWindow({x:bounds.x-30,y:bounds.y-20,width:bounds.width+60,height:Math.max(650,bounds.height+80),show:false,acceptFirstMouse:true,webPreferences:{sandbox:true}});global.qaUnder=under;
   await under.loadURL('data:text/html,'+encodeURIComponent('<body style="margin:0"><button style="position:fixed;inset:0;background:#283246;color:white">Clair mouse test target</button><script>window.hits=0;document.querySelector("button").onclick=()=>window.hits++;</script>'));
   under.show();main.show();main.focus();return{cursor,bounds};
  });initial=setup.cursor;
  assert.ok(setup.bounds.height<400,'Startup should fit its content');
  const hits=()=>app.evaluate(()=>global.qaUnder.webContents.executeJavaScript('window.hits'));
  const point=async selector=>{const rect=await page.locator(selector).boundingBox(),bounds=await app.evaluate(()=>global.qaMain.getContentBounds());return{x:bounds.x+rect.x+rect.width/2,y:bounds.y+rect.y+rect.height/2};};
  const click=async selector=>{const p=await point(selector);pointer('click',p.x,p.y);};
  await click('#answer');if(await hits()!==1)console.log(await app.evaluate(({screen})=>({cursor:screen.getCursorScreenPoint(),bounds:global.qaMain.getContentBounds(),ignored:global.qaIgnored,layout:global.qaLayout,under:global.qaUnder.getContentBounds()})));assert.equal(await hits(),1,'Text must pass a real click to the target underneath');
  await click('#files-tab');await page.waitForFunction(()=>!document.querySelector('#files-panel').hidden);assert.equal(await hits(),1,'A real click on a control must stay in Clair');
  const filesBounds=await app.evaluate(()=>global.qaMain.getBounds());await click('#files-tab');await page.waitForFunction(()=>!document.querySelector('#session-panel').hidden);assert.deepEqual(await app.evaluate(()=>global.qaMain.getBounds()),filesBounds);
  await click('#settings-tab');await click('#key');assert.equal(await page.evaluate(()=>document.activeElement.id),'key');await click('#settings-tab');
  assert.equal(await page.locator('#opacity').isVisible(),false);await click('#opacity-toggle');await page.waitForFunction(()=>!document.querySelector('#opacity').hidden);
  const slider=await point('#opacity');pointer('drag',slider.x,slider.y,slider.x+50,slider.y+90);assert.equal(await hits(),1,'Dragging a control must not leak a click behind');await click('#opacity-toggle');assert.equal(await page.locator('#opacity').isVisible(),false);
  await click('#answer-language');execFileSync(helper,['escape']);
  await click('#transcription-language');execFileSync(helper,['escape']);
  await click('#files-tab');await page.waitForFunction(()=>!document.querySelector('#files-panel').hidden);await click('#files-tab');
  // The answer stream scrollbar catches real mouse drags; its text stays passive.
  await app.evaluate(()=>{for(let id=1;id<=12;id++)for(const event of [{type:'answer-start',id},{type:'answer-delta',id,text:'[[REPONSE]] • A distinct idea number '+id+' to continue this answer.'},{type:'answer-done',id}])global.qaMain.webContents.send('clair:event',event);});
  await page.waitForFunction(()=>document.querySelectorAll('#answer .answer-entry').length===12);
  const beforeScroll=await page.locator('#answer').evaluate(el=>el.scrollTop);assert.ok(beforeScroll>0);
  const scrollRect=await page.locator('#answer').boundingBox(),scrollBounds=await app.evaluate(()=>global.qaMain.getContentBounds());
  pointer('drag',scrollBounds.x+scrollRect.x+scrollRect.width-2,scrollBounds.y+scrollRect.y+scrollRect.height-8,scrollBounds.x+scrollRect.x+scrollRect.width-2,scrollBounds.y+scrollRect.y+8);
  await page.waitForFunction(before=>document.querySelector('#answer').scrollTop<before,beforeScroll);
  assert.equal(await page.locator('#history-hold').isVisible(),true);await click('#history-hold');
  assert.ok(await page.locator('#answer').evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight<24));
  await app.evaluate(()=>global.qaMain.webContents.send('clair:event',{type:'cleared'}));
  await page.waitForFunction(()=>document.querySelector('#answer').classList.contains('placeholder'));
  // A manually enlarged empty area must also be transparent to OS clicks.
  await app.evaluate(()=>global.qaMain.setSize(400,520));
  let bounds=await app.evaluate(()=>global.qaMain.getBounds());pointer('click',bounds.x+200,bounds.y+480);assert.equal(await hits(),2,'Empty native bounds must not intercept clicks');
  await click('#more-toggle');assert.equal(await page.locator('#more-menu').isVisible(),true);await click('#more-toggle');
  // Native draggable strip at the bottom of the bar remains available.
  const header=await page.locator('header').boundingBox();bounds=await app.evaluate(()=>global.qaMain.getBounds());
  pointer('drag',bounds.x+header.x+5,bounds.y+header.y+header.height/2,bounds.x+header.x+35,bounds.y+header.y+header.height/2+10);
  const moved=await app.evaluate(()=>global.qaMain.getBounds());assert.ok(moved.x!==bounds.x||moved.y!==bounds.y,'Header must still drag the native window');
  await click('#files-tab');await page.waitForFunction(()=>!document.querySelector('#files-panel').hidden);await click('#files-tab');
  const resizeBefore=await app.evaluate(()=>global.qaMain.getBounds());
  pointer('drag',resizeBefore.x+resizeBefore.width-2,resizeBefore.y+resizeBefore.height-2,resizeBefore.x+resizeBefore.width-22,resizeBefore.y+resizeBefore.height-22);
  const resized=await app.evaluate(()=>global.qaMain.getBounds());assert.ok(resized.width!==resizeBefore.width||resized.height!==resizeBefore.height,'Bottom corner must resize the window');
  const before=await hits();await click('#answer');assert.equal(await hits(),before+1,'Pass-through must still work after moving and navigating');
  await page.screenshot({path:'release/qa/clair-mac-pass-through.png',omitBackground:true});
  console.log('Real macOS pointer QA passed: clicks on text and blank space reached a disposable window underneath; controls, slider drag, native select dismissal, typing focus, tab toggles, native movement, corner resizing and routing after movement passed.');
 }catch(error){console.log(await app.evaluate(({screen})=>({cursor:screen.getCursorScreenPoint(),bounds:global.qaMain?.getContentBounds(),ignored:global.qaIgnored,layout:global.qaLayout,mainFocused:global.qaMain?.isFocused(),underFocused:global.qaUnder?.isFocused()})));throw error;}finally{await app.close();if(initial)pointer('move',initial.x,initial.y);await fs.rm(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
