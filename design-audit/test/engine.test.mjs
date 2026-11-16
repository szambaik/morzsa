import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRun,prepareStore,writeJSON,readJSON} from '../lib/store.mjs';
import {validateFindingRecord,validateReviewRecord,evidencePath} from '../lib/schema.mjs';
import {mergeFindings,crossValidate} from '../lib/findings.mjs';
import {generateReports,compareRuns,loadBaseline} from '../lib/reports.mjs';
import {unavailableReview,roles,invokeCodex,redactProviderLog} from '../lib/agents.mjs';
import {parseArgs,runAudit,importReview} from '../engine.mjs';

function fixture(t){
 const repo=fs.mkdtempSync(path.join(os.tmpdir(),'morzsa-audit-engine-')),root=path.join(repo,'design-audit');fs.mkdirSync(root);fs.writeFileSync(path.join(repo,'package.json'),JSON.stringify({scripts:{test:'node --test'},dependencies:{}}));fs.writeFileSync(path.join(repo,'app.js'),'// unchanged test fixture');
 prepareStore(root);const {runDir}=createRun(root,'full');fs.writeFileSync(path.join(runDir,'evidence','screen.png'),'synthetic system test marker');fs.writeFileSync(path.join(runDir,'evidence','check.json'),'{}');
 writeJSON(path.join(runDir,'context.json'),{revision:'fixture',sourceFingerprint:{}});writeJSON(path.join(runDir,'evidence','results.json'),{checks:[],journeys:[],evidence:[{path:'evidence/screen.png',description:'Fixture',kind:'screenshot'}],limitations:['Synthetic engine unit test; not product evidence.'],candidates:[]});
 t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));return {repo,root,runDir};
}
function finding(extra={}){return {id:'QA-001',title:'Example issue',category:'confirmed-bug',severity:'High',priority:'P1',confidence:'High',affectedScreen:'Inventory',routeOrComponent:'inventory',reproductionSteps:['Open synthetic inventory','Press example control twice'],expectedBehavior:'Persists once',actualBehavior:'Persists twice',userImpact:'Duplicate synthetic item',evidence:[{path:'evidence/check.json',description:'Test result',kind:'test'}],screenshotRefs:['evidence/screen.png'],sourceFiles:['app.js:1'],recommendedSolution:'Make the action idempotent',acceptanceCriteria:['A second click keeps one item'],validationStatus:'reproduced',...extra};}
const review=f=>({agent:'qa',reviewStatus:'completed',method:'codex-subagent',scope:'Recorded synthetic QA evidence',evidenceReviewed:['evidence/screen.png','evidence/check.json'],strengths:['Clear labels'],limitations:['No live services'],findings:f?[f]:[]});

