const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'clair-scroll-qa-')),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 const packaged=process.argv.includes('--packaged');const app=await electron.launch({env,executablePath:packaged?path.resolve('release/mac-arm64/Clair.app/Contents/MacOS/Clair'):require('electron'),args:[...(packaged?[]:[path.resolve('.')]),'--user-data-dir='+profile]});
 try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!document.querySelector('#mouse-enable').onclick);
  assert.equal((await page.evaluate(()=>window.clair.config())).hasKey,false);
  await app.evaluate(({BrowserWindow,ipcMain,screen})=>{global.scrollLayout=null;ipcMain.on('window:layout',(_e,value)=>{global.scrollLayout=value;});global.scrollCursor={x:300,y:300};screen.getCursorScreenPoint=()=>global.scrollCursor;BrowserWindow.getAllWindows()[0].setSize(440,720);});
  await page.evaluate(()=>window.clair.preferences({translationEnabled:true}));await page.locator('#coding-tab').click();
  await page.evaluate(()=>{for(const id of ['transcript','translation','answer']){const feed=document.getElementById(id);feed.textContent=Array.from({length:90},(_,i)=>`Ligne ${i+1} : texte de test pour vérifier la molette.`).join('\n');feed.style.whiteSpace='pre-wrap';feed.style.maxHeight='140px';feed.scrollTop=0;}});
  await page.evaluate(()=>{const code=document.getElementById('coding-solution');code.hidden=false;code.textContent=Array.from({length:90},(_,i)=>`# étape ${i+1}`).join('\n');document.getElementById('coding-empty').hidden=true;});
  for(const id of ['transcript','translation','answer','coding-feed']){
   const feed=page.locator('#'+id);await feed.scrollIntoViewIfNeeded();await feed.evaluate(el=>el.scrollTop=100);
   const rect=await feed.boundingBox(),point={x:rect.x+rect.width/2,y:rect.y+rect.height/2};
   await page.waitForTimeout(80);const layout=await app.evaluate(()=>global.scrollLayout);assert.ok(layout.regions.some(r=>point.x>=r.x&&point.x<r.x+r.width&&point.y>=r.y&&point.y<r.y+r.height),'Whole '+id+' feed must catch mouse input, not only its scrollbar');
   await page.mouse.move(point.x,point.y);await page.mouse.wheel(0,180);await page.waitForFunction(id=>document.getElementById(id).scrollTop>100,id);
   const down=await feed.evaluate(el=>el.scrollTop);await page.mouse.wheel(0,-150);await page.waitForFunction(({id,down})=>document.getElementById(id).scrollTop<down,{id,down});
  }
  const handle=page.locator('#window-resize'),box=await handle.boundingBox();assert.equal(box.width,24);assert.equal(box.height,24);
  const before=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getSize());await handle.hover();await page.mouse.down();await page.waitForTimeout(60);
  await app.evaluate(()=>{global.scrollCursor={x:380,y:360};});await page.waitForFunction(([w,h])=>innerWidth===w+80&&innerHeight===h+60,before);await page.mouse.up();
  const resized=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getSize());await page.locator('#settings-tab').click();assert.deepEqual(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getSize()),resized);
  await page.locator('#settings-tab').click();await fs.mkdir('release/qa',{recursive:true});await page.screenshot({path:'release/qa/clair-scroll-resize.png',omitBackground:true});assert.deepEqual(errors,[]);
  console.log('Scroll/resize QA passed: full feed hit regions, real Chromium wheel up/down in speech, translation, answers and code, visible 24px handle, drag via IPC and stable size across tabs. No API calls or personal data.');
 }finally{await app.close();await fs.rm(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
