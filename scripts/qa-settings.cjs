const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'clair-settings-qa-')),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 const packaged=process.argv.includes('--packaged'),app=await electron.launch({env,executablePath:packaged?path.resolve(process.platform==='win32'?'release/win-unpacked/Clair.exe':'release/mac-arm64/Clair.app/Contents/MacOS/Clair'):require('electron'),args:[...(packaged?[]:[path.resolve('.')]),'--user-data-dir='+profile]});
 try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>!!document.querySelector('#mirror-start').onclick);
  assert.equal((await page.evaluate(()=>window.clair.config())).hasKey,false);
  assert.equal(await page.locator('#more-toggle,#coding-menu-toggle').count(),0);
  assert.equal(await page.locator('.titlebar #settings-tab').count(),1);
  const size=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getSize());
  for(const width of [400,340]){
   await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,640),width);const before=await size();
   await page.locator('#settings-tab').click();assert.equal(await page.locator('#settings-panel').isVisible(),true);
   for(const id of ['key-section','advanced-settings','coding-menu','phone-section','mouse-section','session-settings']){
    const section=page.locator('#'+id);if(!await section.evaluate(el=>el.open))await section.locator(':scope > summary').click();
    assert.equal(await section.evaluate(el=>el.closest('main').id),'settings-panel');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow in '+id+' at '+width);
    await section.locator(':scope > summary').click();
   }
   await page.evaluate(()=>window.scrollTo(0,0));assert.deepEqual(await size(),before);
   if(width===400){await fs.mkdir('release/qa',{recursive:true});await page.screenshot({path:'release/qa/clair-settings.png',omitBackground:true});}
   await page.locator('#settings-tab').click();assert.equal(await page.locator('#session-panel').isVisible(),true);assert.deepEqual(await size(),before);
  }
  await page.locator('#notice').click();assert.equal(await page.locator('#key').isVisible(),true);assert.equal(await page.evaluate(()=>document.activeElement.id),'key');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#settings-panel').isVisible(),false);
  await page.locator('#settings-tab').click();await page.locator('#settings-done').click();assert.equal(await page.locator('#session-panel').isVisible(),true);
  assert.deepEqual(errors,[]);console.log('Settings QA passed: one entry point, all groups reachable, no horizontal overflow at 340/400px, stable window size, active-tab return, Done/Escape and API-key notice. No API calls or personal data.');
 }finally{await app.close();await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
})().catch(error=>{console.error(error);process.exitCode=1;});