test('schema requires every requested field and rejects unknown severity',t=>{const {runDir}=fixture(t);assert.deepEqual(validateFindingRecord(finding(),runDir),[]);const bad=finding({severity:'urgent'});assert.ok(validateFindingRecord(bad,runDir).some(x=>x.includes('severity')));delete bad.title;assert.ok(validateFindingRecord(bad,runDir).some(x=>x.includes('required')));});
test('missing and escaping evidence is rejected including symlinks',t=>{const {runDir,repo}=fixture(t);assert.ok(validateFindingRecord(finding({evidence:[{path:'evidence/missing.png',kind:'screenshot',description:'Missing'}]}),runDir).length);assert.equal(evidencePath(runDir,'../app.js'),null);fs.symlinkSync(path.join(repo,'app.js'),path.join(runDir,'evidence','escape.js'));assert.equal(evidencePath(runDir,'evidence/escape.js'),null);});
test('hypothesis cannot masquerade as a confirmed or high confidence finding',t=>{const {runDir}=fixture(t);assert.ok(validateFindingRecord(finding({category:'hypothesis'}),runDir).some(x=>x.includes('hypothesis')));assert.deepEqual(validateFindingRecord(finding({category:'hypothesis',confidence:'Low',validationStatus:'needs-validation'}),runDir),[]);});
test('duplicate merging retains every evidence reference and reviewer and flags disagreement',t=>{fixture(t);const a=finding({duplicateKey:'one'}),b=finding({id:'UX-003',duplicateKey:'one',priority:'P2',evidence:[{path:'evidence/screen.png',kind:'screenshot',description:'Additional view'}]});const merged=mergeFindings([{finding:a,agent:'qa'},{finding:b,agent:'ux'}]);assert.equal(merged.length,1);assert.deepEqual(merged[0].aliases,['QA-001','UX-003']);assert.equal(merged[0].evidence.length,2);assert.deepEqual(merged[0].reportedBy,['qa','ux']);assert.equal(merged[0].conflicts[0].field,'priority');});
test('important findings require separate validation with existing evidence',t=>{const {runDir}=fixture(t);assert.equal(crossValidate([finding()],[],runDir).findings[0].confirmation,'pending-validation');const bad=crossValidate([finding()],[{findingId:'QA-001',status:'reproduced',evidence:[]}],runDir);assert.equal(bad.validationProblems.length,1);assert.equal(bad.findings[0].confirmation,'pending-validation');const good=crossValidate([finding()],[{findingId:'QA-001',status:'reproduced',evidence:finding().evidence,notes:'Independent repeat'}],runDir);assert.equal(good.findings[0].confirmation,'confirmed');});
test('conflicting duplicates remain pending until an explicit resolution',t=>{const {runDir}=fixture(t);const records=[finding({duplicateKey:'one'}),finding({id:'UX-001',duplicateKey:'one',recommendedSolution:'Different remedy'})];const entry={findingId:'QA-001',status:'reproduced',evidence:finding().evidence,notes:'Verified'};assert.equal(crossValidate(records,[entry],runDir).findings[0].confirmation,'pending-validation');entry.resolvesConflicts=true;assert.equal(crossValidate(records,[entry],runDir).findings[0].confirmation,'confirmed');});
test('unavailable specialists cannot fabricate findings',t=>{const {runDir}=fixture(t);assert.ok(validateReviewRecord({...review(finding()),reviewStatus:'unavailable'},runDir).length);assert.deepEqual(validateReviewRecord(unavailableReview(roles[0],'No credentials'),runDir),[]);});
test('runs and report snapshots never destroy earlier results',t=>{const {repo,root,runDir}=fixture(t);const initial=generateReports({repoRoot:repo,auditRoot:root,runDir});const original=fs.readFileSync(path.join(initial.reportDir,'FINAL-REPORT.md'),'utf8');writeJSON(path.join(runDir,'reviews','qa.json'),review(finding()));const later=generateReports({repoRoot:repo,auditRoot:root,runDir});assert.notEqual(initial.reportDir,later.reportDir);assert.equal(fs.readFileSync(path.join(initial.reportDir,'FINAL-REPORT.md'),'utf8'),original);assert.equal(later.counts.total,1);assert.ok(fs.existsSync(path.join(later.reportDir,'IMPLEMENTATION-PLAN.md')));assert.equal(initial.reviewers.every(r=>r.status==='unavailable'),true);const r1=createRun(root,'qa',new Date(0)),r2=createRun(root,'qa',new Date(0));assert.notEqual(r1.runDir,r2.runDir);});
test('actual review import archives previous version',t=>{const {runDir,repo}=fixture(t);const source=path.join(repo,'review.json');writeJSON(source,review());importReview(source,runDir);writeJSON(source,review(finding()));importReview(source,runDir);assert.equal(readJSON(path.join(runDir,'reviews','qa.json')).findings.length,1);assert.equal(fs.readdirSync(path.join(runDir,'reviews','history')).length,1);});
test('report flags missing baseline evidence instead of asserting completeness',t=>{const {repo,root,runDir}=fixture(t);fs.unlinkSync(path.join(runDir,'evidence','screen.png'));const r=generateReports({repoRoot:repo,auditRoot:root,runDir});assert.equal(r.status,'incomplete-invalid-evidence');assert.deepEqual(r.missingEvidence,['evidence/screen.png']);});
test('comparison detects deterministic regressions without claiming absent findings fixed',t=>{const {repo,root,runDir}=fixture(t);const r=readJSON(path.join(runDir,'evidence','results.json'));r.checks=[{id:'one',status:'passed'}];writeJSON(path.join(runDir,'evidence','results.json'),r);generateReports({repoRoot:repo,auditRoot:root,runDir});const next=createRun(root,'regression').runDir;writeJSON(path.join(next,'context.json'),{});writeJSON(path.join(next,'evidence','results.json'),{...r,evidence:[],checks:[{id:'one',status:'failed'}]});generateReports({repoRoot:repo,auditRoot:root,runDir:next});const c=compareRuns(runDir,next);assert.deepEqual(c.regressions,['one']);assert.equal(c.comparableProfiles,false);assert.match(c.warning,/not evidence of resolution/);});
test('unknown profiles and unsafe provider assumptions are rejected',()=>{assert.throws(()=>parseArgs(['--profile','unknown']));assert.throws(()=>parseArgs(['--agents','magic']));assert.throws(()=>parseArgs(['--import-review','file']));assert.equal(parseArgs([]).agents,'none');});
test('unavailable Codex executable is an honest provider failure',async t=>{const {runDir}=fixture(t);const r=await invokeCodex({prompt:'Synthetic engine test; no API.',runDir,name:'provider-unavailable',schema:{type:'object'},executable:path.join(runDir,'missing-codex'),timeoutMs:1000});assert.equal(r.ok,false);assert.match(r.error,/ENOENT/);});
test('orchestrator survives browser failure, records it and generates limited reports',async t=>{const {repo,root}=fixture(t);const result=await runAudit({profile:'qa',agents:'none'},{repository:repo,store:root,browserRunner:async()=>{throw Error('Synthetic browser failure');},startupRunner:async()=>({checks:[],evidence:[],limitations:['Synthetic startup substitute']})});assert.equal(result.exitCode,1);assert.equal(result.testCounts.error,1);const baseline=readJSON(path.join(result.runDir,'evidence','results.json'));assert.ok(baseline.limitations.some(x=>x.includes('Synthetic browser failure')));assert.ok(fs.existsSync(path.join(result.reportDir,'FINAL-REPORT.md')));assert.equal(fs.readFileSync(path.join(repo,'app.js'),'utf8'),'// unchanged test fixture');});
test('orchestrator calls browser with the selected profile and emits success evidence',async t=>{const {repo,root}=fixture(t);let actual;const result=await runAudit({profile:'visual',agents:'none'},{repository:repo,store:root,browserRunner:async args=>{actual=args;fs.writeFileSync(path.join(args.runDir,'evidence','observed.txt'),'Browser runner fixture');return {checks:[{id:'fixture',title:'Fixture execution',status:'passed',details:'Synthetic engine test',evidence:['evidence/observed.txt']}],journeys:[{id:'A',title:'Fixture',status:'passed',steps:['Fixture only']}],evidence:[{path:'evidence/observed.txt',description:'Fixture',kind:'test'}],limitations:[]};}});assert.equal(actual.profile,'visual');assert.equal(result.exitCode,0);assert.equal(result.testCounts.passed,2);assert.match(result.status,/specialist-review-unavailable/);});

