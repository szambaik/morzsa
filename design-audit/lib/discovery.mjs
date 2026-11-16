import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const command=(cmd,args,cwd)=>{const r=spawnSync(cmd,args,{cwd,encoding:'utf8',timeout:10000,maxBuffer:1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});return r.status===0?r.stdout.trim():null;};
export function sourceFingerprint(repoRoot){
 const names=fs.readdirSync(repoRoot).filter(n=>/\.(?:js|css|html|py)$/.test(n)||['package.json','package-lock.json'].includes(n)).sort();
 const files={};for(const n of names){const p=path.join(repoRoot,n);if(fs.statSync(p).isFile())files[n]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}
 return files;
}
export function inspectRepository(repoRoot){
 const revision=command('git',['rev-parse','HEAD'],repoRoot);
 const branch=command('git',['branch','--show-current'],repoRoot);
 const status=command('git',['-c','core.fsmonitor=false','status','--short','--untracked-files=no'],repoRoot);
 const topLevel=fs.readdirSync(repoRoot).filter(n=>!n.startsWith('.')&&!['node_modules','design-audit'].includes(n));
 const packageJSON=JSON.parse(fs.readFileSync(path.join(repoRoot,'package.json'),'utf8'));
 return {repoRoot,revision,branch,trackedWorktreeStatus:status,gitInspectionLimited:revision===null||status===null,topLevel,scripts:packageJSON.scripts,dependencies:{...packageJSON.dependencies,...packageJSON.devDependencies},runtime:{node:process.version,platform:process.platform,arch:process.arch},sourceFingerprint:sourceFingerprint(repoRoot),capturedAt:new Date().toISOString()};
}
export function discoveryMarkdown(context){
 return '# Repository discovery\n\n- Revision: '+(context.revision||'Unavailable (Git read timed out)')+'\n- Branch: '+(context.branch||'Unavailable')+'\n- Node: '+context.runtime.node+'\n- Platform: '+context.runtime.platform+'/'+context.runtime.arch+'\n- Dirty tracked tree: '+(context.trackedWorktreeStatus===null?'Unknown (read timed out)':context.trackedWorktreeStatus?'Yes':'No')+'\n\n## Application structure\n\n'+context.topLevel.map(n=>'- '+n).join('\n')+'\n\n## Scripts\n\n```json\n'+JSON.stringify(context.scripts,null,2)+'\n```\n\n## Safety and test plan\n\nServe the unchanged app locally; use a fresh browser context with synthetic fixture data, route all network traffic through the audit allowlist and block production APIs. Execute journeys A–G where safely feasible, all six requested viewports, keyboard inspection, axe-core, persistence reloads, console and network recording. Detailed screen inventory and environment constraints are in shared-context.md and evidence/results.json. Do not infer functionality from source alone.\n';
}
