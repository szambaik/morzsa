// Deterministic household/RPC replay, not a simulated human usability score.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),V=require('../voice-model'),H=require('../household-model'),S=require('../shopping-model'),P=require('../pantry-review-model');
const root=path.resolve(import.meta.dirname,'..'),config=JSON.parse(await fs.readFile(path.join(import.meta.dirname,'pilot.json'),'utf8'));
const destination=process.argv[2]||path.join(import.meta.dirname,'runs','replay-'+new Date().toISOString().replace(/[:.]/g,'-'));
await fs.mkdir(destination,{recursive:true});
if(await fs.stat(path.join(destination,'metrics.json')).catch(e=>{if(e.code==='ENOENT')return null;throw e}))throw Error('Run already exists. Choose a new output folder to preserve its evidence.');
if(config.mode!=='replay'||config.maxExternalCalls!==0)throw Error('This runner is offline replay only; no provider calls are allowed.');
const db=new PGlite(),logs=[];let n=0;
await db.exec("create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;");
await db.exec(await fs.readFile(path.join(root,'supabase/schema.sql'),'utf8'));
const unit=name=>name==='Tej'?'l':'db',category=name=>name==='Különleges tea'?'Saját tételek':name==='Tej'?'Tejtermék és tojás':'Zöldségek';
const items=['Tej','Tojás','Sonka','Paradicsom','Kenyér'].map(name=>({name}));
const op=(action,name)=>({action,name,quantity:null,unit:null});
const uid=()=> '00000000-0000-4000-8000-'+String(++n).padStart(12,'0');
async function user(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
async function rows(hid){return (await db.query('select bucket,key,value,revision from public.household_records where household_id=$1 order by bucket,key',[hid])).rows}
async function save(hid,before,next){const changes=H.diff(before,next);if(changes.length)await db.query('select public.apply_household_changes($1,$2)',[hid,JSON.stringify(changes)]);return changes}
const personal=()=>({stock:{},cart:[],custom:[],history:[],likes:['keep'],chats:{private:'keep'}});
let seed=config.seed>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const profiles=[...config.households];for(let i=profiles.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[profiles[i],profiles[j]]=[profiles[j],profiles[i]]}
for(const profile of profiles){
 const ids=[uid(),uid()];await db.exec('reset role');for(const id of ids)await db.query('insert into auth.users values($1)',[id]);
 await user(ids[0]);const hid=(await db.query('select public.create_household($1) id',[profile.name])).rows[0].id;
 const token=(await db.query('select public.invite_household($1) token',[hid])).rows[0].token;
 await user(ids[1]);await db.query('select public.join_household($1)',[token]);
 const actors=ids.map((id,i)=>({id,profile:profile.members[i],privateHistory:[]}));
 async function event(id,member,utterance,work){
  const actor=actors[member];await user(actor.id);const before=await rows(hid),source=H.decode(before,personal()),started=performance.now();
  const result=await work(source,before);const after=await rows(hid);actor.privateHistory.push({utterance,id});
  logs.push({id:profile.id+'-'+id,household:profile.id,actor:actor.profile.id,day:id<5?1:2,utterance,mode:'scripted-output-replay',before,after,checks:result.checks,changes:result.changes||[],rpcMs:Math.round(performance.now()-started),...result.details});
 }
 await event(1,0,'Vettem tejet, tojást és egy kis sonkát.',async(s,b)=>{const p=V.plan(s,['Tej','Tojás','Sonka'].map(x=>op('stock_add',x)),items,unit),changes=await save(hid,b,p.next);return {changes,checks:{purchaseInPantry:p.next.stock.Tej===2&&p.next.stock.Tojás===2,purchaseNotOnList:p.next.cart.length===0,personalStatePreserved:JSON.stringify(p.next.chats)===JSON.stringify(s.chats)}}});
 await event(2,1,'Csináltam rántottát, elfogyott a tojás.',async(s,b)=>{const p=V.plan(s,[op('stock_remove','Tojás')],items,unit);return {changes:await save(hid,b,p.next),checks:{partnerSeesPurchase:s.stock.Tej===2,explicitRemoval:p.next.stock.Tojás===0,unrelatedPreserved:p.next.stock.Tej===2}}});
 await event(3,0,'Tegyél fel paradicsomot és kenyeret.',async(s,b)=>{const p=V.plan(s,['Paradicsom','Kenyér'].map(x=>op('list_set',x)),items,unit);return {changes:await save(hid,b,p.next),checks:{twoListed:p.next.cart.length===2,defaultQuantity:p.next.cart.every(i=>i.quantity===1)}}});
 await event(4,1,'Kenyér is kell, legyen a listán.',async(s,b)=>{const p=V.plan(s,[op('list_set','Kenyér')],items,unit);return {changes:await save(hid,b,p.next),checks:{noDuplicate:p.next.cart.filter(i=>i.name==='Kenyér').length===1,noRepeatedWrite:p.changes.length===0}}});
 await event(5,0,'Szerintem elfogyott a sajt. Mégsem, megnézem.',async(s,b)=>({checks:{unsavedReplayLeavesState:JSON.stringify(b)===JSON.stringify(await rows(hid))},details:{replayDecision:'No save; AI uncertainty detection is not tested.'}}));
 await event(6,1,'Van még tej. [közben a partner: elfogyott]',async(s,b)=>{
  const stale=b;await user(ids[0]);const removed=V.plan(s,[op('stock_remove','Tej')],items,unit);await save(hid,b,removed.next);
  await user(ids[1]);const attempted=stale.filter(r=>r.bucket==='stock'&&r.key==='Tej').map(r=>({bucket:r.bucket,key:r.key,value:2,expected:r.revision}));let conflict=false;
  try{await db.query('select public.apply_household_changes($1,$2)',[hid,JSON.stringify(attempted)])}catch(e){if(!String(e.message).includes('Conflict'))throw e;conflict=true}
  const fresh=H.decode(await rows(hid),personal());return {checks:{staleWriteRejected:conflict,partnerRemovalSurvives:fresh.stock.Tej===0},details:{attempted,conflict}};
 });
 await event(7,0,'Csak a kenyeret vettem meg, a különleges tea későbbi ötlet.',async(s,b)=>{
  const p=V.plan(s,[op('list_set','Különleges tea')],items,unit).next;p.cart=p.cart.map(i=>({...i,done:i.name==='Kenyér'}));
  const next=S.complete(p,{includeUnchecked:true,id:profile.id+'-trip',date:config.startDate,unitFor:unit,categoryFor:category,knownNames:items.map(i=>i.name)});return {changes:await save(hid,b,next),checks:{customReminderRetained:next.cart.some(i=>i.name==='Különleges tea'&&!i.done),checkedPurchased:next.stock.Kenyér===2,archiveCreated:next.history.length===1},details:{note:'includeUnchecked=true is the explicit include-regular-items choice; custom reminder still stays.'}};
 });
 await event(8,1,'Ma megerősítettem a tejet; holnap kérdezd újra.',async(s,b)=>{
  const at=Date.parse(config.startDate),checks={Tej:config.startDate},stock={...s.stock,Tej:2},now=P.due(stock,checks,category,new Set(),at),tomorrow=P.due(stock,checks,category,new Set(),at+86400000);return {checks:{noRepeatToday:!now.some(i=>i.name==='Tej'),dailyMilkReturns:tomorrow.some(i=>i.name==='Tej'),reminderDoesNotRemove:stock.Tej===2},details:{reviewToday:now.map(i=>i.name),reviewTomorrow:tomorrow.map(i=>i.name)}};
 });
}
await db.close();
const checks=logs.flatMap(l=>Object.entries(l.checks).map(([name,passed])=>({event:l.id,name,passed}))),summary={runId:path.basename(destination),seed:config.seed,mode:'offline model/RPC replay',households:config.households.length,actors:config.households.length*2,simulatedDays:config.days,events:logs.length,invariants:{passed:checks.filter(c=>c.passed).length,total:checks.length},aiIntentAccuracy:null,uiTaskCompletion:null,realtimeNetworkTested:false,externalApiCalls:0,externalApiCostUsd:0,failures:checks.filter(c=>!c.passed)};
await fs.writeFile(path.join(destination,'config.json'),JSON.stringify(config,null,2));await fs.writeFile(path.join(destination,'events.jsonl'),logs.map(l=>JSON.stringify(l)).join('\n')+'\n');await fs.writeFile(path.join(destination,'metrics.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));if(summary.failures.length)process.exitCode=1;
