const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('../realtime-model.js'),M=require('../companion-model.js');
function fixture(){const sent=[],executed=[],fatal=[],states=[],p=R.protocol({valid:()=>true,send:d=>sent.push(d),state:s=>states.push(s),user:()=>{},assistant:()=>{},fatal:c=>fatal.push(c),execute:async(d,u)=>{executed.push({d,u});return {read:true}}});return {p,sent,executed,fatal,states}}
test('Realtime tool calls wait for response completion and resume once for the whole batch',async()=>{
 const f=fixture(),e=f.p.event;e({type:'input_audio_buffer.speech_started',item_id:'u1'});e({type:'conversation.item.input_audio_transcription.completed',item_id:'u1',transcript:'Mi van otthon?'});e({type:'response.created',response:{id:'r1'}});
 for(const id of ['c1','c2'])e({type:'response.function_call_arguments.done',response_id:'r1',call_id:id,name:'read_kitchen',arguments:'{}'});
 assert.equal(f.executed.length,0);e({type:'input_audio_buffer.speech_stopped'});e({type:'response.done',response:{id:'r1',status:'completed'}});await f.p.idle();
 assert.equal(f.executed.length,2);assert.equal(f.sent.filter(d=>d.type==='response.create').length,1);assert.equal(f.sent.filter(d=>d.type==='conversation.item.create').length,2);
 e({type:'response.function_call_arguments.done',response_id:'r1',call_id:'c1',name:'read_kitchen',arguments:'{}'});e({type:'response.done',response:{id:'r1',status:'completed'}});await f.p.idle();assert.equal(f.executed.length,2);f.p.close();
});
test('A recoverable response conflict keeps voice open, while cancellation discards pending tools',async()=>{
 const f=fixture(),e=f.p.event;e({type:'response.created',response:{id:'r1'}});e({type:'error',error:{code:'conversation_already_has_active_response'}});assert.equal(f.fatal.length,0);
 e({type:'response.function_call_arguments.done',response_id:'r1',call_id:'c1',name:'propose_changes',arguments:'{}'});e({type:'response.done',response:{id:'r1',status:'cancelled'}});await f.p.idle();assert.equal(f.executed.length,0);
 e({type:'error',error:{code:'insufficient_quota'}});assert.deepEqual(f.fatal,['insufficient_quota']);f.p.close();
});
test('Delayed transcription stays attached to its original user turn',async()=>{
 const f=fixture(),e=f.p.event;e({type:'input_audio_buffer.speech_started',item_id:'u1'});e({type:'input_audio_buffer.speech_stopped'});e({type:'response.created',response:{id:'r1'}});e({type:'response.function_call_arguments.done',response_id:'r1',call_id:'c1',name:'propose_changes',arguments:'{}'});e({type:'response.done',response:{id:'r1',status:'completed'}});
 e({type:'input_audio_buffer.speech_started',item_id:'u2'});e({type:'conversation.item.input_audio_transcription.completed',item_id:'u1',transcript:'Elfogyott a tej'});e({type:'conversation.item.input_audio_transcription.completed',item_id:'u2',transcript:'Mentheted'});await f.p.idle();assert.equal(f.executed[0].u.turn,1);assert.equal(f.executed[0].u.text,'Elfogyott a tej');assert.equal(R.confirmation(f.executed[0].u.text),false);assert.equal(R.confirmation('Igen, mentsd el!'),true);f.p.close();
});
test('Voice preserves opening constraints and can retrieve older recipe history without photos',()=>{
 const messages=Array.from({length:30},(_,i)=>({role:i%2?'model':'user',text:i?'Üzenet '+i:'Irodába vihető süti holnapra',createdAt:i+1}));messages[5]={role:'model',text:'Almás süti',recipes:[{title:'Almás süti'}],photo:'private image'};
 const seeded=M.voiceHistory(messages);assert.equal(seeded.length,12);assert.match(seeded[0].text,/Irodába/);assert.equal(seeded.at(-1).text,'Üzenet 29');const found=M.voicePage(messages,{offset:0,query:'Almás'});assert.equal(found.total,1);assert.equal(found.messages[0].recipes[0].title,'Almás süti');assert.equal(found.messages[0].photo,undefined);assert.equal(M.voicePage(messages,{offset:-1}).error,'Invalid history query');
});
test('Realtime cost distinguishes text, audio and verified cached token modalities',async()=>{
 const {realtimeCents,realtimeSession}=await import('../supabase/functions/plus-assistant/realtime.mjs');const usage={input_tokens:11000,input_token_details:{text_tokens:10000,audio_tokens:1000},output_tokens:500,output_token_details:{audio_tokens:500}};assert.ok(Math.abs(realtimeCents(usage)-2.6)<.00001);assert.ok(realtimeCents({...usage,input_token_details:{...usage.input_token_details,cached_tokens_details:{text_tokens:8000}}})<2.6);
 const session=realtimeSession({language:'hu',context:{stock:['Tej'],low:['Tej']},history:[]},{});assert.ok(session.tools.some(t=>t.name==='read_conversation'));assert.match(session.instructions,/Always read_kitchen/);assert.match(session.instructions,/NEW spoken turn/);
});
test('Playback completion, interruption and mute have explicit states without treating response.done as drained audio',()=>{
 const f=fixture(),e=f.p.event;e({type:'response.created',response:{id:'r1'}});assert.equal(f.states.at(-1),'processing');
 e({type:'output_audio_buffer.started'});e({type:'response.done',response:{id:'r1',status:'completed'}});assert.equal(f.states.at(-1),'speaking');
 e({type:'output_audio_buffer.stopped'});assert.equal(f.states.at(-1),'listening');
 e({type:'output_audio_buffer.started'});e({type:'input_audio_buffer.speech_started',item_id:'u2'});assert.equal(f.states.at(-1),'hearing');
 e({type:'output_audio_buffer.cleared'});assert.equal(f.states.at(-1),'hearing');e({type:'input_audio_buffer.speech_stopped'});assert.equal(f.states.at(-1),'processing');
 const states=[],v=R.voiceView({render:s=>states.push(s),schedule:()=>1,cancel:()=>{},timeout:()=>{}});v.set('listening');v.mute(true);assert.equal(states.at(-1).state,'muted');
 v.set('speaking');assert.equal(states.at(-1).state,'speaking');assert.equal(states.at(-1).muted,true);v.set('listening');assert.equal(states.at(-1).state,'muted');v.mute(false);assert.equal(states.at(-1).state,'listening');v.close();f.p.close();
});
test('Connection/processing deadlines cannot be reset by repeated events, and late callbacks cannot resurrect closed UI',()=>{
 const timers=new Map(),states=[],expired=[];let id=0;
 const v=R.voiceView({render:s=>states.push(s),timeout:p=>expired.push(p),schedule:(cb,ms)=>{timers.set(++id,{cb,ms});return id},cancel:n=>timers.delete(n)});
 assert.equal(timers.get(1).ms,35000);v.set('listening');assert.equal(timers.size,0);v.set('processing');const pending=timers.get(2);assert.equal(pending.ms,30000);
 v.set('processing');assert.equal(id,2);pending.cb();assert.deepEqual(expired,['processing']);assert.equal(states.at(-1).state,'error');
 v.set('connecting');const late=timers.get(3).cb;v.close();const count=states.length;late();v.set('speaking');v.mute(true);assert.equal(states.length,count);assert.equal(expired.length,1);
});
