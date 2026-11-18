import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createTemplate} from './template.mjs';

const root=fileURLToPath(new URL('.',import.meta.url)),dest=path.join(root,'build');
const run=(command,args)=>{
  const r=spawnSync(command,args,{cwd:root,encoding:'utf8'});
  if (r.error || r.status!==0) throw new Error(command+' failed: '+(r.error?.message||r.stderr));
};
await rm(dest,{recursive:true,force:true});
await mkdir(path.join(dest,'classes'),{recursive:true});
await mkdir(path.join(dest,'java','lib'),{recursive:true});
run('javac',['--release','21','-d',path.join(dest,'classes'),'Probe.java']);
run('jar',['--create','--file',path.join(dest,'java','lib','probe.jar'),'-C',path.join(dest,'classes'),'.']);
run('zip',['-q','-j',path.join(dest,'node-probe.zip'),'index.mjs']);
const zip=spawnSync('zip',['-q','-r',path.join(dest,'java-probe.zip'),'lib'],
  {cwd:path.join(dest,'java'),encoding:'utf8'});
if (zip.error || zip.status!==0) throw new Error('Java zip failed: '+(zip.error?.message||zip.stderr));
// Hash artifacts so a changed build gets fresh published versions.
const hash=createHash('sha256');
for (const file of ['java-probe.zip','node-probe.zip']) hash.update(await readFile(path.join(dest,file)));
const buildId=hash.digest('hex').slice(0,16);
await writeFile(path.join(dest,'template.json'),JSON.stringify(createTemplate(buildId),null,2)+'\n');
console.log('Built isolated runtime probes in '+dest+'; build '+buildId+'. No AWS calls made.');
