// Production gate: behavior, truthful receipts, mobile geometry and contrast.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {runAudit} from './engine.mjs';
const root=path.resolve(import.meta.dirname,'..');
const result=await runAudit({profile:'full',agents:'none'});
assert.equal(result.exitCode,0,'Full audit must finish with no failed or incomplete journeys');
const evidence=path.join(result.runDir,'evidence');
const scans=fs.readdirSync(evidence).filter(n=>n.endsWith('.axe.json'));
assert.ok(scans.length>=32,'Expected the complete accessibility surface coverage');
for(const scan of scans){const report=JSON.parse(fs.readFileSync(path.join(evidence,scan)));assert.equal(report.violations.length,0,scan+' has accessibility regressions')}
const target=path.join(result.runDir,'release-regressions');
const child=spawnSync(process.execPath,[path.join(import.meta.dirname,'verify-fixes.mjs'),target],{cwd:root,stdio:'inherit'});
assert.equal(child.status,0,'Targeted audit regressions must pass');
const {checks}=JSON.parse(fs.readFileSync(path.join(target,'results.json')));
const required=['RECEIPT-PENDING','RECEIPT-CONFIRMED','UNDO-PRESERVES-PARTNER','RECEIPT-FAILED','RECEIPT-RETRY','RECEIPT-LATEST-ACTION','RECEIPT-NAVIGATION','RECEIPT-NO-RESURRECTION','RECEIPT-CACHE-FAILURE','PANTRY-FILTERED-OPENER','PANTRY-FAILED-FOCUS','PANTRY-CLOSE-NO-FOCUS-STEAL','AI-EMPTY-0','AI-EMPTY-NO-WRITES','AI-VALID-recipe','AI-VALID-operation','AI-VALID-clarification','AI-PROPOSAL-NOT-COMMITTED'];
for(const width of [320,360,390,1280])required.push('RECEIPT-PLANNING-'+width,'RECEIPT-INSTORE-'+width);
for(const lang of ['hu','en'])for(const scope of ['home','low','out','all'])required.push('SEARCH-'+lang+'-'+scope,'SEARCH-CLEAR-'+lang+'-'+scope);
for(const id of required)assert.ok(checks.some(c=>c.id===id&&c.status==='passed'),'Missing required regression: '+id);
assert.ok(checks.length>=54&&checks.every(c=>c.status==='passed'),'All targeted checks must pass');
const ios=spawnSync(process.execPath,[path.join(root,'tests/check-ios-controls.mjs'),path.join(result.runDir,'ios-controls')],{cwd:root,stdio:'inherit'});
assert.equal(ios.status,0,'Native control scope and web fallback regressions must pass');
console.log('Release gate passed: full audit, '+scans.length+' axe scans, '+checks.length+' targeted checks.');

const recipeLatency=spawnSync(process.execPath,[path.join(import.meta.dirname,'recipe-latency.mjs')],{cwd:root,stdio:'inherit'});
assert.equal(recipeLatency.status,0,'Progressive recipe, cancellation and retry regressions must pass');

const dynamicRecipes=spawnSync(process.execPath,[path.join(import.meta.dirname,'dynamic-recipes.mjs')],{cwd:root,stdio:'inherit',env:{...process.env,MORZSA_DYNAMIC_OUTPUT:path.join(result.runDir,'dynamic-recipes')}});
assert.equal(dynamicRecipes.status,0,'Dynamic recipe, timer and contextual guidance regressions must pass');
