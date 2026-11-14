// WebRTC audio goes directly to OpenAI. The app server exchanges SDP, keeps the
// permanent API key private, authorizes access and terminates bounded sessions.
window.MorzsaRealtime=(()=>{
 let active=null;
 const say=(hu,en)=>language==='en'?en:hu;
 function open(options){if(active)return;const session={closed:false};active=session;start(session,options)}
 async function start(session,options){
  let pc,media,channel,audio,requestId,clock,muted=false,turn=0,proposalTurn=-1,lastUser='',endAt=0,connected=false;
  const seen=new Set(),calls=new Map(),waiters=new Set();let queue=Promise.resolve();
  const host=document.createElement('aside');host.id='realtime-voice';host.setAttribute('data-no-translate','');host.setAttribute('aria-label',say('Hangbeszélgetés Morzsával','Voice conversation with Morzsa'));
  host.innerHTML='<div class="realtime-title"><img src="assets/brands/morzsa.svg" alt="" width="32" height="32"><strong>'+say('Beszélgessünk','Let’s talk')+' <small>Plus</small></strong><span data-clock></span></div><p data-status role="status">'+say('Kapcsolódás…','Connecting…')+'</p><p class="realtime-caption" data-caption></p><div class="realtime-buttons"><button data-mute disabled aria-pressed="false">'+say('Némítás','Mute')+'</button><button data-end>'+say('Befejezés','End conversation')+'</button></div><small class="realtime-hint">'+say('Félbeszakíthatsz. A módosításokat szóban vagy a chatben hagyhatod jóvá.','You can interrupt. Confirm changes by voice or in the chat.')+'</small>';
  document.body.append(host);const status=text=>{if(!session.closed)host.querySelector('[data-status]').textContent=text},caption=text=>{if(!session.closed)host.querySelector('[data-caption]').textContent=String(text).slice(-500)};
  const valid=()=>!session.closed&&options.valid()&&window.AIMode?.isPlus();
  const send=data=>{if(valid()&&channel?.readyState==='open')channel.send(JSON.stringify(data))};
  async function stop(message=''){
   if(session.closed)return;session.closed=true;clearInterval(clock);media?.getTracks().forEach(t=>t.stop());channel?.close();pc?.close();if(audio){audio.pause();audio.srcObject=null;audio.remove()}host.remove();if(active===session)active=null;
   for(const [target,event,listener] of listeners)target.removeEventListener(event,listener);for(const resolve of waiters)resolve();waiters.clear();
   if(requestId)household.realtimeEnd(requestId).catch(()=>{});if(message)toast(message);options.onEnd?.();
  }
  session.stop=stop;
  const background=()=>{if(document.hidden)stop()},listeners=[[document,'visibilitychange',background],[window,'morzsa-pause',()=>stop()],[window,'pagehide',()=>stop()],[window,'offline',()=>stop(say('A kapcsolat megszakadt. Folytathatod szöveggel.','Connection lost. You can continue with text.'))],[window,'morzsa-ai-mode-change',()=>stop()],[window,'morzsa-auth-change',()=>stop()]];
  for(const [target,event,listener] of listeners)target.addEventListener(event,listener);
  host.querySelector('[data-end]').onclick=()=>stop();
  host.querySelector('[data-mute]').onclick=e=>{muted=!muted;media?.getAudioTracks().forEach(t=>t.enabled=!muted);e.target.setAttribute('aria-pressed',String(muted));e.target.textContent=say(muted?'Mikrofon vissza':'Némítás',muted?'Unmute':'Mute');status(say(muted?'Mikrofon némítva':'Hallgatlak…',muted?'Microphone muted':'Listening…'))};
  function confirmation(text){const normalized=text.trim().toLocaleLowerCase().replace(/[.!?,]/g,' ').replace(/\s+/g,' ').trim();return /^(igen|igen mentsd|igen mentsd el|mentsd|mentsd el|mentheted|mehet|rendben|oké|yes|yes save|save|save changes|go ahead)( kérlek| please)?$/u.test(normalized)}
  async function execute(event){
   if(!valid())return;let result;
   try{
    if(['propose_changes','confirm_changes'].includes(event.name)&&!lastUser){await new Promise(resolve=>{const done=()=>{clearTimeout(timer);waiters.delete(done);resolve()},timer=setTimeout(done,6000);waiters.add(done)});if(!valid())return}
    if(typeof event.arguments!=='string'||event.arguments.length>12000)throw Error('args');const args=JSON.parse(event.arguments);
    if(event.name==='read_kitchen')result=options.context();
    else if(event.name==='propose_changes'){if(!lastUser)throw Error('no user turn');result=await options.tools.propose(args.operations,lastUser);if(result?.proposed)proposalTurn=turn}
    else if(event.name==='confirm_changes'){if(turn<=proposalTurn||proposalTurn<0||!confirmation(lastUser))result={saved:false,reason:'Wait for a new explicit user confirmation, or use the Save button in the chat.'};else{result=await options.tools.confirm();if(result?.saved)proposalTurn=-1}}
    else if(event.name==='suggest_recipe'){if(typeof args.request!=='string'||!args.request.trim()||args.request.length>2000)throw Error('args');result=await options.tools.recipe(args.request)}
    else if(event.name==='go_to_step')result=options.tools.step(args.step);
    else if(event.name==='show_ingredients')result=options.tools.ingredients();
    else if(event.name==='start_timer'){if(!Number.isInteger(args.minutes)||args.minutes<1||args.minutes>120||typeof args.label!=='string'||args.label.length>80)throw Error('args');result=options.tools.timer(args.minutes,args.label)}
    else throw Error('tool');
   }catch{result={saved:false,error:'Could not perform this action. Nothing was changed; use the chat controls.'}}
   if(!valid())return;send({type:'conversation.item.create',item:{type:'function_call_output',call_id:event.call_id,output:JSON.stringify(result)}});send({type:'response.create'});
  }
  function event(data){
   if(!valid()){stop();return}
   if(data.type==='input_audio_buffer.speech_started'){turn++;lastUser='';status(say('Hallgatlak…','Listening…'))}
   if(data.type==='response.created')status(say('Morzsa válaszol…','Morzsa is responding…'));
   if(data.type==='response.done')status(say(muted?'Mikrofon némítva':'Hallgatlak…',muted?'Microphone muted':'Listening…'));
   if(data.type==='conversation.item.input_audio_transcription.completed'&&data.transcript?.trim()&&!seen.has(data.item_id)){seen.add(data.item_id);if(!turn)turn=1;lastUser=data.transcript;caption(lastUser);for(const resolve of waiters)resolve();waiters.clear();options.onUser(lastUser)}
   if(['response.output_audio_transcript.delta','response.audio_transcript.delta'].includes(data.type))caption((host.querySelector('[data-caption]').textContent||'')+(data.delta||''));
   if(['response.output_audio_transcript.done','response.audio_transcript.done'].includes(data.type)&&data.transcript&&!seen.has('assistant:'+data.item_id)){seen.add('assistant:'+data.item_id);caption(data.transcript);options.onAssistant(data.transcript)}
   if(data.type==='response.function_call_arguments.done'&&!calls.has(data.call_id)){calls.set(data.call_id,true);queue=queue.then(()=>execute(data)).catch(()=>{})}
   if(data.type==='error')stop(say('A hangkapcsolat megszakadt. A beszélgetés és az adatok megmaradtak.','Voice disconnected. Your conversation and data are kept.'));
  }
  try{
   if(!household?.userId()){stop();document.getElementById('household-button')?.click();return}
   const info=await household.plusStatus();if(!valid()){stop();return}if(!info.configured)throw Error('PLUS_SETUP_REQUIRED');if(!info.enabled)throw Error('PLUS_ACCESS_REQUIRED');
   if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==='undefined')throw Error('VOICE_UNSUPPORTED');
   const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});if(!valid()){acquired.getTracks().forEach(t=>t.stop());stop();return}media=acquired;
   pc=new RTCPeerConnection();audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');document.body.append(audio);
   pc.ontrack=e=>{audio.srcObject=e.streams[0];audio.play().catch(()=>{if(session.closed)return;const button=document.createElement('button');button.textContent=say('Hang bekapcsolása','Enable audio');button.onclick=()=>audio.play().then(()=>button.remove());host.querySelector('.realtime-buttons').prepend(button)})};
   pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(pc.connectionState)&&!session.closed)stop(say('A hangkapcsolat véget ért.','Voice conversation ended.'))};
   media.getAudioTracks().forEach(t=>pc.addTrack(t,media));channel=pc.createDataChannel('oai-events');
   channel.onmessage=e=>{try{event(JSON.parse(e.data))}catch{stop(say('A hangkapcsolat megszakadt.','Voice disconnected.'))}};
   channel.onopen=()=>{connected=true;host.querySelector('[data-mute]').disabled=false;status(say('Hallgatlak…','Listening…'))};
   channel.onclose=()=>{if(!session.closed)stop(say('A hangkapcsolat véget ért.','Voice conversation ended.'))};
   const offer=await pc.createOffer();await pc.setLocalDescription(offer);const created=await household.realtimeStart({...options.context(),sdp:offer.sdp});requestId=created.requestId;
   if(!valid()){household.realtimeEnd(requestId).catch(()=>{});stop();return}await pc.setRemoteDescription({type:'answer',sdp:created.sdp});endAt=Date.now()+Math.min(110,created.seconds||110)*1000;
   clock=setInterval(()=>{if(!valid()){stop();return}const seconds=Math.max(0,Math.ceil((endAt-Date.now())/1000));host.querySelector('[data-clock]').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');if(!seconds)stop(say('Ez a hangkör véget ért. A mikrofonra nyomva folytathatod.','This voice session ended. Tap the microphone to continue.'));else if(!connected&&seconds<90)stop(say('Nem sikerült a hangkapcsolat. Próbáld újra.','Voice connection failed. Try again.'))},500);
  }catch(error){await stop();toast(voiceError(error))}
 }
 return {open,close:()=>active?.stop(),running:()=>!!active};
})();
