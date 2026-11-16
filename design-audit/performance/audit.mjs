// Each stage writes a new timestamped run. No application source, database or deployment is modified.
import {spawn} from 'node:child_process';import fs from 'node:fs';import path from 'node:path';
const here=import.meta.dirname,stamp=new Date().toISOString().replaceAll(':','-'),dir=path.join(here,'suites',stamp);fs.mkdirSync(dir,{recursive:true});const stages=[];
for(const args of [['runner.mjs','full'],['runner.mjs','supplement'],['runner.mjs','faults'],['runner.mjs','soak'],['database.mjs'],['providers.mjs'],['report.mjs']]){
 const start=new Date().toISOString(),out=fs.createWriteStream(path.join(dir,args.join('-')+'.log'));const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:here,stdio:['ignore','pipe','pipe'],env:process.env});for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{out.write(b);process.stdout.write(b)});child.on('error',reject);child.on('exit',resolve)});out.end();stages.push({args,start,finished:new Date().toISOString(),exitCode:code});fs.writeFileSync(path.join(dir,'stages.json'),JSON.stringify(stages,null,2));if(code)console.error('Stage failed; remaining independent stages still run: '+args.join(' '));
}
process.exitCode=stages.some(s=>s.exitCode)?1:0;
