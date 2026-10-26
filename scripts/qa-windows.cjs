const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const pdfFixture=require('../test/pdf-fixture.cjs');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'clair-windows-qa-'));
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 const app=await electron.launch({executablePath:path.resolve('release/win-unpacked/Clair.exe'),args:['--user-data-dir='+profile],env,timeout:30000});
 const errors=[];
 try{
  const page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));
  await page.waitForFunction(()=>document.body.dataset.sessionStatus?.includes('Configurez'));
  const config=await page.evaluate(()=>window.clair.config());assert.equal(config.platform,'win32');assert.equal(config.hasKey,false);assert.equal(config.nativeAudio,false);
  assert.equal(await app.evaluate(({app})=>app.isPackaged),true);
  await page.locator('#more-toggle').click();await page.locator('#demo').click();
  await page.waitForFunction(()=>document.querySelector('#latency').textContent.includes('vitesse simulée'));
  assert.match(await page.locator('#answer').textContent(),/Slow database queries/);
  await page.evaluate(()=>window.clair.clear());
  const files=await page.evaluate(async bytes=>window.clair.addFile({name:'Contexte.pdf',data:new Uint8Array(bytes).buffer}),[...pdfFixture('Expérience réelle : ingénieur Python.')]);
  assert.equal(files.length,1);assert.equal(files[0].pages,1);assert.equal(files[0].name,'Contexte.pdf');
  const duplicate=await page.evaluate(async bytes=>window.clair.addFile({name:'Copie.pdf',data:new Uint8Array(bytes).buffer}),[...pdfFixture('Expérience réelle : ingénieur Python.')]);assert.equal(duplicate.length,1);
  await page.locator('#files-tab').click();assert.equal(await page.locator('.file-row').count(),1);await page.locator('#files-tab').click();
  await page.evaluate(()=>{
   window.qaSignals=[];
   const signal=async frequency=>{const ctx=new AudioContext({sampleRate:48000}),oscillator=ctx.createOscillator(),gain=ctx.createGain(),dest=ctx.createMediaStreamDestination();gain.gain.value=.15;oscillator.frequency.value=frequency;oscillator.connect(gain);gain.connect(dest);oscillator.start();await ctx.resume();window.qaSignals.push({ctx,oscillator,stream:dest.stream});return dest.stream;};
   navigator.mediaDevices.getDisplayMedia=()=>signal(440);
   navigator.mediaDevices.getUserMedia=()=>signal(220);
  });
  await page.locator('#settings-tab').click();await page.locator('#audio-test').click();
  await page.waitForFunction(()=>document.body.dataset.sessionStatus?.includes('Ordinateur ✓ · Micro ✓'));
  await page.locator('#listen').click();
  assert.equal(await page.evaluate(()=>window.qaSignals.every(s=>s.stream.getTracks().every(t=>t.readyState==='ended'))),true);
  await page.evaluate(async()=>{for(const s of window.qaSignals){s.oscillator.stop();await s.ctx.close();}});
  assert.equal((await page.evaluate(()=>window.clair.config())).hasKey,false);
  await page.locator('#opacity-toggle').click();assert.equal(await page.locator('#opacity').isVisible(),true);
  await page.locator('#opacity-toggle').click();assert.equal(await page.locator('#opacity').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('Windows packaged QA passed: startup, demo, PDF extraction with accents and deduplication, settings, synthetic two-source AudioWorklet mix, stop and opacity toggle. No real API, microphone or system capture used.');
 }finally{await app.close();await fs.rm(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
