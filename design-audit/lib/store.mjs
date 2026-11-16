import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function writeJSON(file,value,{exclusive=false}={}) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:exclusive?'wx':'w'});
}
export function readJSON(file,fallback=null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file,'utf8'));
}
export function stamp(now = new Date()) { return now.toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex'); }
export function createRun(auditRoot,profile,now) {
  const runId=stamp(now),runDir=path.join(auditRoot,'runs',runId);
  fs.mkdirSync(runDir,{recursive:false});
  for(const dir of ['evidence','reviews','reports','logs'])fs.mkdirSync(path.join(runDir,dir));
  const state={runId,profile,createdAt:(now||new Date()).toISOString(),phase:'discovery',status:'running',stages:{discovery:'pending',browser:'pending',specialists:'pending',validation:'pending',reports:'pending'}};
  writeJSON(path.join(runDir,'state.json'),state,{exclusive:true});
  return {runId,runDir,state};
}
export function prepareStore(auditRoot) { fs.mkdirSync(path.join(auditRoot,'runs'),{recursive:true}); }
export function updateState(runDir,patch) {
  const state=readJSON(path.join(runDir,'state.json'),{});
  const next={...state,...patch,stages:{...state.stages,...patch.stages},updatedAt:new Date().toISOString()};
  writeJSON(path.join(runDir,'state.json'),next);
  return next;
}
export function reportSnapshot(runDir) { const dir=path.join(runDir,'reports',stamp());fs.mkdirSync(dir);return dir; }
export function appendIndex(auditRoot,name,runDir,reportDir) {
  const file=path.join(auditRoot,name);
  const target=path.relative(auditRoot,path.join(reportDir,name)).split(path.sep).join('/');
  const line='- ['+path.basename(runDir)+' — '+path.basename(reportDir)+']('+target+')\n';
  if (!fs.existsSync(file))fs.writeFileSync(file,'# '+name.replace('.md','').replaceAll('-',' ')+'\n\nVersioned audit reports. Every link refers to a preserved snapshot.\n\n');
  fs.appendFileSync(file,line);
}
