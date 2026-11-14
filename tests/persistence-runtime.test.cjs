const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const Model=require('../persistence-model'),Recipe=require('../recipe-room-model');
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',cid='10000000-0000-4000-8000-000000000001',mid='20000000-0000-4000-8000-000000000001';
const pause=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}},drain=async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate)};
function harness(){
 let user=a,safe=true,visible={cloud:true,active:cid,threads:[{id:cid,kind:'chat',title:'Before',updated:1,messages:[]}]},changed=0;
 const storage={},timers=new Map(),calls=[],rows=new Map(),msgs=new Map(),events={};let hook;
 const household={userId:()=>user,subscribeData:()=>({close(){}}),dataRpc:async(name,args,auth,expected)=>{
  calls.push({name,args:structuredClone(args),expected,user});if(expected!==user)throw Error('Account changed');
  if(hook){const result=await hook(name,args,expected);if(result!==undefined)return result}
  if(name==='conversation_index')return [...rows.values()].filter(r=>r.account===user).map(({account,...r})=>structuredClone(r));
  if(name==='conversation_page')return {messages:[...(msgs.get(args.cid)||[])].map(m=>({id:m.id,body:Model.message(m),sequence:1})),before:1,hasOlder:false};
  if(name==='sync_conversation'){rows.set(args.cid,{id:args.cid,owner:true,account:expected,revision:1,metadata:args.meta});const old=msgs.get(args.cid)||[];for(const m of args.items){const i=old.findIndex(x=>x.id===m.id);if(i<0)old.push(m);else old[i]=m}msgs.set(args.cid,old);return {revision:1}}
  if(name==='save_recipe_document')return args.rid;if(name==='begin_conversation_turn')return true;
 },mediaUpload:async(path,bytes,expected)=>calls.push({name:'upload',path,expected,user}),mediaSign:async(path,expected)=>{calls.push({name:'sign',path,expected,user});return {signedURL:'/object/sign/chat-media/x.jpg'}}};
 const context={window:{addEventListener(){}},document:{hidden:false,addEventListener:(event,fn)=>events[event]=fn},localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>storage[k]=v},household,PersistenceModel:Model,RecipeRoomModel:Recipe,crypto:crypto.webcrypto,TextEncoder,Uint8Array,structuredClone,atob,language:'hu',setInterval:()=>0,setTimeout:(fn,delay)=>{if(delay===100){queueMicrotask(fn);return 0}const id=Symbol();timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id)};
 context.window.MORZSA_CLOUD={url:'https://cloud'};vm.runInNewContext(fs.readFileSync('persistence.js','utf8'),context);
 const api=context.window.MorzsaPersistence;
 const handlers={safe:()=>safe,changed:book=>{changed++;visible=structuredClone(book);return visible},saved:()=>{},status:()=>{}};
 return {api,calls,rows,msgs,storage,events,get visible(){return visible},get changed(){return changed},attach:()=>api.attach(visible,handlers),account:value=>user=value,safe:value=>safe=value,hook:fn=>hook=fn,setBook:v=>visible=v};
}
test('refresh arriving after typing starts preserves visible chat, then refreshes after editing ends',async()=>{
 const h=harness();h.attach();await drain();const held=pause();let blocked=true;
 h.hook(async name=>{if(name==='conversation_index'&&blocked){await held.promise;return [{id:cid,owner:true,revision:2,metadata:{kind:'chat',title:'Remote',updated:2}}]}});
 const before=h.changed,work=h.api.refresh();h.safe(false);held.resolve();await work;assert.equal(h.changed,before);assert.equal(h.visible.threads[0].title,'Before');
 blocked=false;h.rows.set(cid,{id:cid,owner:true,account:a,revision:2,metadata:{kind:'chat',title:'Remote',updated:2}});h.safe(true);await h.api.refresh();assert.equal(h.visible.threads[0].title,'Remote');
});
test('old recipe save finishing after an account switch never sends the old conversation or photo as the new user',async()=>{
 const h=harness();h.attach();await drain();const held=pause(),started=pause();
 h.hook(async name=>{if(name==='save_recipe_document'){started.resolve();await held.promise;return '30000000-0000-4000-8000-000000000001'}});
 const old=h.visible;old.threads[0].messages=[{id:mid,role:'user',text:'Photo',createdAt:3,photo:'data:image/jpeg;base64,/9g=',recipes:[{title:'Test',summary:'Recipe',minutes:5,ingredients:[{name:'Egg',amount:'2'}],steps:['Cook.']}]}];h.api.capture(old);const work=h.api.flush();await started.promise;
 h.account(b);h.setBook({cloud:true,active:crypto.randomUUID(),threads:[]});h.attach();held.resolve();await work;await drain();
 assert.equal(h.calls.some(c=>c.name==='sync_conversation'&&c.args.cid===cid&&c.expected===b),false);assert.equal(h.calls.some(c=>c.name==='upload'),false);assert.equal(h.visible.threads.some(t=>t.id===cid),false);
 assert.ok(h.storage[Model.accountKey(a)+':outbox'].includes('Photo'));
});
test('edits captured during a save are retained and persisted on the following flush',async()=>{
 const h=harness();h.attach();await drain();const held=pause(),started=pause();let block=true;
 h.hook(async name=>{if(name==='sync_conversation'&&block){block=false;started.resolve();await held.promise}});
 const first=h.visible;first.threads[0].messages=[{id:mid,role:'user',text:'First',createdAt:2,recipes:[]}];h.api.capture(first);const work=h.api.flush();await started.promise;
 const second=structuredClone(first);second.threads[0].title='Newest title';second.threads[0].messages.push({id:crypto.randomUUID(),role:'user',text:'Second',createdAt:3,recipes:[]});h.setBook(second);h.api.capture(second);held.resolve();await work;await h.api.flush();
 assert.equal(h.rows.get(cid).metadata.title,'Newest title');assert.deepEqual(h.msgs.get(cid).map(m=>m.text),['First','Second']);assert.equal(h.api.status(),'synced');
});
test('pending receipts and photo account ownership survive history refreshes',async()=>{
 const h=harness();h.attach();await drain();const book=h.visible;book.threads[0].messages=[{id:mid,role:'model',text:'Proposal',createdAt:2,recipes:[],result:'Saved'}];h.msgs.set(cid,[{...book.threads[0].messages[0],result:'Proposed'}]);h.api.capture(book);await h.api.loadThread(cid);assert.equal(h.visible.threads[0].messages[0].result,'Saved');
 const photo=h.visible;photo.threads[0].messages.push({id:crypto.randomUUID(),role:'user',text:'Photo',createdAt:3,recipes:[],photo:'data:image/jpeg;base64,/9g='});h.api.capture(photo);await h.api.flush();assert.equal(h.calls.find(c=>c.name==='upload').expected,a);assert.equal(h.calls.find(c=>c.name==='sign').expected,a);
});
test('a new AI turn reads the latest messages from another device even while the composer is focused',async()=>{
 const h=harness();h.attach();await drain();h.msgs.set(cid,[{id:mid,role:'model',text:'Other device reply',createdAt:4,recipes:[]}]);h.safe(false);const turn=await h.api.beginTurn(cid);assert.equal(h.visible.threads.find(t=>t.id===cid).messages[0].text,'Other device reply');h.account(b);await h.api.endTurn(cid,turn);assert.equal(h.calls.some(c=>c.name==='end_conversation_turn'),false);
});
test('deleted server conversations cannot keep a pending offline copy visible',async()=>{
 const h=harness();h.attach();await drain();const old=h.visible;old.threads[0].title='Offline edit';h.api.capture(old);h.rows.delete(cid);await h.api.refresh();assert.equal(h.visible.threads.some(t=>t.id===cid),false);assert.equal(h.storage[Model.accountKey(a)+':outbox'],'{}');
});
