// Capture and playback stay on WebRTC. Transcripts belong to the background chat.
window.MorzsaRealtime=(()=>{
 let active=null,captureInFlight=false,finishing=Promise.resolve();
 const say=(hu,en)=>language==='en'?en:hu;
 function open(options){
  if(active)return;
  if(captureInFlight){toast(say('Előbb válaszolj a böngésző mikrofonengedély-kérésére.','Please answer the browser’s microphone permission request first.'));return}
  const session={closed:false,dismissed:false,setupPending:true};active=session;start(session,options);
 }
 async function start(session,options){
  let pc,media,channel,audio,requestId,clock,animation,disconnectTimer,ac,micMeter,speakerMeter,view,protocol;
  let proposalTurn=-1,endAt=0,connectedAt=0,errorCode='',released=false,endSettled=true,muted=false,audioBlocked=false,lastEnergy=0,lastFrame=0;
  const previousFocus=document.activeElement,scroll=scrollY;
  const hidden=[...document.querySelectorAll('.app,#workspace-sidebar,#workspace-assistant')].map(el=>[el,el.inert]);
  hidden.forEach(([el])=>el.inert=true);document.body.classList.add('voice-active');
  const host=document.createElement('section');host.id='realtime-voice';host.dataset.state='connecting';
  host.setAttribute('data-no-translate','');host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label',say('Hangbeszélgetés Morzsával','Voice conversation with Morzsa'));
  host.innerHTML='<div class="realtime-top"><span class="realtime-brand"><img src="assets/brands/morzsa.svg" alt="" width="26" height="26">Morzsa <small>Plus</small></span><div class="realtime-clock"><span data-duration aria-label="'+say('Beszélgetés időtartama','Conversation duration')+'">0:00</span><small data-remaining></small></div></div><div class="realtime-stage"><button type="button" class="realtime-orb" data-orb tabindex="-1" aria-label="'+say('Morzsa hangjának bekapcsolása','Enable Morzsa audio')+'"><span class="realtime-orb-layer"></span><span class="realtime-orb-layer"></span><span class="realtime-orb-layer"></span><img src="assets/brands/morzsa.svg" alt="" width="72" height="72"></button><p data-status role="status"></p><p class="realtime-mic-status" data-mic-status></p><p class="realtime-error" data-error role="alert" hidden></p><button type="button" class="realtime-retry" data-retry hidden>'+say('Újrapróbálás','Try again')+'</button></div><div class="realtime-controls"><button type="button" class="realtime-mute" data-mute aria-pressed="false" disabled>'+voiceMicIcon+'<span>'+say('Némítás','Mute')+'</span></button><button type="button" class="realtime-end" data-end>'+say('Befejezés','End conversation')+'</button></div>';
  document.body.append(host);host.querySelector('[data-end]').focus({preventScroll:true});
  const status=host.querySelector('[data-status]'),micStatus=host.querySelector('[data-mic-status]'),muteButton=host.querySelector('[data-mute]'),retryButton=host.querySelector('[data-retry]');
  const valid=()=>!session.closed&&options.valid()&&window.AIMode?.isPlus();
  function renderState(snapshot){
   if(session.closed)return;host.dataset.state=audioBlocked&&snapshot.phase==='speaking'?'audio-blocked':snapshot.state;host.dataset.muted=String(snapshot.muted);
   status.textContent=audioBlocked&&snapshot.phase==='speaking'?say('Kapcsold be Morzsa hangját','Enable Morzsa audio'):({connecting:say('Kapcsolódás…','Connecting…'),listening:say('Hallgatlak…','Listening…'),processing:say('Gondolkodom…','Thinking…'),speaking:say('Morzsa beszél','Morzsa is speaking'),muted:say('A mikrofon némítva','Microphone muted'),error:say('Nem sikerült a hangkapcsolat','Voice connection failed')})[snapshot.state]||'';
   micStatus.textContent=audioBlocked?say('Koppints Morzsára a hang bekapcsolásához.','Tap Morzsa to enable audio.'):snapshot.muted?say('A bekapcsolás gombbal újra hallak.','Unmute when you’re ready.'):media?say('A mikrofon bekapcsolva','Microphone on'):say('A mikrofon engedélyezése szükséges','Microphone permission is needed');
   muteButton.disabled=!media;muteButton.setAttribute('aria-pressed',String(snapshot.muted));muteButton.setAttribute('aria-label',say(snapshot.muted?'Mikrofon bekapcsolása':'Mikrofon némítása',snapshot.muted?'Unmute microphone':'Mute microphone'));
   muteButton.querySelector('span').textContent=say(snapshot.muted?'Bekapcsolás':'Némítás',snapshot.muted?'Unmute':'Mute');
  }
  const send=value=>{if(valid()&&channel?.readyState==='open')channel.send(JSON.stringify(value))};
  function refreshRetry(){retryButton.disabled=session.setupPending||!endSettled||captureInFlight||navigator.onLine===false}
  function release(reason){
   if(released)return finishing;released=true;session.closed=true;protocol?.close();view?.close();
   clearInterval(clock);clearTimeout(disconnectTimer);cancelAnimationFrame(animation);host.style.setProperty('--voice-energy','0');
   media?.getTracks().forEach(t=>t.stop());
   if(channel){channel.onopen=channel.onmessage=channel.onclose=null;channel.close()}
   if(pc){pc.ontrack=pc.onconnectionstatechange=null;pc.close()}
   if(audio){audio.onpause=audio.onended=null;audio.pause();audio.srcObject=null;audio.remove()}
   ac?.close().catch(()=>{});
   if(requestId){endSettled=false;finishing=household.realtimeEnd(requestId,{reason,errorCode}).catch(()=>{}).finally(()=>{endSettled=true;refreshRetry()})}
   return finishing;
  }
  function stop(reason='user',message=''){
   if(session.dismissed)return;session.dismissed=true;release(reason);host.remove();document.body.classList.remove('voice-active');
   hidden.forEach(([el,inert])=>el.inert=inert);window.scrollTo(0,scroll);
   for(const [target,event,listener] of listeners)target.removeEventListener(event,listener);
   if(active===session)active=null;const target=previousFocus?.isConnected&&!previousFocus.disabled?previousFocus:document.querySelector('[data-mic]');target?.focus({preventScroll:true});
   if(message)toast(message);options.onEnd?.(reason);
  }
  function fail(reason,message,code=''){
   if(session.closed||session.dismissed)return;errorCode=String(code).replace(/[^a-z0-9_:-]/gi,'').slice(0,80);release(reason);
   host.dataset.state=['network','time'].includes(reason)?'disconnected':'error';
   status.textContent=reason==='time'?say('A hangkör véget ért','Voice time elapsed'):say('A hangkapcsolat megszakadt','Voice disconnected');
   micStatus.textContent=say('A mikrofon kikapcsolva','Microphone off');muteButton.disabled=true;host.querySelector('[data-error]').textContent=message;host.querySelector('[data-error]').hidden=false;retryButton.hidden=false;refreshRetry();
  }
  view=RealtimeModel.voiceView({render:renderState,timeout:phase=>fail('timeout',phase==='connecting'?say('Nem sikerült időben kapcsolódni. Ellenőrizd a mikrofonengedélyt és az internetet, majd próbáld újra.','Could not connect in time. Check microphone permission and internet, then try again.'):say('Morzsa válasza túl sokáig tartott. Az előzmény megmaradt; próbáld újra.','Morzsa took too long to respond. Your conversation is kept; try again.'),'VOICE_TIMEOUT')});
  async function execute(event,user){
   if(!valid())return {saved:false};if(typeof event.arguments!=='string'||event.arguments.length>12000)throw Error('args');const args=JSON.parse(event.arguments);
   if(event.name==='read_kitchen')return options.context().context;
   if(event.name==='read_conversation')return options.history(args);
   if(event.name==='propose_changes'){if(!user.text)return {proposed:false,reason:'No recognized current user request.'};const result=await options.tools.propose(args.operations,user.text);if(result?.proposed)proposalTurn=user.turn;return result}
   if(event.name==='confirm_changes'){if(user.turn<=proposalTurn||proposalTurn<0||!RealtimeModel.confirmation(user.text))return {saved:false,reason:'Wait for a separate explicit user confirmation.'};const result=await options.tools.confirm();if(result?.saved)proposalTurn=-1;return result}
   if(event.name==='suggest_recipe'){if(typeof args.request!=='string'||!args.request.trim()||args.request.length>2000)throw Error('args');return options.tools.recipe(args.request)}
   if(event.name==='go_to_step')return options.tools.step(args.step);
   if(event.name==='show_ingredients')return options.tools.ingredients();
   if(event.name==='start_timer'){if(!Number.isInteger(args.minutes)||args.minutes<1||args.minutes>120||typeof args.label!=='string'||args.label.length>80)throw Error('args');return options.tools.timer(args.minutes,args.label)}
   throw Error('tool');
  }
  protocol=RealtimeModel.protocol({valid,send,state:value=>view.set(value),execute,user:text=>options.onUser(text),assistant:text=>options.onAssistant(text),diagnostic:code=>{errorCode=code;console.warn(JSON.stringify({event:'morzsa_voice_client_error',code}))},failure:code=>fail('provider',say('Morzsa most nem tudott válaszolni. Próbáld újra; a chat megmaradt.','Morzsa could not answer. Try again; your chat is kept.'),code),fatal:code=>fail('provider',code==='insufficient_quota'?say('Az OpenAI-keret elfogyott. A chat megmaradt.','OpenAI allowance exhausted. Your chat is kept.'):say('A hangszolgáltatás lezárta a kapcsolatot. Próbáld újra; a chat megmaradt.','The voice service closed the connection. Try again; your chat is kept.'),code)});
  session.stop=stop;
  const listeners=[[document,'visibilitychange',()=>{if(document.hidden)stop('background')}],[window,'morzsa-pause',()=>stop('background')],[window,'pagehide',()=>stop('background')],[window,'offline',()=>fail('network',say('Nincs internetkapcsolat. Az újrapróbálás a kapcsolat helyreállása után elérhető.','No internet. Retry when your connection returns.'))],[window,'online',refreshRetry],[window,'morzsa-ai-mode-change',()=>stop('mode')],[window,'morzsa-auth-change',()=>{if(!options.valid()||!window.AIMode?.isPlus())stop('context')}]];
  for(const [target,event,listener] of listeners)target.addEventListener(event,listener);
  host.querySelector('[data-end]').onclick=()=>stop();
  host.onkeydown=e=>{
   if(e.key==='Escape'){stop();return}if(e.key!=='Tab')return;
   const controls=[...host.querySelectorAll('button')].filter(b=>!b.disabled&&b.tabIndex>=0&&!b.hidden);
   const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
  };
  muteButton.onclick=()=>{if(!valid()||!media)return;muted=!muted;media.getAudioTracks().forEach(t=>t.enabled=!muted);view.mute(muted);if(!muted)ac?.resume().catch(()=>{})};
  retryButton.onclick=async()=>{if(retryButton.disabled||session.retrying)return;session.retrying=true;retryButton.disabled=true;await finishing;if(session.dismissed)return;stop('retry');if(options.valid()&&window.AIMode?.isPlus())open(options)};
  function meter(stream){
   if(!ac)return;try{const analyser=ac.createAnalyser();analyser.fftSize=256;const source=ac.createMediaStreamSource(stream);source.connect(analyser);return {analyser,samples:new Uint8Array(analyser.fftSize)}}catch{}
  }
  function level(m){if(!m)return 0;m.analyser.getByteTimeDomainData(m.samples);let sum=0;for(const v of m.samples)sum+=(v-128)**2;return Math.min(1,Math.sqrt(sum/m.samples.length)/24)}
  function animate(now){
   if(session.closed)return;
   if(now-lastFrame>=33){lastFrame=now;const phase=view.snapshot().phase,m=phase==='speaking'&&!audioBlocked?speakerMeter:phase==='listening'&&!muted?micMeter:null;lastEnergy=lastEnergy*.65+level(m)*.35;host.style.setProperty('--voice-energy',lastEnergy.toFixed(3))}
   animation=requestAnimationFrame(animate);
  }
  async function enableAudio(){
   if(session.closed)return;try{await ac?.resume();if(audio)await audio.play();if(session.closed)return;audioBlocked=false;host.querySelector('[data-orb]').tabIndex=-1;renderState(view.snapshot())}catch{if(session.closed)return;audioBlocked=true;host.querySelector('[data-orb]').tabIndex=0;renderState(view.snapshot())}
  }
  host.querySelector('[data-orb]').onclick=enableAudio;
  const format=seconds=>Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
  function tick(){
   if(!valid()){if(!session.closed)stop('context');return}
   host.querySelector('[data-duration]').textContent=format(connectedAt?Math.max(0,Math.floor((Date.now()-connectedAt)/1000)):0);
   if(!endAt)return;const seconds=Math.max(0,Math.ceil((endAt-Date.now())/1000));host.querySelector('[data-remaining]').textContent=say('Hátra ','Left ')+format(seconds);
   if(!seconds)fail('time',say('A hangkör 110 másodperces kerete lejárt. Újrapróbálással innen folytathatod.','The 110-second voice allowance elapsed. Retry to continue from here.'));
  }
  clock=setInterval(tick,500);
  try{
   await finishing;if(!valid())return;
   const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){try{ac=new Audio();ac.resume().catch(()=>{})}catch{}}
   if(!household?.userId()){stop();window.MorzsaCompanion?.openHistory();const settings=document.querySelector('.workspace-settings');if(settings)settings.open=true;document.getElementById('household-button')?.click();return}
   const info=await household.plusStatus();if(!valid()){if(!session.closed)stop('context');return}if(!info.configured)throw Error('PLUS_SETUP_REQUIRED');if(!info.enabled)throw Error('PLUS_ACCESS_REQUIRED');
   if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==='undefined')throw Error('VOICE_UNSUPPORTED');
   captureInFlight=true;let acquired;try{acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}finally{captureInFlight=false}
   if(!valid()){acquired.getTracks().forEach(t=>t.stop());if(!session.closed)stop('context');return}
   media=acquired;micMeter=meter(media);renderState(view.snapshot());
   media.getAudioTracks().forEach(t=>t.addEventListener('ended',()=>{if(valid())fail('network',say('A mikrofon leállt. Próbáld újra, és ellenőrizd az engedélyt.','Microphone stopped. Retry and check permission.'))},{once:true}));
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches)animation=requestAnimationFrame(animate);
   pc=new RTCPeerConnection();audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');document.body.append(audio);
   audio.onpause=audio.onended=()=>{if(valid())protocol.playbackEnded()};
   pc.ontrack=e=>{if(!valid())return;const stream=e.streams[0]||new MediaStream([e.track]);audio.srcObject=stream;speakerMeter=meter(stream);host.dataset.speakerMeter=String(!!speakerMeter);enableAudio()};
   pc.onconnectionstatechange=()=>{
    if(!valid())return;clearTimeout(disconnectTimer);
    if(pc.connectionState==='connected'){if(connectedAt)protocol.refresh();return}
    if(pc.connectionState==='disconnected'){view.set('connecting');disconnectTimer=setTimeout(()=>fail('network',say('A hangkapcsolat nem állt helyre. Próbáld újra; a chat megmaradt.','Voice could not reconnect. Retry; your chat is kept.')),8000)}
    else if(['failed','closed'].includes(pc.connectionState))fail('network',say('A hangkapcsolat megszakadt. Próbáld újra; a chat megmaradt.','Voice disconnected. Retry; your chat is kept.'));
   };
   media.getAudioTracks().forEach(t=>pc.addTrack(t,media));channel=pc.createDataChannel('oai-events');
   channel.onmessage=e=>{if(!valid())return;try{protocol.event(JSON.parse(e.data))}catch{console.warn(JSON.stringify({event:'morzsa_voice_event_invalid'}))}};
   channel.onopen=()=>{if(!valid())return;connectedAt=Date.now();view.set('listening');tick();for(const message of options.context().history||[])send({type:'conversation.item.create',item:{type:'message',role:message.role==='model'?'assistant':'user',content:[{type:message.role==='model'?'text':'input_text',text:message.text}]}})};
   channel.onclose=()=>{if(valid()){const timed=endAt&&endAt-Date.now()<1500;fail(timed?'time':'network',timed?say('A hangkör ideje lejárt. Újrapróbálással folytathatod.','Voice time elapsed. Retry to continue.'):say('A hangkapcsolat megszakadt. Próbáld újra; a chat megmaradt.','Voice disconnected. Retry; your chat is kept.'))}};
   const offer=await pc.createOffer();if(!valid())return;await pc.setLocalDescription(offer);if(!valid())return;
   const created=await household.realtimeStart({...options.context(),sdp:offer.sdp});requestId=created.requestId;
   if(!valid()){if(session.closed){endSettled=false;finishing=household.realtimeEnd(requestId,{reason:'setup',errorCode}).catch(()=>{}).finally(()=>{endSettled=true;refreshRetry()})}else stop('context');return}
   const expiry=Date.parse(created.expiresAt);endAt=Number.isFinite(expiry)?expiry:Date.now()+Math.min(110,created.seconds||110)*1000;
   await pc.setRemoteDescription({type:'answer',sdp:created.sdp});tick();
  }catch(error){if(!session.closed)fail('setup',voiceError(error),error.name||error.message)}
  finally{session.setupPending=false;refreshRetry()}
 }
 return {open,close:()=>active?.stop(),running:()=>!!active&&!active.closed};
})();
