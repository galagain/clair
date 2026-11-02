const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'clair-mirror-qa-')),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 const packaged=process.argv.includes('--packaged'),app=await electron.launch({env,executablePath:packaged?path.resolve('release/mac-arm64/Clair.app/Contents/MacOS/Clair'):require('electron'),args:[...(packaged?[]:[path.resolve('.')]),'--user-data-dir='+profile]});
 try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>!!document.querySelector('#mirror-toggle').onclick);
  await app.evaluate(({app})=>{
   const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json'),{EventEmitter}=require('node:events'),{Mirror}=require('./src/mirror.cjs'),state=Mirror.prototype.state;
   Mirror.prototype.state=function(){this.available=true;this.displays=()=>[{id:101,label:'Mac test',size:{width:1440,height:900}},{id:202,label:'Externe test',size:{width:1920,height:1080}}];this.spawn=(_file,args)=>{
    global.mirrorQaLaunches=(global.mirrorQaLaunches||0)+1;global.mirrorQaArgs=args;
    const child=new EventEmitter();Object.assign(child,{stdout:new EventEmitter(),stderr:new EventEmitter(),stdin:Object.assign(new EventEmitter(),{end(){}}),kill(){child.killed=true;}});global.mirrorQaChild=child;
    setTimeout(()=>{child.stdout.emit('data',Buffer.from(JSON.stringify(global.mirrorQaPermission?{type:'error',message:'Autorisez Clair Recopie dans Enregistrement de l’écran.'}:{type:'ready',source:101,target:202,width:args.at(-1)==='native'?5120:1920,height:args.at(-1)==='native'?2880:1080,fps:args.at(-1)==='native'?60:30})+'\n'));},20);return child;
   };return state.call(this);};
  });
  await page.evaluate(()=>window.clair.mirrorState());assert.equal(await app.evaluate(()=>global.mirrorQaLaunches||0),0);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(340,520));await page.waitForFunction(()=>innerWidth===340);
  const bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
  await page.locator('#mirror-toggle').click();assert.equal(await page.locator('#mirror-menu').isVisible(),true);assert.equal(await page.locator('#mirror-source').inputValue(),'101');assert.equal(await page.locator('#mirror-target').inputValue(),'202');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds()),bounds);
  assert.equal(await page.locator('#mirror-quality').inputValue(),'native');
  await page.locator('#mirror-quality').selectOption('economy');await page.locator('#mirror-close').click();await page.reload();await page.waitForFunction(()=>!!document.querySelector('#mirror-toggle').onclick);await page.locator('#mirror-toggle').click();assert.equal(await page.locator('#mirror-quality').inputValue(),'economy');
  await assert.rejects(page.evaluate(()=>window.clair.mirrorStart(101,101)),/distincts/);
  await fs.mkdir('release/qa',{recursive:true});await page.screenshot({path:'release/qa/clair-mirror-menu.png',omitBackground:true});
  await page.locator('#mirror-start').click();await page.waitForFunction(()=>document.querySelector('#mirror-toggle').getAttribute('aria-pressed')==='true'&&document.querySelector('#mirror-menu').hidden);
  assert.equal((await page.evaluate(()=>window.clair.mirrorState())).status,'active');assert.deepEqual((await page.evaluate(()=>window.clair.mirrorState())).output,{width:1920,height:1080,fps:30});assert.deepEqual((await app.evaluate(()=>global.mirrorQaArgs)).slice(0,4),['--source','101','--target','202']);
  assert.deepEqual((await app.evaluate(()=>global.mirrorQaArgs)).slice(-2),['--quality','economy']);
  await page.evaluate(()=>window.clair.background());assert.equal((await page.evaluate(()=>window.clair.mirrorState())).status,'active');await page.evaluate(()=>window.clair.background());
  await page.locator('#mirror-toggle').click();assert.equal((await page.evaluate(()=>window.clair.mirrorState())).status,'off');assert.equal(await app.evaluate(()=>global.mirrorQaChild.killed),true);
  await page.locator('#mirror-toggle').click();await page.locator('#mirror-quality').selectOption('native');await app.evaluate(()=>{global.mirrorQaPermission=true;});await page.locator('#mirror-start').click();await page.waitForFunction(()=>document.querySelector('#mirror-status').textContent.includes('Autorisez'));assert.equal((await page.evaluate(()=>window.clair.mirrorState())).status,'off');
  await app.evaluate(()=>{global.mirrorQaPermission=false;});await page.locator('#mirror-start').click();await page.waitForFunction(()=>document.querySelector('#mirror-menu').hidden);
  await app.evaluate(({screen})=>screen.emit('display-removed'));await page.waitForFunction(()=>document.querySelector('#mirror-toggle').getAttribute('aria-pressed')==='false');assert.match(await page.locator('#mirror-status').textContent(),/écrans/);assert.deepEqual((await app.evaluate(()=>global.mirrorQaArgs)).slice(-2),['--quality','native']);
  await page.locator('#mirror-start').click();await page.waitForFunction(()=>document.querySelector('#mirror-menu').hidden);await app.evaluate(({powerMonitor})=>powerMonitor.emit('lock-screen'));assert.equal((await page.evaluate(()=>window.clair.mirrorState())).status,'off');
  assert.deepEqual(errors,[]);console.log('Mirror UI QA passed with a simulated native helper: explicit activation, display selection, native/economical modes, quality persistence after reload, output dimensions, stable bounds, stop button, permission error, background continuity, display removal and screen lock. No screen capture or OS permission requested.');
 }finally{await app.close();await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
})().catch(error=>{console.error(error);process.exitCode=1;});
