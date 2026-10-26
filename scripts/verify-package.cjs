const asar=require('@electron/asar');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const archive=process.argv[2]||(process.platform==='win32'?'release/win-unpacked/resources/app.asar':'release/mac-arm64/Clair.app/Contents/Resources/app.asar');
for(const name of fs.readdirSync('src'))assert.deepEqual(asar.extractFile(archive,'src/'+name),fs.readFileSync('src/'+name),name);
const source=JSON.parse(fs.readFileSync('package.json'));
// electron-builder deliberately removes development metadata from the bundle.
delete source.build;delete source.scripts;delete source.devDependencies;
assert.deepEqual(JSON.parse(asar.extractFile(archive,'package.json')),source);
console.log('All packaged src files and runtime package metadata match the delivered sources.');

if(archive.includes('Clair.app')){
 const path=require('node:path');
 for(const name of ['clair-system-audio','clair-pdf-text']){
  assert.deepEqual(fs.readFileSync(path.join(path.dirname(archive),'native',name)),fs.readFileSync('build/native/'+process.arch+'/'+name));
 }
 console.log('Packaged native audio and PDF helpers match the compiled binaries.');
}
