// Realtime responses and tool calls have independent lifecycles. A tool batch
// resumes the model once, after its original response has ended.
const RealtimeModel=(()=>{
 const confirmation=text=>/^(igen|igen mentsd|igen mentsd el|mentsd|mentsd el|mentheted|mehet|rendben|oké|yes|yes save|save|save changes|go ahead)( kérlek| please)?$/u.test(String(text).trim().toLocaleLowerCase().replace(/[.!?,]/g,' ').replace(/	| +/g,' ').trim());
 function voiceView(o){
  let phase='',muted=false,closed=false,timer;
  const schedule=o.schedule||setTimeout,cancel=o.cancel||clearTimeout;
  const snapshot=()=>({phase,muted,state:phase==='listening'&&muted?'muted':phase});
  function set(value){
   if(closed)return;const next=value==='thinking'?'processing':value==='hearing'?'listening':value;
   if(next!==phase){cancel(timer);phase=next;const wait=next==='connecting'?(o.connectMs??35000):next==='processing'?(o.processMs??30000):0;
    if(wait)timer=schedule(()=>{if(closed||phase!==next)return;phase='error';o.render(snapshot());o.timeout(next)},wait);
   }o.render(snapshot());
  }
  set('connecting');
  return {set,mute:value=>{if(!closed){muted=!!value;o.render(snapshot())}},snapshot,close:()=>{closed=true;cancel(timer)}};
 }
 function protocol(o){
  let turn=0,speaking=false,playing=false,requested=false,awaiting=false,tools=0,continuation=false,closed=false,queue=Promise.resolve();
  const responses=new Map(),batches=new Map(),calls=new Set(),transcripts=new Map(),items=new Map(),seen=new Set(),waiters=new Set();
  const live=()=>!closed&&o.valid(),state=v=>{if(live())o.state(v)},send=v=>{if(live())o.send(v)};
  const activity=()=>state(speaking?'hearing':playing?'speaking':responses.size||requested||awaiting||tools?'processing':'listening');
  function resume(){if(!live()||!continuation||speaking||responses.size||requested)return;continuation=false;requested=true;send({type:'response.create'})}
  async function transcript(t){if(transcripts.has(t)||!t)return transcripts.get(t)||'';await new Promise(resolve=>{const done=()=>{clearTimeout(timer);waiters.delete(done);resolve()},timer=setTimeout(done,6000);waiters.add(done)});return transcripts.get(t)||''}
  function event(d){
   if(!live())return;
   if(d.type==='input_audio_buffer.speech_started'){turn++;speaking=true;if(d.item_id)items.set(d.item_id,turn);state('hearing')}
   if(d.type==='input_audio_buffer.speech_stopped'){speaking=false;awaiting=true;resume();activity()}
   if(d.type==='response.created'){requested=false;awaiting=false;responses.set(d.response.id,turn);activity()}
   if(d.type==='output_audio_buffer.started'){playing=true;activity()}
   if(['output_audio_buffer.stopped','output_audio_buffer.cleared'].includes(d.type)){playing=false;activity()}
   if(d.type==='conversation.item.input_audio_transcription.completed'&&d.transcript?.trim()&&!seen.has(d.item_id)){
    seen.add(d.item_id);const t=items.get(d.item_id)||turn||++turn;transcripts.set(t,d.transcript);for(const wake of waiters)wake();o.user(d.transcript);
   }
   if(['response.output_audio_transcript.done','response.audio_transcript.done'].includes(d.type)&&d.transcript&&!seen.has('assistant:'+d.item_id)){seen.add('assistant:'+d.item_id);o.assistant(d.transcript)}
   if(d.type==='response.function_call_arguments.done'&&!calls.has(d.call_id)){
    calls.add(d.call_id);const id=d.response_id||responses.keys().next().value||'pending',batch=batches.get(id)||[];batch.push({...d,userTurn:responses.get(id)??turn});batches.set(id,batch);
   }
   if(d.type==='response.done'){
    const id=d.response.id;responses.delete(id);requested=false;awaiting=false;const batch=batches.get(id)||batches.get('pending')||[];batches.delete(id);batches.delete('pending');
    if(batch.length&&d.response.status!=='cancelled'&&d.response.status!=='failed'){tools++;queue=queue.then(async()=>{
     for(const call of batch){if(!live())return;const text=['propose_changes','confirm_changes'].includes(call.name)?await transcript(call.userTurn):'';if(!live())return;let result;try{result=await o.execute(call,{turn:call.userTurn,text})}catch{result={saved:false,error:'Action failed. No confirmed save.'}}if(!live())return;send({type:'conversation.item.create',item:{type:'function_call_output',call_id:call.call_id,output:JSON.stringify(result)}})}
     continuation=true;resume();
    }).catch(()=>{}).finally(()=>{tools--;activity()});}
    else resume();
    activity();if(d.response.status==='failed')o.failure?.(String(d.response.status_details?.error?.code||'response_failed'));
   }
   if(d.type==='error'){
    const code=String(d.error?.code||'unknown').replace(/[^a-z0-9_:-]/gi,'').slice(0,80);o.diagnostic?.(code);
    if(['invalid_api_key','insufficient_quota','billing_not_active','session_expired'].includes(code))o.fatal(code);
    else{requested=false;activity()}
   }
  }
  return {event,refresh:activity,idle:()=>queue,playbackEnded:()=>{if(live()){playing=false;activity()}},close:()=>{closed=true;for(const wake of waiters)wake();waiters.clear()}};
 }
 return {confirmation,protocol,voiceView};
})();
if(typeof window!=='undefined')window.RealtimeModel=RealtimeModel;
if(typeof module!=='undefined')module.exports=RealtimeModel;
