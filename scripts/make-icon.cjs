const {_electron}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
(async()=>{
 const launchEnv={...process.env};delete launchEnv.ELECTRON_RUN_AS_NODE;delete launchEnv.NODE_OPTIONS;
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'clair-icon-'));
 const app=await _electron.launch({env:launchEnv,executablePath:path.resolve('release/mac-arm64/Clair.app/Contents/MacOS/Clair'),args:['--user-data-dir='+profile]});
 try{
  const page=await app.firstWindow();
  const png=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');
   const g=x.createLinearGradient(100,100,900,950);g.addColorStop(0,'#2f4938');g.addColorStop(1,'#111916');
   x.fillStyle=g;x.beginPath();x.roundRect(60,60,904,904,210);x.fill();
   x.strokeStyle='#c6e6a6';x.lineWidth=46;x.lineCap='round';
   for(let i=0;i<3;i++){const y=350+i*145;x.beginPath();x.moveTo(270,y);x.bezierCurveTo(410,y-110,540,y+110,710,y);x.stroke();}
   x.fillStyle='#c6e6a6';x.beginPath();x.arc(760,760,39,0,Math.PI*2);x.fill();
   return c.toDataURL('image/png').split(',')[1];
  });
  await fs.mkdir('build',{recursive:true});await fs.writeFile('build/icon.png',Buffer.from(png,'base64'));
 }finally{await app.close();await fs.rm(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
