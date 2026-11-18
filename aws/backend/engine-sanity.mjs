import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Engine,productKey} from './engine.mjs';
import {projectSnapshot} from './projection.mjs';
const source=JSON.parse(await readFile(new URL('../migration/build/export.json',import.meta.url))),plan=projectSnapshot(source,'sanity'),states=new Map(),revision=new Map();
for(const item of plan.items){if(!item.PK.startsWith('APP#sanity#')||item.PK.endsWith('#FEED'))continue;const key=item.PK.slice(11),s=states.get(key)??{tables:{}};if(item.SK==='STATE')Object.assign(s,JSON.parse(item.record));else(s.tables[item.SK.split('#')[0]]??=[]).push(JSON.parse(item.record));states.set(key,s);revision.set(key,1);}
class MemoryTransaction {
 constructor(){this.local=new Map();this.reads=new Map();this.dirty=new Set();}
 async get(k){if(!this.local.has(k)){this.reads.set(k,revision.get(k)??0);this.local.set(k,structuredClone(states.get(k)??{tables:{}}));}return this.local.get(k);}
 async edit(k){this.dirty.add(k);return this.get(k);}
 async commit(){for(const [k,v] of this.reads)if((revision.get(k)??0)!==v)throw Object.assign(Error('Conflict'),{status:409});for(const k of this.dirty){states.set(k,structuredClone(this.local.get(k)));revision.set(k,(revision.get(k)??0)+1);}}
}
const member=source.public.household_members[0],uid=member.user_id,hid=member.household_id,profile={userId:uid},run=async(name,args)=>{const tx=new MemoryTransaction(),e=new Engine(tx,profile),out=await e.rpc(name,args);await tx.commit();return out;};
assert.equal(productKey('  TEJ  '),'tej');
const before=structuredClone(states.get('H#'+hid)),rid=randomUUID(),name='AWS sanity '+rid,request_id=randomUUID();
const args={hid,request_id,changes:[{bucket:'cart',key:name,expected:0,value:{name,quantity:1,unit:'db',done:false}}]};
assert.deepEqual(await run('apply_household_changes_once',args),{applied:true,replayed:false});
assert.deepEqual(await run('apply_household_changes_once',args),{applied:true,replayed:true});
const current=states.get('H#'+hid);assert.deepEqual(current.tables.household_records.filter(r=>r.key!==name),before.tables.household_records);
const t1=new MemoryTransaction(),t2=new MemoryTransaction(),e1=new Engine(t1,profile),e2=new Engine(t2,profile),change={hid,changes:[{bucket:'cart',key:name,expected:1,value:{name,quantity:2,unit:'db',done:false}}]};
await e1.rpc('apply_household_changes',change);await e2.rpc('apply_household_changes',change);await t1.commit();await assert.rejects(t2.commit(),e=>e.status===409);
const outsider=new Engine(new MemoryTransaction(),{userId:randomUUID()});await assert.rejects(outsider.household(hid),e=>e.status===403);
const tx=new MemoryTransaction(),owner=new Engine(tx,profile);await owner.household(hid);await tx.edit('U#'+uid);const revoke=new MemoryTransaction(),h=await revoke.edit('H#'+hid);h.tables.household_members=h.tables.household_members.filter(m=>m.user_id!==uid);await revoke.commit();await assert.rejects(tx.commit(),e=>e.status===409);
// Restore only the synthetic in-memory fixture for subsequent cases.
states.set('H#'+hid,current);revision.set('H#'+hid,(revision.get('H#'+hid)??0)+1);
const cid=randomUUID(),mid=randomUUID(),meta={kind:'chat',title:'Sanity',parentId:'private-parent'};
await run('sync_conversation',{cid,meta,expected:0,items:[{id:mid,role:'user',text:'Szia',createdAt:Date.now()}]});
const page=await run('conversation_page',{cid});assert.equal(page.messages.length,1);assert.equal(page.messages[0].body.text,'Szia');
await assert.rejects(outsider.conversation(cid),e=>[403,404].includes(e.status));
assert.equal(await run('begin_conversation_turn',{cid,tid:request_id}),true);assert.equal(await run('begin_conversation_turn',{cid,tid:randomUUID()}),false);
await run('end_conversation_turn',{cid,tid:request_id});
console.log('DynamoDB domain sanity passed: source-format loading, unrelated rows preserved, idempotent receipts, concurrent conflict, membership revocation race, private chat and turn leases.');
