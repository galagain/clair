import {readdir} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
for(const dir of ['src','scripts','test'])for(const f of await readdir(dir)){if(!/\.(cjs|mjs|js)$/.test(f))continue;const r=spawnSync(process.execPath,['--check',dir+'/'+f],{encoding:'utf8'});if(r.status!==0){process.stderr.write(r.stderr);process.exit(r.status||1)}}console.log('Syntax checks passed.');
