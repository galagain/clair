const {app,BrowserWindow,ipcMain,session,desktopCapturer,safeStorage,globalShortcut,dialog,screen,Menu,powerMonitor,systemPreferences,shell,clipboard}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const WebSocket=require('ws');
const {WindowOverlay}=require('./window-overlay.cjs');
const {NativeSystemAudio}=require('./native-audio.cjs');
const {DocumentContext,extractPDF}=require('./documents.cjs');
const {extractPortablePDF}=require('./pdf-portable.cjs');
const {CodingBridge}=require('./coding-bridge.cjs');
const {Mirror}=require('./mirror.cjs');
const {MouseShortcuts,mouseConfiguration}=require('./mouse-shortcuts.cjs');
const {registerBackgroundWindow}=require('./background-window.cjs');
const {registerViewShortcuts}=require('./view-shortcuts.cjs');
const {PhoneServer}=require('./phone-server.cjs');
const QRCode=require('qrcode');
const phone=new PhoneServer({onStatus:value=>send({type:'phone-status',...value})});
const documents=new DocumentContext({extract:(bytes,options)=>process.platform!=='darwin'?extractPortablePDF(bytes,options):extractPDF(app.isPackaged?path.join(process.resourcesPath,'native','clair-pdf-text'):path.join(__dirname,'../build/native',process.arch,'clair-pdf-text'),bytes,options),onChange:files=>{engine?.setDocuments(files);send({type:'files-changed',files:documents.list()});}});
const nativeAudio=new NativeSystemAudio({executable:app.isPackaged?path.join(process.resourcesPath,'native','clair-system-audio'):path.join(__dirname,'../build/native',process.arch,'clair-system-audio'),emit:send});
let win,background,mouse,mirror,overlay,engine,coding,codingSpeech,codingNotes,codingContext,bridge,modeShortcuts,config,key='',storedKeys=false,captureAllowed=false,mod;
// Explicit isolated profile for native QA; never read the user's keys in tests.
if(app.commandLine.hasSwitch('user-data-dir'))app.setPath('userData',path.resolve(app.commandLine.getSwitchValue('user-data-dir')));
const indexURL=pathToFileURL(path.join(__dirname,'index.html')).href;
const storageFile=()=>path.join(app.getPath('userData'),'preferences.json');
const keyFile=()=>path.join(app.getPath('userData'),'credentials.encrypted.json');
function trusted(e){return Boolean(win&&!win.isDestroyed()&&e.sender===win.webContents&&e.senderFrame?.url===indexURL);}
function send(e){codingContext?.event(e);codingSpeech?.event(e);if(win&&!win.isDestroyed())win.webContents.send('clair:event',e);}
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
 const {CodingContext}=await import('./coding-context.mjs');codingContext=new CodingContext();
 engine=new InterviewEngine({WebSocketImpl:WebSocket,emit:e=>{if(e.type==='stopped'&&!e.reset){captureAllowed=false;nativeAudio.stop();}send(e);}});engine.configure(config);engine.credentials({key});
 const {CodingEngine}=await import('./coding-engine.mjs');coding=new CodingEngine({emit:e=>{if(e.type==='coding-start')engine.setCodingContext(e.snapshot);if(e.type==='coding-cleared')engine.setCodingContext(null);if(['coding-done','coding-updated'].includes(e.type))engine.updateCodingSolution(coding.history.at(-1)?.text||'');send(e);if(['coding-start','coding-cleared'].includes(e.type))codingNotes?.cancel();if(e.type==='coding-done'||e.type==='coding-updated'||e.type==='coding-unchanged'&&e.manual)void codingNotes?.start(coding.snapshot,coding.history.at(-1),codingOptions());}});
 const codingOptions=()=>({config,key,usage:()=>engine.tokens.begin(),request:()=>engine.request(),headers:(headers,model)=>engine.tokens.headers(headers,model)});
 const {CodingNotes}=await import('./coding-notes.mjs');codingNotes=new CodingNotes({emit:send,fetchImpl:(...args)=>coding.fetch(...args)});
 const analyzeCoding=(snapshot,action='next')=>coding.analyze(snapshot,{action,...codingOptions()});
 const {CodingSpeech}=await import('./coding-speech.mjs');codingSpeech=new CodingSpeech({enabled:()=>config.codingAutoVoice&&engine.running,state:()=>coding.state(),adapt:text=>coding.adapt(text,codingOptions()),cancel:()=>{if(coding.active?.item.action==='adapt')coding.cancel();},report:error=>send({type:'coding-adapt-error',error:mod.safeError(error)})});
 bridge=new CodingBridge({receive:snapshot=>{if(config.codingCaptureMode==='visual'&&!snapshot?.images?.length)throw Error('Capture image manquante. Actualisez l’extension Firefox puis renvoyez la page.');return analyzeCoding(snapshot);},settings:()=>({captureMode:config.codingCaptureMode})});
 const area=screen.getPrimaryDisplay().workArea;win=new BrowserWindow({title:'Clair — Assistant d’entretien',width:400,height:300,minWidth:340,minHeight:180,x:Math.max(area.x,area.x+area.width-420),y:area.y+30,frame:false,acceptFirstMouse:true,transparent:true,hasShadow:false,backgroundColor:'#00000000',show:false,alwaysOnTop:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false}});overlay=new WindowOverlay(win,screen);Menu.setApplicationMenu(process.platform==='darwin'?Menu.buildFromTemplate([{role:'appMenu'},{role:'editMenu'},{role:'windowMenu'}]):null);syncWindow();if(process.platform==='darwin')win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(url!==indexURL)e.preventDefault()});win.webContents.on('render-process-gone',()=>{overlay.reset();mirror?.stop();engine.stop();coding.cancel();codingNotes?.cancel();mouse?.stop();void phone.close();});win.webContents.on('did-start-loading',()=>{overlay.reset();mirror?.stop();captureAllowed=false;engine.stop();coding.cancel();codingNotes?.cancel();mouse?.stop();void phone.close();});
 session.defaultSession.setPermissionRequestHandler((wc,permission,callback)=>callback(wc===win.webContents&&captureAllowed&&['media','display-capture'].includes(permission)));
 session.defaultSession.setPermissionCheckHandler((wc,permission)=>wc===win.webContents&&captureAllowed&&['media','display-capture'].includes(permission));
 session.defaultSession.setDisplayMediaRequestHandler(async(request,callback)=>{if(process.platform==='darwin'){callback({});return;}if(!captureAllowed||request.frame?.url!==indexURL){callback({});return;}try{const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:0,height:0}});if(!sources.length||!captureAllowed){callback({});return;}callback({video:sources[0],audio:'loopback'});}catch{callback({});}},{useSystemPicker:false});
 mirror=new Mirror({executable:app.isPackaged?path.join(process.resourcesPath,'native','clair-mirror'):path.join(__dirname,'../build/native',process.arch,'clair-mirror'),displays:()=>screen.getAllDisplays(),emit:send});
 guard('mirror:state',()=>mirror.state());guard('mirror:start',(source,target,quality)=>mirror.start(source,target,quality));guard('mirror:stop',()=>mirror.stop());
 for(const event of ['display-added','display-removed','display-metrics-changed'])screen.on(event,()=>mirror.changed());
 powerMonitor.on('lock-screen',()=>mirror.stop());
 mouse=new MouseShortcuts({executable:app.isPackaged?path.join(process.resourcesPath,'native','clair-mouse'):path.join(__dirname,'../build/native',process.arch,'clair-mouse'),emit:send,action:()=>background.toggle(),save:value=>atomic(path.join(app.getPath('userData'),'mouse.json'),value)});
 try{mouse.config=mouseConfiguration(JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'mouse.json'),'utf8')));}catch{}
 guard('mouse:state',()=>mouse.state());guard('mouse:enable',enabled=>mouse.enable(enabled,true));guard('mouse:learn',action=>mouse.learn(action));guard('mouse:forget',(action,index)=>mouse.forget(action,index));guard('mouse:permissions',()=>shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'));
 guard('config:get',()=>({...config,hasKey:Boolean(key),storedKeys,platform:process.platform,nativeAudio:process.platform==='darwin',version:app.getVersion(),backgroundShortcutRegistered:background?.registered===true,modeShortcuts:modeShortcuts||{}}));
 guard('config:save',async c=>{if(engine.running)throw Error('Arrêtez l’écoute avant de modifier les réglages.');config=mod.normalizeConfig(c);engine.configure(config);syncWindow();await atomic(storageFile(),config);return config;});
 guard('preferences:save',async value=>{const notesLanguage=config.answerLanguage,next={...config};for(const field of ['codingCaptureMode','codingAutoVoice','translationEnabled','translationLanguage','answerLanguage','transcriptionLanguage'])if(Object.hasOwn(value||{},field))next[field]=value[field];const saved=mod.normalizeConfig(next);config=saved;await atomic(storageFile(),config);send({type:'preferences-changed',config});engine.preferences(config);if(!config.codingAutoVoice)codingSpeech.reset();if(notesLanguage!==config.answerLanguage)void codingNotes.start(coding.snapshot,coding.history.at(-1),codingOptions());return config;});
 guard('keys:save',async value=>{
  if(engine.running)throw Error('Arrêtez l’écoute.');const next=String(value?.key||'').trim();
  if(!next.startsWith('sk-')||next.length<20||next.length>512)throw Error('Clé invalide.');
  if(!await canEncrypt())throw Error('Chiffrement indisponible. Clé non enregistrée.');
  await atomic(keyFile(),{key:(await encrypt(next)).toString('base64')});coding.cancel();codingNotes?.cancel();key=next;storedKeys=true;engine.credentials({key});return {hasKey:true,storedKeys};
 });
 guard('keys:forget',async()=>{engine.stop();coding.cancel();codingNotes?.cancel();key='';storedKeys=false;engine.credentials({key});await fs.rm(keyFile(),{force:true});});
 guard('api:test',candidate=>engine.testConnection(String(candidate||'').trim()||key));
 const phoneInfo=async value=>{const qr=value.active?await QRCode.toDataURL(value.url,{width:240,margin:2}):'';return phone.state().url===value.url?{...value,qr}:{...phone.state(),qr:''};};
 guard('phone:state',()=>phoneInfo(phone.state()));
 guard('phone:start',async address=>phoneInfo(await phone.start(address)));
 guard('phone:stop',()=>phone.close());
 ipcMain.on('phone:publish',(e,value)=>{if(trusted(e))phone.publish(value);});
 guard('coding:state',()=>coding.state());
 guard('coding:review',()=>{codingSpeech.reset();return coding.review(codingContext.text(),codingOptions());});
 guard('coding:analyze',(snapshot,action)=>analyzeCoding(snapshot,action));
 guard('coding:cancel',()=>{codingSpeech.reset();coding.cancel();});
 guard('coding:undo',()=>{codingSpeech.reset();return coding.undo();});
 guard('coding:clear',()=>coding.clear());
 guard('coding:pair',async()=>{clipboard.writeText(await bridge.start());return true;});
 guard('coding:disconnect',()=>bridge.close());
 guard('coding:extension',async()=>{const location=app.isPackaged?path.join(process.resourcesPath,'firefox-extension'):path.join(__dirname,'../extensions/firefox');const error=await shell.openPath(location);if(error)throw Error('Impossible d’ouvrir le dossier de l’extension.');});
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
 guard('session:clear',()=>{documents.clear();coding.clear();engine.clear();});
 guard('session:ask',text=>{engine.manual(String(text||'').slice(0,8000));});
 guard('session:export',async()=>{const {filePath,canceled}=await dialog.showSaveDialog(win,{title:'Exporter la session',defaultPath:'Clair-session.txt',filters:[{name:'Texte',extensions:['txt']}]});if(canceled||!filePath)return false;await fs.writeFile(filePath,engine.exportText()+coding.exportText(),'utf8');return true;});
 guard('window:pin',async()=>{config.alwaysOnTop=!config.alwaysOnTop;syncWindow();await atomic(storageFile(),config);return config.alwaysOnTop;});
 guard('window:opacity',async(value,save=false)=>{if(!Number.isFinite(value))throw Error('Opacité invalide.');config.opacity=Math.max(.35,Math.min(1,value));win.setOpacity(config.opacity);if(save===true)await atomic(storageFile(),config);return config.opacity;});
 guard('window:compact',compact=>{overlay.preset(compact);return true;});
 ipcMain.on('window:preserve-size',e=>{if(trusted(e))overlay.manualSize=true;});
 ipcMain.on('window:layout',(e,value)=>{if(trusted(e))overlay.update(value);});
 ipcMain.on('window:mouse-refresh',e=>{if(trusted(e))overlay.refresh();});
 ipcMain.on('window:mouse-hold',(e,value)=>{if(trusted(e))overlay.hold(value);});
 guard('clipboard:write',text=>{clipboard.writeText(String(text||'').slice(0,32000));});
 guard('window:background',()=>background.toggle());guard('window:minimize',()=>win.minimize());guard('window:close',()=>win.close());
 ipcMain.on('audio:chunk',(e,data,levels)=>{if(trusted(e)&&data instanceof ArrayBuffer&&data.byteLength<=48000){const valid=levels&&[levels.systemRms,levels.micRms].every(v=>Number.isFinite(v)&&v>=0&&v<=2);engine.audio(new Uint8Array(data),valid?levels:undefined);}});
 modeShortcuts=registerViewShortcuts(globalShortcut,send);background=registerBackgroundWindow(win,globalShortcut);win.webContents.on('did-finish-load',()=>{if(mouse.config.enabled&&mouse.available&&!mouse.child)mouse.launch(false);});
 globalShortcut.register('CommandOrControl+Shift+Space',()=>send({type:'shortcut-toggle'}));globalShortcut.register('CommandOrControl+Shift+Enter',()=>engine.manual(''));
 win.on('close',()=>{mirror?.stop();engine.stop();coding.cancel();codingNotes?.cancel();mouse?.stop();void phone.close();});powerMonitor.on('suspend',()=>{mirror?.stop();engine.stop();coding.cancel();codingNotes?.cancel();mouse?.stop();void phone.close();send({type:'status',text:'Écoute arrêtée à la mise en veille.'})});
 win.once('ready-to-show',()=>win.show());await win.loadFile(path.join(__dirname,'index.html'));
}
if(!app.requestSingleInstanceLock())app.quit();else{app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus()}});app.whenReady().then(setup).catch(()=>{dialog.showErrorBox('Clair','Impossible de démarrer Clair. Vérifiez les fichiers de l’application et les permissions locales.');app.quit()});}
app.on('activate',()=>{if(win&&!win.isDestroyed()){if(win.isMinimized())win.restore();win.show();}});
app.on('window-all-closed',()=>app.quit());app.on('will-quit',()=>{mirror?.stop();documents.clear();nativeAudio.shutdown();engine?.stop();coding?.cancel();codingNotes?.cancel();void bridge?.close();void phone.close();mouse?.stop();globalShortcut.unregisterAll()});
