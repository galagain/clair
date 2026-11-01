const fs=require('node:fs/promises');
const path=require('node:path');
const {crc32}=require('node:zlib');
// Small, dependency-free ZIP (stored entries). All extension files are text/SVG.
(async()=>{
 const root=path.resolve(__dirname,'../extensions/firefox');
 const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
 if(manifest.version!==require('../package.json').version)throw Error('Version Firefox différente de celle de Clair.');
 const parts=[],central=[];let offset=0;
 for(const name of (await fs.readdir(root)).sort()){
  if(!/\.(json|html|css|mjs|svg)$/.test(name))continue;
  const data=await fs.readFile(path.join(root,name)),filename=Buffer.from(name),checksum=crc32(data);
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x0800,6);header.writeUInt16LE(33,12);header.writeUInt32LE(checksum,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);
  parts.push(header,filename,data);
  const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x0800,8);record.writeUInt16LE(33,14);record.writeUInt32LE(checksum,16);record.writeUInt32LE(data.length,20);record.writeUInt32LE(data.length,24);record.writeUInt16LE(filename.length,28);record.writeUInt32LE(offset,42);
  central.push(record,filename);offset+=header.length+filename.length+data.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 const target=path.resolve(__dirname,'../release/Clair-Firefox.zip');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,Buffer.concat([...parts,directory,end]));console.log('Extension Firefox : '+target);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
