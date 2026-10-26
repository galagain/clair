const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
function build(arch=process.arch){
 if(process.platform!=='darwin')return;
 const target=arch==='x64'?'x86_64':'arm64';
 const dest=path.resolve('build/native',arch);fs.mkdirSync(dest,{recursive:true});
 execFileSync('xcrun',['swiftc','native/SystemAudio.swift','-O','-target',`${target}-apple-macosx15.0`,'-module-cache-path','/private/tmp/clair-swift-cache','-framework','CoreAudio','-framework','Foundation','-Xlinker','-sectcreate','-Xlinker','__TEXT','-Xlinker','__info_plist','-Xlinker','native/Info.plist','-o',path.join(dest,'clair-system-audio')],{stdio:'inherit'});
 execFileSync('xcrun',['swiftc','native/PDFText.swift','-O','-target',`${target}-apple-macosx15.0`,'-module-cache-path','/private/tmp/clair-swift-cache','-framework','PDFKit','-framework','Foundation','-o',path.join(dest,'clair-pdf-text')],{stdio:'inherit'});
 execFileSync('/usr/bin/codesign',['--force','--sign','-',path.join(dest,'clair-pdf-text')],{stdio:'inherit'});
 execFileSync('/usr/bin/codesign',['--force','--sign','-',path.join(dest,'clair-system-audio')],{stdio:'inherit'});
}
if(require.main===module)build(process.argv[2]);
module.exports=async context=>{if(context.electronPlatformName==='darwin')build(context.arch===1?'x64':'arm64');};