test('hypotheses remain unconfirmed even if an imported validator attempts promotion',t=>{const {runDir}=fixture(t);const hypothesis=finding({category:'hypothesis',confidence:'Low',validationStatus:'needs-validation'});const r=crossValidate([hypothesis],[{findingId:'QA-001',status:'reproduced',evidence:hypothesis.evidence,notes:'Overclaim from validator'}],runDir);assert.equal(r.findings[0].confirmation,'hypothesis');assert.equal(r.findings[0].validationStatus,'needs-validation');});
test('submitted rejected findings do not appear as active backlog',t=>{const {runDir}=fixture(t);const r=crossValidate([finding({category:'hypothesis',confidence:'Low',validationStatus:'rejected'})],[],runDir);assert.equal(r.findings[0].confirmation,'rejected');});
test('provider subprocess adapter passes read-only flags and parses structured output',async t=>{
 const {runDir}=fixture(t);const shim=path.join(runDir,'codex-shim.mjs');
 fs.writeFileSync(shim,`#!/usr/bin/env node
import fs from 'node:fs';
const a=process.argv.slice(2);
fs.writeFileSync(a[a.indexOf('--output-last-message')+1],JSON.stringify({args:a}));
`);
 fs.chmodSync(shim,0o700);
 const r=await invokeCodex({prompt:'Synthetic adapter smoke test; no model invoked.',runDir,name:'provider-shim',schema:{type:'object'},executable:shim,timeoutMs:3000});
 assert.equal(r.ok,true);assert.ok(r.value.args.includes('--ignore-user-config'));assert.equal(r.value.args[r.value.args.indexOf('--sandbox')+1],'read-only');assert.ok(r.value.args.includes('approval_policy=never'));assert.ok(r.value.args.includes('--output-schema'));
});


