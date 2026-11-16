#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRun,prepareStore,updateState,writeJSON,readJSON,stamp} from './lib/store.mjs';
import {inspectRepository,discoveryMarkdown,sourceFingerprint} from './lib/discovery.mjs';
import {runSpecialists,profileRoles,roles,makePrompt} from './lib/agents.mjs';
import {generateReports,compareRuns} from './lib/reports.mjs';
import {validateReviewRecord} from './lib/schema.mjs';
import {runAutonomousValidation} from './lib/validator.mjs';

export const auditRoot=path.dirname(fileURLToPath(import.meta.url));
export const repoRoot=path.dirname(auditRoot);
const help='Morzsa audit\n\nRun: npm --prefix design-audit run audit:ux -- --profile full [--agents codex]\nProfiles: full, ux, visual, qa, accessibility, regression\nFinalize imported reviews: node design-audit/engine.mjs --finalize RUN_DIR\nImport actual review: node design-audit/engine.mjs --import-review REVIEW_JSON --run RUN_DIR\nCompare: node design-audit/engine.mjs --compare OLD_RUN_DIR NEW_RUN_DIR\nRegression baseline: --profile regression --baseline OLD_RUN_DIR\nPrepare only: --prepare (initializes shared context and run folder, does not test)\nExit codes: 0 completed selected deterministic checks; 1 engine/provider/evidence error; 2 observed failed checks. Missing optional AI credentials alone is explicitly reported and does not prevent deterministic audit.\n';
export function parseArgs(argv){
 const out={profile:'full',agents:'none'};
 for(let i=0;i<argv.length;i++){const a=argv[i];if(a==='--help'||a==='-h')out.help=true;else if(a==='--prepare')out.prepare=true;else if(a==='--compare'){if(!argv[i+1]||!argv[i+2])throw Error('--compare needs two directories');out.compare=[path.resolve(argv[++i]),path.resolve(argv[++i])];}else if(['--profile','--agents','--finalize','--run','--import-review','--baseline'].includes(a)){if(!argv[i+1])throw Error(a+' needs a value');out[a.slice(2)]=argv[++i];}else throw Error('Unknown argument '+a);}
 if(!profileRoles[out.profile])throw Error('Unknown profile '+out.profile);
 if(!['none','codex'].includes(out.agents))throw Error('--agents must be none or codex');
 if(out['import-review']&&!out.run)throw Error('--import-review requires --run');
 return out;
}
export function importReview(source,runDir){
 const review=readJSON(path.resolve(source));const errors=validateReviewRecord(review,runDir);if(errors.length)throw Error('Review import rejected: '+errors.join('; '));
 const destination=path.join(runDir,'reviews',review.agent+'.json');
 if(fs.existsSync(destination)){const archive=path.join(runDir,'reviews','history',stamp());fs.mkdirSync(archive,{recursive:true});fs.copyFileSync(destination,path.join(archive,review.agent+'.json'),fs.constants.COPYFILE_EXCL);}
 writeJSON(destination,review);return destination;
}
export async function runAudit(options,{browserRunner=null,startupRunner=null,repository=repoRoot,store=auditRoot}={}){
 if(options.baseline&&!fs.existsSync(path.join(path.resolve(options.baseline),'latest-report.json')))throw Error('Baseline has no report. Use an absolute run path, especially with npm --prefix: '+path.resolve(options.baseline));
 prepareStore(store);const {runDir,runId}=createRun(store,options.profile);
 console.log('AUDIT_RUN_DIR='+runDir);
 fs.mkdirSync(path.join(store,'evidence'),{recursive:true});
 fs.symlinkSync(path.relative(path.join(store,'evidence'),path.join(runDir,'evidence')),path.join(store,'evidence',runId),'dir');
 const context=inspectRepository(repository);writeJSON(path.join(runDir,'context.json'),context,{exclusive:true});fs.writeFileSync(path.join(runDir,'00-discovery.md'),discoveryMarkdown(context),{flag:'wx'});
 for(const filename of ['shared-context.md','00-discovery.md'])if(fs.existsSync(path.join(store,filename))){const dest=filename==='00-discovery.md'?'project-discovery.md':filename;fs.copyFileSync(path.join(store,filename),path.join(runDir,dest),fs.constants.COPYFILE_EXCL);}
 for(const role of roles)fs.writeFileSync(path.join(runDir,'reviews',role.id+'-prompt.md'),makePrompt(role,{repoRoot:repository,runDir}),{flag:'wx'});
 updateState(runDir,{stages:{discovery:'completed'},phase:options.prepare?'prepared':'browser'});
 if(options.prepare)return {runId,runDir,prepared:true};
 let baseline={checks:[],journeys:[],evidence:[],limitations:[],candidates:[]};
 const combine=result=>{for(const key of ['checks','journeys','evidence','limitations','candidates'])baseline[key].push(...(result?.[key]||[]));for(const [key,val]of Object.entries(result||{}))if(!(key in baseline))baseline[key]=val;};
 if(context.gitInspectionLimited)baseline.limitations.push('Some Git inspection timed out; use recorded source fingerprints to identify the audited working tree.');
 try{
  const runner=browserRunner||(await import('./browser.mjs')).runBrowser;
  combine(await runner({repoRoot:repository,runDir,profile:options.profile}));
  updateState(runDir,{stages:{browser:'completed'}});
 }catch(e){
  const partial=readJSON(path.join(runDir,'evidence','results.json'));if(partial)combine(partial);
  fs.writeFileSync(path.join(runDir,'logs','browser-failure.txt'),e.stack||String(e),{flag:'wx'});
  baseline.checks.push({id:'AUDIT-BROWSER',title:'Browser audit execution',status:'error',details:e.message,evidence:['logs/browser-failure.txt']});
  baseline.evidence.push({path:'logs/browser-failure.txt',kind:'test',description:'Browser harness failure log'});
  baseline.limitations.push('Browser audit failed to complete: '+e.message);updateState(runDir,{stages:{browser:'failed'}});
 }
 if(!browserRunner&&fs.existsSync(path.join(store,'supplemental.mjs'))){
  try{const {runSupplemental}=await import('./supplemental.mjs');combine(await runSupplemental({repoRoot:repository,runDir}));}
  catch(e){fs.writeFileSync(path.join(runDir,'logs','supplemental-failure.txt'),e.stack||String(e),{flag:'wx'});baseline.checks.push({id:'AUDIT-SUPPLEMENTAL',title:'Supplemental keyboard and storage checks',status:'error',details:e.message,evidence:['logs/supplemental-failure.txt']});baseline.evidence.push({path:'logs/supplemental-failure.txt',kind:'test',description:'Supplemental harness failure'});baseline.limitations.push('Supplemental journey inspection incomplete: '+e.message);}
 }
 if(!browserRunner&&fs.existsSync(path.join(store,'verify-cooking-context.mjs'))){
  try{const {verifyCookingContext}=await import('./verify-cooking-context.mjs');const outputDir=path.join(runDir,'cooking-context');const result=await verifyCookingContext({repoRoot:repository,outputDir});combine({checks:result.checks.map(c=>({...c,evidence:['cooking-context/results.json','cooking-context/cooking-answer.png']})),limitations:result.limitations,evidence:[{path:'cooking-context/results.json',kind:'test',description:'Actual cooking-context HTTP request and return-to-step checks'},{path:'cooking-context/cooking-answer.png',kind:'screenshot',description:'Contextual cooking question and fixture answer'},{path:'cooking-context/cooking-answer.txt',kind:'dom',description:'Contextual cooking response DOM'}]});}
  catch(e){fs.writeFileSync(path.join(runDir,'logs','cooking-context-failure.txt'),e.stack||String(e),{flag:'wx'});combine({checks:[{id:'AUDIT-COOKING-CONTEXT',status:'error',title:'Cooking assistant probe execution',details:e.message,evidence:['logs/cooking-context-failure.txt']}],evidence:[{path:'logs/cooking-context-failure.txt',kind:'test',description:'Cooking-context probe failure'}],limitations:['Cooking assistant interaction probe did not complete: '+e.message]});}
 }
 if(['full','qa','regression'].includes(options.profile)){
  try{const runner=startupRunner||(await import('./documented-startup.mjs')).auditDocumentedStartup;combine(await runner({repoRoot:repository,runDir}));}
  catch(e){fs.writeFileSync(path.join(runDir,'logs','startup-failure.txt'),e.stack||String(e),{flag:'wx'});baseline.checks.push({id:'AUDIT-DOCUMENTED-STARTUP',title:'Documented server audit execution',status:'error',details:e.message,evidence:['logs/startup-failure.txt']});baseline.evidence.push({path:'logs/startup-failure.txt',kind:'test',description:'Documented startup audit failure log'});baseline.limitations.push('Documented server startup probe unavailable: '+e.message);}
 }
 const after=sourceFingerprint(repository),before=context.sourceFingerprint;const changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>before[k]!==after[k]);
 baseline.checks.push({id:'AUDIT-PRODUCT-SOURCE-UNCHANGED',title:'Product source fingerprint is unchanged',status:changed.length?'failed':'passed',details:changed.length?'Changed during run: '+changed.join(', '):'Root application source and package files match the starting SHA-256 fingerprint.',evidence:['context.json']});
 writeJSON(path.join(runDir,'source-after.json'),after,{exclusive:true});
 writeJSON(path.join(runDir,'evidence','results.json'),baseline,{exclusive:!fs.existsSync(path.join(runDir,'evidence','results.json'))});
 writeJSON(path.join(runDir,'baseline.json'),baseline,{exclusive:!fs.existsSync(path.join(runDir,'baseline.json'))});
 updateState(runDir,{phase:'specialists'});
 const specialists=await runSpecialists({repoRoot:repository,runDir,profile:options.profile,provider:options.agents,baseline});
 writeJSON(path.join(runDir,'agent-execution.json'),specialists,{exclusive:true});
 updateState(runDir,{phase:'cross-validation'});
 if(options.agents==='codex'&&specialists.some(s=>s.status==='completed')){
  const validation=await runAutonomousValidation({repoRoot:repository,runDir,profile:options.profile,baseline,browserRunner:browserRunner||(await import('./browser.mjs')).runBrowser,startupRunner:['full','qa','regression'].includes(options.profile)?startupRunner||(await import('./documented-startup.mjs')).auditDocumentedStartup:null});
  writeJSON(path.join(runDir,'validation-execution.json'),validation,{exclusive:true});
  if(validation.status==='unavailable'){baseline.limitations.push('Autonomous orchestrator validation unavailable: '+validation.error);writeJSON(path.join(runDir,'evidence','results.json'),baseline);}
 }
 const report=generateReports({repoRoot:repository,auditRoot:store,runDir});
 if(options.baseline){const comparison=compareRuns(path.resolve(options.baseline),runDir);writeJSON(path.join(report.reportDir,'comparison.json'),comparison,{exclusive:true});}
 const code=report.reviewErrors.length||report.rejectedFindings.length||report.validationProblems.length||report.missingEvidence.length||report.testCounts.error||report.testCounts.blocked||specialists.some(s=>s.status==='failed')?1:report.testCounts.failed?2:0;
 return {runId,runDir,reportDir:report.reportDir,status:report.status,counts:report.counts,testCounts:report.testCounts,exitCode:code};
}
export async function main(argv=process.argv.slice(2)){
 const options=parseArgs(argv);if(options.help){console.log(help);return 0;}
 if(options.compare){console.log(JSON.stringify(compareRuns(...options.compare),null,2));return 0;}
 if(options['import-review']){console.log('Imported '+importReview(options['import-review'],path.resolve(options.run)));return 0;}
 if(options.finalize){const runDir=path.resolve(options.finalize);if(!fs.existsSync(path.join(runDir,'state.json')))throw Error('Run is missing state.json');const result=generateReports({repoRoot,auditRoot,runDir});console.log(JSON.stringify({reportDir:result.reportDir,status:result.status,counts:result.counts,testCounts:result.testCounts},null,2));return result.reviewErrors.length||result.rejectedFindings.length||result.validationProblems.length||result.missingEvidence.length||result.testCounts.error||result.testCounts.blocked?1:result.testCounts.failed?2:0;}
 const result=await runAudit(options);console.log(JSON.stringify(result,null,2));return result.exitCode||0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{process.exitCode=await main();}catch(e){console.error('Audit infrastructure error: '+e.stack);process.exitCode=1;}}
