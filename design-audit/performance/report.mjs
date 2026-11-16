import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const base=import.meta.dirname,review=JSON.parse(fs.readFileSync(path.join(base,'review-baseline.json'),'utf8'));
const latest={};for(const mode of ['full','supplement','faults','soak']){const d=fs.readdirSync(path.join(base,'runs')).filter(n=>n.endsWith('-'+mode)).sort().at(-1);if(d)latest[mode]='runs/'+d+'/results.json'}
for(const [kind,folder,name]of [['database','database-runs','database.json'],['providers','provider-runs','providers.json']]){const d=fs.readdirSync(path.join(base,folder)).sort().at(-1);latest[kind]=folder+'/'+d+'/'+name}
if(Object.entries(latest).every(([k,v])=>review.inputs[k]===v)){
 const r=spawnSync('python3',[path.join(base,'report.py')],{stdio:'inherit'});if(r.error)throw r.error;process.exitCode=r.status??1;
}else{
 const dir=path.join(base,'reports',new Date().toISOString().replaceAll(':','-')+'-unreviewed');fs.mkdirSync(dir,{recursive:true});let report='# Új mérések — gyökérok-felülvizsgálat szükséges\n\nAz alábbi új futások nem öröklik automatikusan a korábbi audit igazolt megállapításait. A régi jelentés az eredeti bizonyítékokra marad érvényes.\n\n';const stages=[];
 for(const [kind,ref]of Object.entries(latest)){const p=path.join(base,ref);if(!fs.existsSync(p)){stages.push({kind,ref,status:'missing'});report+='- '+kind+': hiányzó eredmény\n';continue}const r=JSON.parse(fs.readFileSync(p,'utf8'));const failed=(r.checks||[]).filter(c=>c.status==='failed');stages.push({kind,ref,fatal:r.fatal||null,failed,sourceChanged:r.sourceChangedDuringRun||[],finishedAt:r.finishedAt});report+='## '+kind+'\n\n[Eredmény](../../'+ref+'). Hibás ellenőrzések: '+failed.length+'. '+(r.fatal?'FATAL: '+r.fatal.message:'')+'\n\n';if(failed.length)report+=failed.map(c=>'- '+c.id+': '+JSON.stringify(c.details)).join('\n')+'\n\n'}
 fs.writeFileSync(path.join(dir,'MEASUREMENT-REPORT.md'),report);fs.writeFileSync(path.join(dir,'stages.json'),JSON.stringify({status:'unreviewed',stages,reviewedBaseline:review},null,2));console.log('Unreviewed measurement report: '+dir);
}
