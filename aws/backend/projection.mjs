import {createHash} from 'node:crypto';
export function projectSnapshot(snapshot,dataset) {
 const primary=new Map(snapshot.primary_keys.map(k=>[k.table,k.columns]));
 const writes=new Map(),counts={};
 const emit=(PK,SK,row)=>{const item={PK,SK,record:JSON.stringify(row)},id=JSON.stringify([PK,SK]);if(writes.has(id)&&writes.get(id).record!==item.record)throw Error('Projection key collision');writes.set(id,item);};
 const collections={...snapshot.public,auth_users:snapshot.auth_users,auth_identities:snapshot.auth_identities,storage_buckets:snapshot.storage_buckets,storage_objects:snapshot.storage_objects};
 for(const [name,rows] of Object.entries(collections)){
  counts[name]=rows.length;
  for(const row of rows){
   const columns=primary.get(name)??(row.id!==undefined?['id']:Object.keys(row).sort());
   if(columns.some(k=>row[k]===undefined))throw Error('Missing source primary key');
   const key=createHash('sha256').update(JSON.stringify(columns.map(k=>row[k]))).digest('hex');
   const encoded=JSON.stringify(row);if(Buffer.byteLength(encoded)>350000)throw Error('Large source row requires an overflow object');
   emit('ARCHIVE#'+dataset+'#'+name,key,row);
   if(!Object.hasOwn(snapshot.public,name))continue;
   const scopes=new Set();
   if(row.household_id)scopes.add('H#'+row.household_id);
   if(name==='households')scopes.add('H#'+row.id);
   if(row.user_id)scopes.add('U#'+row.user_id);
   if(row.owner_id)scopes.add('U#'+row.owner_id);
   if(row.conversation_id)scopes.add('C#'+row.conversation_id);
   if(name==='conversations')scopes.add('C#'+row.id);
   if(row.recipe_id)scopes.add('R#'+row.recipe_id);
   if(name==='recipe_documents'){scopes.add('R#'+row.id);if(row.published)scopes.add('FEED');}
   for(const scope of scopes)emit('APP#'+dataset+'#'+scope,name+'#'+key,row);
  }
 }
 for(const message of snapshot.public.conversation_messages)emit('APP#'+dataset+'#M#'+message.id,'STATE',{tables:{},conversationId:message.conversation_id});
 const globalTables=Object.fromEntries(Object.entries(snapshot.public).map(([name,rows])=>[name,rows.filter(row=>!row.household_id&&!row.user_id&&!row.owner_id&&!row.conversation_id&&!row.recipe_id&&name!=='recipe_documents')]).filter(([,rows])=>rows.length));
 emit('APP#'+dataset+'#G#settings','STATE',{tables:globalTables,publishedRecipeIds:snapshot.public.recipe_documents.filter(r=>r.published).map(r=>r.id),householdEmailInvites:snapshot.public.household_email_invites,householdTokens:snapshot.public.household_invites,plusRequests:snapshot.public.morzsa_plus_requests});
 writes.get(JSON.stringify(['APP#'+dataset+'#G#settings','STATE'])).revision=1;
 return {items:[...writes.values()],counts};
}
