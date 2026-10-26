const {app,BrowserWindow,ipcMain,session,desktopCapturer,safeStorage,globalShortcut,dialog,screen,Menu,powerMonitor,systemPreferences,shell,clipboard}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const WebSocket=require('ws');
const {WindowOverlay}=require('./window-overlay.cjs');
const {NativeSystemAudio}=require('./native-audio.cjs');
const {DocumentContext,extractPDF}=require('./documents.cjs');
const {extractPortablePDF}=require('./pdf-portable.cjs');
const documents=new DocumentContext({extract:(bytes,options)=>process.platform!=='darwin'?extractPortablePDF(bytes,options):extractPDF(app.isPackaged?path.join(process.resourcesPath,'native','clair-pdf-text'):path.join(__dirname,'../build/native',process.arch,'clair-pdf-text'),bytes,options),onChange:files=>{engine?.setDocuments(files);send({type:'files-changed',files:documents.list()});}});
const nativeAudio=new NativeSystemAudio({executable:app.isPackaged?path.join(process.resourcesPath,'native','clair-system-audio'):path.join(__dirname,'../build/native',process.arch,'clair-system-audio'),emit:send});
let win,overlay,engine,config,key='',storedKeys=false,captureAllowed=false,mod;
// Explicit isolated profile for native QA; never read the user's keys in tests.
if(app.commandLine.hasSwitch('user-data-dir'))app.setPath('userData',path.resolve(app.commandLine.getSwitchValue('user-data-dir')));
const indexURL=pathToFileURL(path.join(__dirname,'index.html')).href;
const storageFile=()=>path.join(app.getPath('userData'),'preferences.json');
const keyFile=()=>path.join(app.getPath('userData'),'credentials.encrypted.json');
function trusted(e){return Boolean(win&&!win.isDestroyed()&&e.sender===win.webContents&&e.senderFrame?.url===indexURL);}
function send(e){if(win&&!win.isDestroyed())win.webContents.send('clair:event',e);}
const writes=new Map();
function atomic(file,data){const encoded=JSON.stringify(data);const job=(writes.get(file)||Promise.resolve()).catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp';await fs.writeFile(tmp,encoded,{mode:0o600});await fs.rename(tmp,file);});writes.set(file,job);return job;}
async function canEncrypt(){if(process.platform==='linux'&&safeStorage.getSelectedStorageBackend?.()==='basic_text')return false;return safeStorage.isAsyncEncryptionAvailable?await safeStorage.isAsyncEncryptionAvailable():safeStorage.isEncryptionAvailable();}
async function encrypt(s){return safeStorage.encryptStringAsync?await safeStorage.encryptStringAsync(s):safeStorage.encryptString(s);}
async function decrypt(b){if(safeStorage.decryptStringAsync){const value=await safeStorage.decryptStringAsync(b);return value.result;}return safeStorage.decryptString(b);}
function guard(name,fn){ipcMain.handle(name,async(e,...args)=>{if(!trusted(e))throw Error('Accès non autorisé.');try{return {ok:true,value:await fn(...args)}}catch(err){return {ok:false,error:mod.safeError(err)}}});}
function syncWindow(){win.setAlwaysOnTop(config.alwaysOnTop,'floating');win.setOpacity(config.opacity);}
async function setup(){
 mod=await import('./core.mjs');const {InterviewEngine}=await import('./engine.mjs');config=mod.normalizeConfig();try{config=mod.normalizeConfig(JSON.parse(await fs.readFile(storageFile(),'utf8')))}catch{}
 await atomic(storageFile(),config);
 try{const saved=JSON.parse(await fs.readFile(keyFile(),'utf8'));if(await canEncrypt()){key=await decrypt(Buffer.from(saved.key,'base64'));storedKeys=true;if(saved.audioKey)await atomic(keyFile(),{key:saved.key});}}catch{/* A keychain failure never downgrades to plaintext. */}
 engine=new InterviewEngine({WebSocketImpl:WebSocket,emit:e=>{if(e.type==='stopped'&&!e.reset){captureAllowed=false;nativeAudio.stop();}send(e);}});engine.configure(config);engine.credentials({key});
 const area=screen.getPrimaryDisplay().workArea;win=new BrowserWindow({title:'Clair — Assistant d’entretien',width:400,height:300,minWidth:340,minHeight:180,x:Math.max(area.x,area.x+area.width-420),y:area.y+30,frame:false,acceptFirstMouse:true,transparent:true,hasShadow:false,backgroundColor:'#00000000',show:false,alwaysOnTop:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false}});overlay=new WindowOverlay(win,screen);Menu.setApplicationMenu(process.platform==='darwin'?Menu.buildFromTemplate([{role:'appMenu'},{role:'editMenu'},{role:'windowMenu'}]):null);syncWindow();if(process.platform==='darwin')win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(url!==indexURL)e.preventDefault()});win.webContents.on('render-process-gone',()=>{overlay.reset();engine.stop();});win.webContents.on('did-start-loading',()=>{overlay.reset();captureAllowed=false;engine.stop();});
 session.defaultSession.setPermissionRequestHandler((wc,permission,callback)=>callback(wc===win.webContents&&captureAllowed&&['media','display-capture'].includes(permission)));
 session.defaultSession.setPermissionCheckHandler((wc,permission)=>wc===win.webContents&&captureAllowed&&['media','display-capture'].includes(permission));
 session.defaultSession.setDisplayMediaRequestHandler(async(request,callback)=>{if(process.platform==='darwin'){callback({});return;}if(!captureAllowed||request.frame?.url!==indexURL){callback({});return;}try{const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:0,height:0}});if(!sources.length||!captureAllowed){callback({});return;}callback({video:sources[0],audio:'loopback'});}catch{callback({});}},{useSystemPicker:false});
 guard('config:get',()=>({...config,hasKey:Boolean(key),storedKeys,platform:process.platform,nativeAudio:process.platform==='darwin',version:app.getVersion()}));
 guard('config:save',async c=>{if(engine.running)throw Error('Arrêtez l’écoute avant de modifier les réglages.');config=mod.normalizeConfig(c);engine.configure(config);syncWindow();await atomic(storageFile(),config);return config;});
 guard('preferences:save',async value=>{const next={...config};for(const field of ['translationEnabled','translationLanguage','answerLanguage','transcriptionLanguage'])if(Object.hasOwn(value||{},field))next[field]=value[field];const saved=mod.normalizeConfig(next);config=saved;await atomic(storageFile(),config);send({type:'preferences-changed',config});engine.preferences(config);return config;});
 guard('keys:save',async value=>{
  if(engine.running)throw Error('Arrêtez l’écoute.');const next=String(value?.key||'').trim();
  if(!next.startsWith('sk-')||next.length<20||next.length>512)throw Error('Clé invalide.');
  if(!await canEncrypt())throw Error('Chiffrement indisponible. Clé non enregistrée.');
  await atomic(keyFile(),{key:(await encrypt(next)).toString('base64')});key=next;storedKeys=true;engine.credentials({key});return {hasKey:true,storedKeys};
 });
 guard('keys:forget',async()=>{engine.stop();key='';storedKeys=false;engine.credentials({key});await fs.rm(keyFile(),{force:true});});
 guard('api:test',candidate=>engine.testConnection(String(candidate||'').trim()||key));
 guard('files:list',()=>documents.list());
 guard('files:add',file=>documents.add(file));
 guard('files:remove',id=>documents.remove(id));
 guard('files:clear',()=>documents.clear());
 guard('files:pick',async()=>{
  const revision=documents.revision;
  const result=await dialog.showOpenDialog(win,{title:'Ajouter des PDF',properties:['openFile','multiSelections'],filters:[{name:'PDF',extensions:['pdf']}]});
  if(result.canceled||revision!==documents.revision)return {files:documents.list(),errors:[]};const errors=result.filePaths.length>5?['5 PDF maximum.']:[];
  for(const file of result.filePaths.slice(0,5)){if(revision!==documents.revision)break;try{const stat=await fs.stat(file);if(stat.size>10*1024*1024)throw Error('PDF limité à 10 Mo.');const data=await fs.readFile(file);if(revision!==documents.revision)break;await documents.add({name:path.basename(file),data});}catch(e){errors.push(path.basename(file)+': '+e.message);}}
  return {files:documents.list(),errors};
 });
 guard('capture:arm',()=>{captureAllowed=true;return true;});
 guard('system:start',id=>{if(!captureAllowed||process.platform!=='darwin'||typeof id!=='string'||id.length>80)throw Error('Capture audio non autorisée.');return nativeAudio.start(id);});
 guard('system:stop',id=>nativeAudio.stop(id));
 guard('permissions:open',()=>{if(process.platform==='darwin')return shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');});
 guard('session:start',async()=>{const r=await engine.start();captureAllowed=true;return r;});
 guard('session:stop',()=>{captureAllowed=false;engine.stop();});
 guard('session:clear',()=>{documents.clear();engine.clear();});
 guard('session:ask',text=>{engine.manual(String(text||'').slice(0,8000));});
 guard('session:export',async()=>{const {filePath,canceled}=await dialog.showSaveDialog(win,{title:'Exporter la session',defaultPath:'Clair-session.txt',filters:[{name:'Texte',extensions:['txt']}]});if(canceled||!filePath)return false;await fs.writeFile(filePath,engine.exportText(),'utf8');return true;});
 guard('window:pin',async()=>{config.alwaysOnTop=!config.alwaysOnTop;syncWindow();await atomic(storageFile(),config);return config.alwaysOnTop;});
 guard('window:opacity',async(value,save=false)=>{if(!Number.isFinite(value))throw Error('Opacité invalide.');config.opacity=Math.max(.35,Math.min(1,value));win.setOpacity(config.opacity);if(save===true)await atomic(storageFile(),config);return config.opacity;});
 guard('window:compact',compact=>{overlay.preset(compact);return true;});
 ipcMain.on('window:layout',(e,value)=>{if(trusted(e))overlay.update(value);});
 ipcMain.on('window:mouse-refresh',e=>{if(trusted(e))overlay.refresh();});
 ipcMain.on('window:mouse-hold',(e,value)=>{if(trusted(e))overlay.hold(value);});
 guard('clipboard:write',text=>{clipboard.writeText(String(text||'').slice(0,32000));});
 guard('window:minimize',()=>win.minimize());guard('window:close',()=>win.close());
 ipcMain.on('audio:chunk',(e,data,levels)=>{if(trusted(e)&&data instanceof ArrayBuffer&&data.byteLength<=48000){const valid=levels&&[levels.systemRms,levels.micRms].every(v=>Number.isFinite(v)&&v>=0&&v<=2);engine.audio(new Uint8Array(data),valid?levels:undefined);}});
 globalShortcut.register('CommandOrControl+Shift+Space',()=>send({type:'shortcut-toggle'}));globalShortcut.register('CommandOrControl+Shift+Enter',()=>engine.manual(''));
 win.on('close',()=>engine.stop());powerMonitor.on('suspend',()=>{engine.stop();send({type:'status',text:'Écoute arrêtée à la mise en veille.'})});
 win.once('ready-to-show',()=>win.show());await win.loadFile(path.join(__dirname,'index.html'));
}
if(!app.requestSingleInstanceLock())app.quit();else{app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});app.whenReady().then(setup).catch(()=>{dialog.showErrorBox('Clair','Impossible de démarrer Clair. Vérifiez les fichiers de l’application et les permissions locales.');app.quit()});}
app.on('window-all-closed',()=>app.quit());app.on('will-quit',()=>{documents.clear();nativeAudio.shutdown();engine?.stop();globalShortcut.unregisterAll()});
