import {evidencePath,priorities,severities,confidence,validateFindingRecord} from './schema.mjs';

const unique = xs=>[...new Set(xs)];
const evidenceUnion = xs=>[...new Map(xs.map(x=>[x.path+'|'+x.description,x])).values()];
const normalized = x=>String(x||'').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function duplicateKey(f){return f.duplicateKey || normalized(f.title)+'|'+normalized(f.routeOrComponent);}
export function mergeFindings(records){
 const groups = new Map();
 for(const record of records){
  const {finding:f,agent='deterministic'} = record.finding?record:{finding:record};
  const key=duplicateKey(f),old=groups.get(key);
  if(!old){groups.set(key,{...structuredClone(f),aliases:[f.id],reportedBy:[agent],conflicts:[]});continue;}
  old.aliases=unique([...old.aliases,f.id]);old.reportedBy=unique([...old.reportedBy,agent]);
  for(const field of ['category','severity','priority','expectedBehavior','actualBehavior','recommendedSolution']){
   if(old[field]!==f[field])old.conflicts.push({field,agent,value:f[field]});
  }
  old.severity=severities[Math.min(severities.indexOf(old.severity),severities.indexOf(f.severity))];
  old.priority=priorities[Math.min(priorities.indexOf(old.priority),priorities.indexOf(f.priority))];
  old.confidence=confidence[Math.max(confidence.indexOf(old.confidence),confidence.indexOf(f.confidence))];
  old.evidence=evidenceUnion([...old.evidence,...f.evidence]);
  for(const field of ['screenshotRefs','sourceFiles','reproductionSteps','acceptanceCriteria','regressionTests','notes'])old[field]=unique([...(old[field]||[]),...(f[field]||[])]);
 }
 return [...groups.values()];
}
export function crossValidate(records,validations,runDir){
 const rejected=[],accepted=[];
 for(const record of records){
  const errors=validateFindingRecord(record.finding||record,runDir);
  if(errors.length)rejected.push({id:(record.finding||record)?.id||'unknown',agent:record.agent||'deterministic',errors,original:record.finding||record});
  else accepted.push(record);
 }
 const findings=mergeFindings(accepted);
 const validationProblems=[];
 for(const f of findings){
  const matches=(validations||[]).filter(v=>f.aliases.includes(v.findingId));
  const valid=matches.filter(v=>{
   const missing=(v.evidence||[]).filter(e=>!evidencePath(runDir,e.path));
   if(missing.length || !['reproduced','verified','rejected','needs-validation'].includes(v.status)){validationProblems.push({findingId:v.findingId,reason:missing.length?'Missing validation evidence':'Unknown validation status'});return false;}
   if(['reproduced','verified'].includes(v.status)&&!(v.evidence||[]).length){validationProblems.push({findingId:v.findingId,reason:'Confirmation requires reproduction/inspection evidence'});return false;}
   return true;
  });
  const v=valid.at(-1);
  f.validation = v||null;
  if(v){f.evidence=evidenceUnion([...f.evidence,...(v.evidence||[])]);if(f.category!=='hypothesis')f.validationStatus=v.status;}
  if(v?.status==='rejected'||f.validationStatus==='rejected'){f.confirmation='rejected';continue;}
  if(f.category==='hypothesis'){f.confirmation='hypothesis';continue;}
  if(f.category==='product-opportunity'){f.confirmation='opportunity';continue;}
  if(f.category==='environment-limitation'){f.confirmation='limitation';continue;}
  const highPriority=['P0','P1'].includes(f.priority);
  const conflictResolved=!f.conflicts.length || v?.resolvesConflicts===true;
  const statusConfirmed=['reproduced','verified'].includes(f.validationStatus);
  f.confirmation = statusConfirmed&&conflictResolved&&(!highPriority||v)?'confirmed':'pending-validation';
  if(f.confirmation==='pending-validation')f.notes=unique([...(f.notes||[]),!conflictResolved?'Merged reviewers disagree; orchestrator resolution is required.':highPriority&&!v?'Important issue awaits independent orchestrator validation.':'Reproduction remains incomplete.']);
 }
 findings.sort((a,b)=>priorities.indexOf(a.priority)-priorities.indexOf(b.priority)||severities.indexOf(a.severity)-severities.indexOf(b.severity)||a.id.localeCompare(b.id));
 return {findings,rejected,validationProblems,duplicateCount:accepted.length-findings.length};
}
export function summarize(findings){
 const active=findings.filter(f=>f.confirmation!=='rejected');
 const confirmed=active.filter(f=>f.confirmation==='confirmed');
 const counts=items=>Object.fromEntries(severities.map(s=>[s,items.filter(f=>f.severity===s).length]));
 return {total:active.length,bySeverity:counts(active),confirmed:confirmed.length,confirmedBySeverity:counts(confirmed),hypotheses:active.filter(f=>f.confirmation==='hypothesis').length,opportunities:active.filter(f=>f.confirmation==='opportunity').length,pendingValidation:active.filter(f=>f.confirmation==='pending-validation').length,environmentLimitations:active.filter(f=>f.confirmation==='limitation').length};
}
