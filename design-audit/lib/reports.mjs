import fs from 'node:fs';
import path from 'node:path';
import {roles,unavailableReview,profileRoles} from './agents.mjs';
import {validateReviewRecord,evidencePath} from './schema.mjs';
import {crossValidate,summarize,duplicateKey} from './findings.mjs';
import {readJSON,writeJSON,reportSnapshot,appendIndex,updateState} from './store.mjs';

const escape=x=>String(x??'').replaceAll('|','\|').replaceAll('\n',' ');
const list=xs=>(xs?.length?xs.map(x=>'- '+(typeof x==='string'?x:JSON.stringify(x))).join('\n'):'- None recorded.');
const link=(reportDir,target,label)=>'['+label+']('+path.relative(reportDir,target).split(path.sep).join('/')+')';
export function loadBaseline(runDir){
 const baseline=readJSON(path.join(runDir,'evidence/results.json'),readJSON(path.join(runDir,'baseline.json'),{}));
 const additional=readJSON(path.join(runDir,'validation-results.json'),{});
 for(const key of ['checks','evidence','limitations','candidates'])baseline[key]=[...(baseline[key]||[]),...(additional[key]||[])];
 const ids=new Set();for(const check of baseline.checks){if(ids.has(check.id))throw Error('Duplicate check ID in additive validation: '+check.id);ids.add(check.id);}
 baseline.journeys=(baseline.journeys||[]).map(j=>({...j,...(additional.journeyUpdates||[]).find(x=>x.id===j.id)}));
 return baseline;
}
function findingText(f,{repoRoot,runDir,reportDir}){
 let s='### '+f.id+' — '+f.title+'\n\n'+f.severity+' · '+f.priority+' · '+f.confidence+' confidence · '+f.category+' · '+(f.confirmation||f.validationStatus)+'\n\n';
 s+='**Screen/component:** '+f.affectedScreen+' / '+f.routeOrComponent+'\n\n**Reproduction:**\n\n'+f.reproductionSteps.map((x,i)=>(i+1)+'. '+x).join('\n')+'\n\n';
 s+='**Expected:** '+f.expectedBehavior+'\n\n**Actual:** '+f.actualBehavior+'\n\n**Impact:** '+f.userImpact+'\n\n';
 s+='**Evidence:**\n\n'+(f.evidence.length?f.evidence.map(e=>'- '+link(reportDir,path.join(runDir,e.path),e.description)+' ('+e.kind+')').join('\n'):'- No direct evidence; treat as hypothesis/limitation.')+'\n\n';
 const rejected=new Set(readJSON(path.join(runDir,'evidence-review.json'),[]).filter(e=>e.status==='rejected').map(e=>e.path));
 const shot=(f.screenshotRefs||[]).find(p=>!rejected.has(p)&&evidencePath(runDir,p));
 if(shot)s+='!['+f.title+']('+path.relative(reportDir,path.join(runDir,shot)).split(path.sep).join('/')+')\n\n';
 if(f.sourceFiles.length)s+='**Source:** '+f.sourceFiles.map(p=>{const [file,lineNo]=p.split(':');return link(reportDir,path.join(repoRoot,file),p)+(lineNo?' (line '+lineNo+')':'');}).join(', ')+'\n\n';
 s+='**Recommended change:** '+f.recommendedSolution+'\n\n**Acceptance criteria:**\n\n'+list(f.acceptanceCriteria)+'\n\n';
 if(f.validation)s+='**Orchestrator validation:** '+f.validation.status+' — '+f.validation.notes+'\n\n';
 if(f.aliases?.length>1)s+='**Merged IDs:** '+f.aliases.join(', ')+'; reviewers: '+f.reportedBy.join(', ')+'\n\n';
 if(f.conflicts?.length)s+='**Review disagreements:**\n\n'+list(f.conflicts.map(c=>c.field+' ('+c.agent+'): '+c.value))+'\n\n';
 if(f.notes?.length)s+='**Notes:**\n\n'+list(f.notes)+'\n\n';
 return s;
}
function assessment(review,label){
 if(review.reviewStatus!=='completed')return label+' review was unavailable. '+review.limitations.join(' ');
 return review.strengths.join(' ')+' '+(review.findings.length?review.findings.length+' specialist findings were submitted; see the validated backlog.':'The specialist submitted no findings in the reviewed evidence.')+' '+review.limitations.join(' ');
}
export function generateReports({repoRoot,auditRoot,runDir}){
 const context=readJSON(path.join(runDir,'context.json'),{}),state=readJSON(path.join(runDir,'state.json'),{});
 const baseline=loadBaseline(runDir);
 const evidenceReview=readJSON(path.join(runDir,'evidence-review.json'),[]);
 const rejectedShots=new Set(evidenceReview.filter(e=>e.status==='rejected').map(e=>e.path));
 const reviews={},reviewErrors=[],records=(baseline.candidates||[]).map(finding=>({finding,agent:'deterministic'}));
 for(const role of roles){
  let review;try{review=readJSON(path.join(runDir,'reviews',role.id+'.json'),unavailableReview(role,'No actual specialist review has been imported.'));}catch(e){review=unavailableReview(role,'Review JSON could not be parsed: '+e.message);reviewErrors.push({agent:role.id,errors:[e.message]});}
  const errors=validateReviewRecord(review,runDir);
  if(review.agent!==role.id)errors.push('Review agent does not match its assigned role');
  if(errors.length){reviewErrors.push({agent:role.id,errors});reviews[role.id]=unavailableReview(role,'Review rejected by schema/evidence validation: '+errors.join('; '));continue;}
  reviews[role.id]=review;records.push(...review.findings.map(finding=>({finding,agent:role.id})));
 }
 const validations=readJSON(path.join(runDir,'validation.json'),[]);
 if(!Array.isArray(validations))throw Error('validation.json must contain an array');
 const duplicateGroups=readJSON(path.join(runDir,'duplicate-groups.json'),[]);
 for(const group of duplicateGroups){
  if(!group.key||!group.reason||!Array.isArray(group.findingIds)||group.findingIds.some(id=>!records.some(r=>r.finding.id===id)))throw Error('Invalid orchestrator duplicate group');
  for(const record of records)if(group.findingIds.includes(record.finding.id))record.finding={...record.finding,duplicateKey:group.key};
 }
 const result=crossValidate(records,validations,runDir);
 const counts=summarize(result.findings);
 const missingEvidence=(baseline.evidence||[]).filter(e=>!evidencePath(runDir,e.path)).map(e=>e.path);
 const reportDir=reportSnapshot(runDir);
 const opts={repoRoot,runDir,reportDir};
 const findings=result.findings.filter(f=>f.confirmation!=='rejected');
 const limitations=[...(baseline.limitations||[]),...roles.flatMap(r=>reviews[r.id].limitations)];
 if(missingEvidence.length)limitations.push('Missing baseline evidence: '+missingEvidence.join(', '));
 const checks=baseline.checks||[];
 const testCounts=Object.fromEntries(['passed','failed','skipped','blocked','error'].map(s=>[s,checks.filter(c=>c.status===s).length]));
 const schemaValid=!reviewErrors.length&&!result.rejected.length&&!result.validationProblems.length&&!missingEvidence.length;
 const selected=profileRoles[state.profile||'full'];
 const selectedComplete=selected.every(id=>reviews[id].reviewStatus==='completed');
 const reportStatus=!schemaValid?'incomplete-invalid-evidence':testCounts.error||testCounts.blocked?'incomplete-browser-execution':!selectedComplete?'deterministic-complete-specialist-review-unavailable':counts.pendingValidation?'reviewed-pending-validation':'reviewed';
 const bundle={runId:state.runId||path.basename(runDir),profile:state.profile||'full',revision:context.revision,status:reportStatus,generatedAt:new Date().toISOString(),counts,testCounts,reviewers:roles.map(r=>({agent:r.id,status:reviews[r.id].reviewStatus,method:reviews[r.id].method})),findings,mergedDuplicates:result.duplicateCount,rejectedFindings:result.rejected,reviewErrors,validationProblems:result.validationProblems,missingEvidence,limitations:[...new Set(limitations)],checks,journeys:baseline.journeys||[]};
 writeJSON(path.join(reportDir,'findings.json'),bundle,{exclusive:true});
 for(const role of roles){
  const review=reviews[role.id];let md='# '+role.name+'\n\nStatus: '+review.reviewStatus+'; actual method: '+review.method+'\n\n## Scope\n\n'+review.scope+'\n\n## Strengths\n\n'+list(review.strengths)+'\n\n## Evidence reviewed\n\n'+list(review.evidenceReviewed.map(p=>link(reportDir,path.join(runDir,p),p)))+'\n\n## Findings submitted independently\n\n';
  md+=review.findings.length?review.findings.map(f=>findingText(f,opts)).join('\n'):'No specialist findings were submitted. An unavailable review is not a passing review.\n';
  md+='\n## Limits\n\n'+list(review.limitations)+'\n';fs.writeFileSync(path.join(reportDir,role.file),md,{flag:'wx'});
 }
 let cv='# Cross-validation\n\n'+records.length+' candidates; '+result.duplicateCount+' duplicates merged; '+findings.length+' retained findings.\n\n';
 cv+='## Confirmation rules\n\nEvidence files must exist inside this run. Findings are schema validated. A hypothesis remains a hypothesis. P0/P1 issues require a separate orchestrator validation entry. Conflicting merged opinions remain pending until explicitly resolved. No issue is confirmed merely because multiple agents repeat it.\n\n';
 cv+='## Decisions\n\n'+findings.map(f=>'- **'+f.id+'** — '+f.confirmation+'; '+(f.validation?.notes||f.notes?.join(' ')||'Within-scope evidence and submitted validation status checked.')).join('\n')+'\n\n';
 cv+='## Rejected or incomplete material\n\n'+list([...result.rejected.map(r=>r.id+': '+r.errors.join('; ')),...reviewErrors.map(r=>r.agent+': '+r.errors.join('; ')),...result.validationProblems.map(r=>r.findingId+': '+r.reason),...missingEvidence.map(p=>'Missing evidence: '+p)])+'\n\n## Disagreements\n\n'+list(findings.filter(f=>f.conflicts.length).map(f=>f.id+': '+f.conflicts.map(c=>c.field+' from '+c.agent).join(', ')+'; '+(f.validation?.resolvesConflicts?'resolved by orchestrator':'unresolved'))) +'\n';
 cv+='\n## Screenshot acceptance\n\n'+list(evidenceReview.filter(e=>e.status!=='accepted').map(e=>e.path+' — '+e.status+': '+e.reason+(e.replacement?' Replacement: '+e.replacement:'')))+'\n';
 cv+='\n## Explicit duplicate groups\n\n'+list(duplicateGroups.map(g=>g.findingIds.join(', ')+' → '+g.key+': '+g.reason))+'\n';
 fs.writeFileSync(path.join(reportDir,'06-cross-validation.md'),cv,{flag:'wx'});
 let report='# Morzsa UX/UI audit\n\nRun: '+bundle.runId+' · profile '+bundle.profile+' · revision '+(bundle.revision||'unavailable')+'\n\n## Executive summary\n\nStatus: **'+reportStatus+'**. '+counts.total+' retained findings: '+counts.confirmed+' confirmed, '+counts.hypotheses+' hypotheses, '+counts.opportunities+' product opportunities, '+counts.pendingValidation+' awaiting validation. Deterministic checks: '+testCounts.passed+' passed, '+testCounts.failed+' failed, '+testCounts.skipped+' skipped, '+testCounts.blocked+' blocked, '+testCounts.error+' errors. These are observations against the audited local revision and explicitly named fixtures.\n\n';
 report+='| Severity | All findings | Confirmed |\n|---|---:|---:|\n'+Object.keys(counts.bySeverity).map(s=>'| '+s+' | '+counts.bySeverity[s]+' | '+counts.confirmedBySeverity[s]+' |').join('\n')+'\n\n';
 report+='## Overall UX assessment\n\n'+assessment(reviews.ux,'UX')+'\n\n## Overall visual assessment\n\n'+assessment(reviews.visual,'Visual')+'\n\n## Overall product assessment\n\n'+assessment(reviews.product,'Product')+'\n\n';
 const critical=findings.filter(f=>f.severity==='Critical');report+='## Critical findings\n\n'+(critical.length?critical.map(f=>f.id+' — '+f.title+' ('+f.confirmation+')').join('\n'):'No Critical finding was confirmed in the tested scope. This does not establish absence of critical defects outside that scope.')+'\n\n';
 report+='## Prioritized backlog\n\n| ID | Priority | Severity | Category | Status | Finding |\n|---|---|---|---|---|---|\n'+findings.map(f=>'| '+f.id+' | '+f.priority+' | '+f.severity+' | '+f.category+' | '+f.confirmation+' | '+escape(f.title)+' |').join('\n')+'\n\n'+findings.map(f=>findingText(f,opts)).join('\n');
 report+='## Strongest aspects\n\n'+list([...new Set(roles.flatMap(r=>reviews[r.id].strengths))])+'\n\n## User journeys\n\n'+(baseline.journeys||[]).map((j,i)=>(i+1)+'. **'+(j.id||'')+' '+(j.title||j.name||'')+' — '+j.status+'**\n'+(j.steps?.length?j.steps.map(s=>'   - '+(typeof s==='string'?s:JSON.stringify(s))).join('\n'):'   - See recorded check evidence.')+(j.limitations?.length?'\n   - Limits: '+j.limitations.join('; '):'')).join('\n\n')+'\n\n';
 report+='## Accessibility assessment\n\n'+assessment(reviews.accessibility,'Accessibility')+'\n\nAutomated axe checks and keyboard observations cover specific states. They do not establish screen-reader or WCAG conformance for the whole product.\n\n## Responsive assessment\n\n'+list(checks.filter(c=>/responsive|overflow|viewport|320|375|390|768|1280|1440/i.test(c.id+' '+c.title)).map(c=>c.id+' — '+c.status+': '+(c.details||c.title)))+'\n\n';
 report+='## Actual specialist execution\n\n'+list(bundle.reviewers.map(r=>r.agent+': '+r.status+' ('+r.method+')'))+'\n\n## Verification results\n\n| Check | Status | Detail |\n|---|---|---|\n'+checks.map(c=>'| '+escape(c.id+' '+(c.title||''))+' | '+c.status+' | '+escape(typeof c.details==='object'?JSON.stringify(c.details):c.details)+' |').join('\n')+'\n\n';
 if(fs.existsSync(path.join(runDir,'execution-verification.md')))report+='## Audit-system verification\n\n'+link(reportDir,path.join(runDir,'execution-verification.md'),'Executed infrastructure tests, product suites, provider smoke, corrected comparison and preservation checks')+'\n\n';
 report+='## Technical and environment limitations\n\n'+list(bundle.limitations)+'\n\n## Recommended next steps\n\n1. Address confirmed P0/P1 issues first using the implementation plan.\n2. Resolve pending reproduction and conflicting interpretations before implementation.\n3. Validate live services and assistive technology only in an authorized safe test environment.\n4. Repeat the same profile on the changed revision and compare preserved runs.\n\n';
 const representative=['A-pantry-setup','B-inventory','C-shopping-mode','D-known-stock-recipe','E-resumed-cooking','F-proposal','G-household-invitations','responsive-overview-1440'];
 const acceptedShots=(baseline.evidence||[]).filter(e=>e.kind==='screenshot'&&!rejectedShots.has(e.path)&&evidencePath(runDir,e.path));
 const gallery=representative.map(key=>acceptedShots.find(e=>e.path.includes(key))).filter(Boolean);
 report+='## Screenshot evidence\n\n'+gallery.map(e=>'### '+e.description+'\n\n!['+e.description+']('+path.relative(reportDir,path.join(runDir,e.path)).split(path.sep).join('/')+')').join('\n\n')+'\n\nFull screenshot list: '+link(reportDir,path.join(reportDir,'SCREENSHOT-INDEX.md'),'screenshot index')+'.\n';
 fs.writeFileSync(path.join(reportDir,'FINAL-REPORT.md'),report,{flag:'wx'});
 const groups=[['Immediate fixes',f=>['P0','P1'].includes(f.priority)],['High-value UX improvements',f=>!['P0','P1'].includes(f.priority)&&['confirmed-bug','reproducible-usability'].includes(f.category)],['Visual refinements',f=>!['P0','P1'].includes(f.priority)&&f.category==='visual-inconsistency'],['Accessibility improvements',f=>!['P0','P1'].includes(f.priority)&&f.category==='accessibility'],['Larger product opportunities',f=>['product-opportunity','hypothesis','environment-limitation'].includes(f.category)&&!['P0','P1'].includes(f.priority)]];
 let plan='# Implementation plan\n\nThe product-source fingerprint check records whether application files changed during capture. Briefs below require the stated validation gates before implementation. Preserve local morzsa-v1/v2 saves, shared RPC contracts, the Morzsa mascot and the existing visual system.\n\n';
 for(const [name,filter]of groups){plan+='## '+name+'\n\n';const group=findings.filter(filter);if(!group.length){plan+='No retained recommendation in this group.\n\n';continue;}for(const f of group){plan+=findingText(f,opts)+'**Implementation gate:** '+(f.confirmation==='confirmed'?'Confirmed within the recorded scope.':f.confirmation+'; validate before treating as a defect.')+'\n\n**Regression tests:**\n\n'+list(f.regressionTests?.length?f.regressionTests:f.acceptanceCriteria.map(c=>'Add or rerun a deterministic check proving: '+c))+'\n\n';}}
 fs.writeFileSync(path.join(reportDir,'IMPLEMENTATION-PLAN.md'),plan,{flag:'wx'});
 const shots=(baseline.evidence||[]).filter(e=>e.kind==='screenshot');
 fs.writeFileSync(path.join(reportDir,'SCREENSHOT-INDEX.md'),'# Screenshot index\n\n'+shots.map((e,i)=>{const review=evidenceReview.find(r=>r.path===e.path);return (i+1)+'. '+link(reportDir,path.join(runDir,e.path),e.description)+' — '+e.path+(evidencePath(runDir,e.path)?'':' (MISSING)')+(review?' **'+review.status+'**'+(review.reason?': '+review.reason:''):' (acceptance not recorded)');}).join('\n')+'\n',{flag:'wx'});
 if(fs.existsSync(path.join(runDir,'00-discovery.md')))fs.copyFileSync(path.join(runDir,'00-discovery.md'),path.join(reportDir,'00-discovery.md'),fs.constants.COPYFILE_EXCL);
 for(const name of ['FINAL-REPORT.md','IMPLEMENTATION-PLAN.md','06-cross-validation.md',...roles.map(r=>r.file),'SCREENSHOT-INDEX.md'])appendIndex(auditRoot,name,runDir,reportDir);
 writeJSON(path.join(runDir,'latest-report.json'),{path:path.relative(runDir,reportDir),status:reportStatus,counts,testCounts});
 updateState(runDir,{phase:'complete',status:reportStatus,stages:{specialists:selectedComplete?'completed':'unavailable',validation:counts.pendingValidation?'pending':'completed',reports:'completed'},latestReport:path.relative(runDir,reportDir),counts,testCounts});
 return {reportDir,...bundle};
}
export function compareRuns(oldDir,newDir){
 const load=dir=>{const last=readJSON(path.join(dir,'latest-report.json'));if(!last)throw Error('No generated report in '+dir);return readJSON(path.join(dir,last.path,'findings.json'));};
 const old=load(oldDir),next=load(newDir),comparable=old.profile===next.profile;
 const keyed=xs=>new Map(xs.map(f=>[duplicateKey(f),f]));const a=keyed(old.findings),b=keyed(next.findings);
 const checksA=new Map(old.checks.map(c=>[c.id,c]));
 return {oldRun:old.runId,newRun:next.runId,comparableProfiles:comparable,warning:comparable?null:'Profiles differ. Absent findings are not evidence of resolution.',newFindings:[...b].filter(([k])=>!a.has(k)).map(([,v])=>v.id),notObservedAgain:[...a].filter(([k])=>!b.has(k)).map(([,v])=>v.id),persisting:[...b].filter(([k])=>a.has(k)).map(([,v])=>v.id),regressions:next.checks.filter(c=>c.status==='failed'&&checksA.get(c.id)?.status==='passed').map(c=>c.id),improvedChecks:next.checks.filter(c=>c.status==='passed'&&checksA.get(c.id)?.status==='failed').map(c=>c.id)};
}