test('blocked browser journeys remain incomplete and cause an engine failure',async t=>{
 const {repo,root}=fixture(t);
 const result=await runAudit({profile:'visual',agents:'none'},{repository:repo,store:root,browserRunner:async()=>({checks:[{id:'blocked-step',status:'blocked',title:'Unreachable test control'}],evidence:[],journeys:[],limitations:[]})});
 assert.equal(result.exitCode,1);assert.equal(result.status,'incomplete-browser-execution');assert.equal(result.testCounts.blocked,1);
});
test('additive validation updates counts without rewriting the original baseline',t=>{
 const {repo,root,runDir}=fixture(t);const file=path.join(runDir,'evidence/results.json'),original=fs.readFileSync(file,'utf8');
 writeJSON(path.join(runDir,'validation-results.json'),{checks:[{id:'independent-repro',status:'failed',title:'Separate reproduction',evidence:['evidence/check.json']}],evidence:[{path:'evidence/check.json',description:'Independent result',kind:'test'}],limitations:['Additional validation only']});
 const r=generateReports({repoRoot:repo,auditRoot:root,runDir});assert.equal(r.testCounts.failed,1);assert.equal(fs.readFileSync(file,'utf8'),original);
 writeJSON(path.join(runDir,'validation-results.json'),{checks:[{id:'repeat'},{id:'repeat'}]});assert.throws(()=>loadBaseline(runDir),/Duplicate check/);
});
test('rejected screenshots remain indexed but are excluded from report gallery',t=>{
 const {repo,root,runDir}=fixture(t);writeJSON(path.join(runDir,'evidence-review.json'),[{path:'evidence/screen.png',status:'rejected',reason:'Wrong state'}]);
 writeJSON(path.join(runDir,'reviews/qa.json'),review(finding()));const r=generateReports({repoRoot:repo,auditRoot:root,runDir});
 const report=fs.readFileSync(path.join(r.reportDir,'FINAL-REPORT.md'),'utf8');assert.doesNotMatch(report,/!\[[^\]]*\]\([^)]*screen.png/);assert.match(fs.readFileSync(path.join(r.reportDir,'SCREENSHOT-INDEX.md'),'utf8'),/rejected.*Wrong state/);
});
test('an invalid regression baseline is rejected before browser execution',async t=>{
 const {repo,root}=fixture(t);let called=false;await assert.rejects(runAudit({profile:'regression',agents:'none',baseline:path.join(repo,'missing')},{repository:repo,store:root,browserRunner:async()=>{called=true}}),/absolute run path/);assert.equal(called,false);
});
test('provider diagnostics redact credentials while retaining failure cause',()=>{
 assert.equal(redactProviderLog('Incorrect API key provided: sk-synthetic-secret'),'Incorrect API key provided: [redacted]');
 assert.equal(redactProviderLog('Authorization: Bearer synthetic-private-token'),'Authorization: Bearer [redacted]');
 assert.equal(redactProviderLog('HTTP 401 unauthorized'),'HTTP 401 unauthorized');
});

test('explicit duplicate grouping retains independent submissions and reconciles different keys',t=>{
 const {repo,root,runDir}=fixture(t);const qa=review(finding({duplicateKey:'qa-wording'}));writeJSON(path.join(runDir,'reviews/qa.json'),qa);
 writeJSON(path.join(runDir,'reviews/ux.json'),{...review(finding({id:'UX-001',duplicateKey:'ux-wording'})),agent:'ux'});
 writeJSON(path.join(runDir,'duplicate-groups.json'),[{key:'same-underlying-issue',findingIds:['QA-001','UX-001'],reason:'Independent reproduction establishes the same event'}]);
 const r=generateReports({repoRoot:repo,auditRoot:root,runDir});assert.equal(r.findings.length,1);assert.equal(r.mergedDuplicates,1);assert.equal(readJSON(path.join(runDir,'reviews/qa.json')).findings[0].duplicateKey,'qa-wording');
});
