// Uses an explicitly provisioned synthetic Cognito account. Never edits an imported household.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const base='https://8wk2nknxma.execute-api.eu-north-1.amazonaws.com';
const account=JSON.parse(await readFile(new URL('./build/sanity-account.json',import.meta.url)));
const results=[];let session;
async function request(path,body,expected=200,auth=true){const start=performance.now();const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(auth&&session?{Authorization:'Bearer '+session.access_token}:{}),Origin:'https://szambaik.github.io'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(90000)});let data;try{data=await r.json();}catch{throw Error('Invalid response: '+path);}results.push({path:path.split('?')[0],status:r.status,ms:Math.round(performance.now()-start)});assert.equal(r.status,expected,JSON.stringify({path,status:r.status,error:data?.error??data?.message}));return data;}
session=await request('/auth/v1/token?grant_type=password',{email:account.email,password:account.password},200,false);
await writeFile(new URL('./build/sanity-session.json',import.meta.url),JSON.stringify(session),{mode:0o600});
assert.equal((await request('/auth/v1/user')).id,session.user.id);
assert((await request('/rest/v1/households?select=id,name,owner_id')).every(h=>h.name==='AWS synthetic sanity'));
const source=JSON.parse(await readFile(new URL('../migration/build/export.json',import.meta.url)));
await request('/rest/v1/household_records?household_id=eq.'+source.public.households[0].id,undefined,403);
const feed=await request('/public/feed',{page_size:24,page_offset:0,search_text:'',tag:''},200,false);
assert.equal(feed.length,Math.min(24,source.public.recipe_documents.filter(r=>r.published).length));
if(feed[0])assert.equal((await request('/public/recipes?id=eq.'+feed[0].id+'&select=id,content,tags,published',undefined,200,false))[0].published,true);
if(process.argv.includes('--writes')){
 const hid=await request('/rest/v1/rpc/create_household',{household_name:'AWS synthetic sanity'});account.householdIds=[...new Set([...(account.householdIds??[]),...(account.householdId?[account.householdId]:[]),hid])];account.householdId=hid;account.userId=session.user.id;await writeFile(new URL('./build/sanity-account.json',import.meta.url),JSON.stringify(account),{mode:0o600});
 const name='Sanity ingredient',request_id=randomUUID(),changes=[{bucket:'cart',key:name,expected:0,value:{name,quantity:1,unit:'db',done:false}}];
 const args={hid,request_id,changes};assert.equal((await request('/rest/v1/rpc/apply_household_changes_once',args)).replayed,false);assert.equal((await request('/rest/v1/rpc/apply_household_changes_once',args)).replayed,true);
 const rows=await request('/rest/v1/household_records?household_id=eq.'+hid);assert.equal(rows.length,1);assert.equal(rows[0].value.addedBy,session.user.id);
 const updates={hid,changes:[{bucket:'cart',key:name,expected:1,value:{name,quantity:2,unit:'db',done:false}}]};
 const parallel=await Promise.all([request('/rest/v1/rpc/apply_household_changes',updates).then(()=>200).catch(error=>error.actual??0),request('/rest/v1/rpc/apply_household_changes',updates).then(()=>200).catch(error=>error.actual??0)]);assert.deepEqual(parallel.sort(),[200,409]);
 const cid=randomUUID(),mid=randomUUID(),meta={kind:'chat',title:'Synthetic sanity'};account.conversationId=cid;account.messageId=mid;await writeFile(new URL('./build/sanity-account.json',import.meta.url),JSON.stringify(account),{mode:0o600});
 await request('/rest/v1/rpc/sync_conversation',{cid,meta,expected:0,items:[{id:mid,role:'user',text:'Szia',createdAt:Date.now()}]});assert.equal((await request('/rest/v1/rpc/conversation_page',{cid})).messages.length,1);
 await request('/rest/v1/rpc/sync_conversation',{cid:randomUUID(),meta,expected:0,items:[{id:mid,role:'user',text:'Szia',createdAt:Date.now()}]},409);
}
await writeFile(new URL('./build/cloud-sanity-results.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify({passed:true,checks:results},null,2));
